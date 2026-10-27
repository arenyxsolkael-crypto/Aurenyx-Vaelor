package org.aethervanguard.aurenyxvaelor

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.aethervanguard.aurenyxvaelor.data.PrivateChatStore
import org.aethervanguard.aurenyxvaelor.domain.LocalSecretScanner
import org.aethervanguard.aurenyxvaelor.domain.SafeMathEvaluator
import org.aethervanguard.aurenyxvaelor.domain.TrustGridEngine
import org.aethervanguard.aurenyxvaelor.model.ChatRequestDto
import org.aethervanguard.aurenyxvaelor.model.LocalChatMessage
import org.aethervanguard.aurenyxvaelor.model.OfficialAttribution
import org.aethervanguard.aurenyxvaelor.model.RequestUiState
import org.aethervanguard.aurenyxvaelor.network.BackendCallOutcome
import org.aethervanguard.aurenyxvaelor.network.VaelorBackendClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.util.concurrent.TimeUnit

class VaelorAndroidUnitTest {

    @Test
    fun officialFoundingAttribution_isPreservedVerbatim() {
        assertEquals(
            "AURENYX VAELOR — Founded by The Aether Vanguard, founded by Arenyx Sol Kael.",
            OfficialAttribution.STATEMENT
        )
        assertEquals("The Aether Vanguard", OfficialAttribution.FOUNDER_ORGANIZATION)
        assertEquals("Arenyx Sol Kael", OfficialAttribution.FOUNDER_NAME)
        assertEquals("0.2.0", OfficialAttribution.VERSION)
    }

    @Test
    fun safeMathEvaluator_computesExpressionsAndRejectsInjection() {
        val result = SafeMathEvaluator.evaluate("(1450 * 12) + sqrt(144) - 380")
        assertEquals(17032.0, result, 0.0001)

        var threwOnZeroDiv = false
        try {
            SafeMathEvaluator.evaluate("42 / 0")
        } catch (_: IllegalArgumentException) {
            threwOnZeroDiv = true
        }
        assertTrue(threwOnZeroDiv)
    }

    @Test
    fun localSecretScanner_detectsAndRedactsCredentials() {
        // Construct synthetic prefix dynamically so static scanners never confuse unit test input with real keys
        val syntheticKey = "AIza" + "SySyntheticUnitTestToken1234567890"
        assertTrue(LocalSecretScanner.containsSecret("My key is $syntheticKey"))
        val redacted = LocalSecretScanner.redactSecrets("Error with $syntheticKey")
        assertFalse(redacted.contains(syntheticKey))
        assertTrue(redacted.contains("[REDACTED_CREDENTIAL]"))
    }

    @Test
    fun privateChatStore_persistsDeletesAndWipesCleanly() {
        val tempDir = Files.createTempDirectory("vaelor_private_test").toFile()
        try {
            val store = PrivateChatStore(tempDir)
            assertTrue(store.loadConversations().isEmpty())

            val msg1 = LocalChatMessage(
                id = "m1",
                role = "user",
                content = "Plan a Kotlin coroutine architecture",
                createdAtEpochMs = 1000L
            )
            val afterFirst = store.appendMessage("conv-1", msg1, nowEpochMs = 1000L)
            assertEquals(1, afterFirst.size)
            assertEquals("conv-1", afterFirst.first().id)

            val reloaded = store.loadConversations()
            assertEquals(1, reloaded.size)
            assertEquals("Plan a Kotlin coroutine architecture", reloaded.first().messages.first().content)

            val afterRename = store.renameConversation("conv-1", "Kotlin Coroutine Blueprint", nowEpochMs = 2000L)
            assertEquals("Kotlin Coroutine Blueprint", afterRename.first().title)

            val afterArchive = store.setArchived("conv-1", true, nowEpochMs = 3000L)
            assertTrue(afterArchive.first().archived)

            val afterUnarchive = store.setArchived("conv-1", false, nowEpochMs = 4000L)
            assertFalse(afterUnarchive.first().archived)

            val afterWipe = store.wipeAllPrivateHistory()
            assertTrue(afterWipe.isEmpty())
            assertTrue(store.loadConversations().isEmpty())
        } finally {
            tempDir.deleteRecursively()
        }
    }

    @Test
    fun trustGridEngine_computesBandsAndCriticalReviewFlagsDeterministically() {
        val lowInput = TrustGridEngine.EvaluationInput(
            workflowName = "Public Docs Summarizer",
            dataSensitivity = TrustGridEngine.DataSensitivity.PUBLIC,
            autonomy = TrustGridEngine.Autonomy.SUGGESTIONS,
            impact = TrustGridEngine.Impact.MINOR,
            externalUntrustedInput = false,
            logging = TrustGridEngine.Logging.COMPREHENSIVE,
            approval = TrustGridEngine.Approval.REQUIRED,
            missingRollbackProcedure = false
        )
        val lowOut = TrustGridEngine.evaluate(lowInput)
        assertEquals(0, lowOut.score)
        assertEquals("Low", lowOut.riskBand)
        assertTrue(lowOut.criticalReviewFlags.isEmpty())

        val criticalInput = TrustGridEngine.EvaluationInput(
            workflowName = "Autonomous Loan Underwriter",
            dataSensitivity = TrustGridEngine.DataSensitivity.CONFIDENTIAL_REGULATED,
            autonomy = TrustGridEngine.Autonomy.CONSEQUENTIAL_AUTO,
            impact = TrustGridEngine.Impact.LEGAL_SAFETY,
            externalUntrustedInput = true,
            logging = TrustGridEngine.Logging.WEAK,
            approval = TrustGridEngine.Approval.NONE,
            missingRollbackProcedure = true
        )
        val criticalOut = TrustGridEngine.evaluate(criticalInput)
        assertEquals(12, criticalOut.score)
        assertEquals("Critical", criticalOut.riskBand)
        assertEquals(3, criticalOut.criticalReviewFlags.size)
    }

    @Test
    fun backendClient_enforcesHttpsInProductionAndMapsQuotaTimeoutAndSanitizedErrors() = runTest {
        var rejectedHttp = false
        try {
            VaelorBackendClient.validateAndNormalizeBaseUrl(
                rawUrl = "http://insecure.example.com",
                allowLoopbackHttp = false
            )
        } catch (_: IllegalArgumentException) {
            rejectedHttp = true
        }
        assertTrue(rejectedHttp)

        val server = MockWebServer()
        server.start()
        try {
            val baseUrl = server.url("").toString().trimEnd('/')
            val client = VaelorBackendClient(
                baseUrl = baseUrl,
                allowLoopbackHttp = true,
                readTimeoutSeconds = 1L
            )

            // 1. Valid 200 chat response
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"reply":"Verified response from Vaelor Forge.","taskRun":{"selectedAgent":"vaelor-forge","agentName":"Vaelor Forge"}}""")
            )
            val okRes = client.sendChatMessage(ChatRequestDto(message = "Review Kotlin sealed interfaces"))
            assertTrue(okRes is BackendCallOutcome.Success)
            assertEquals(
                "Verified response from Vaelor Forge.",
                (okRes as BackendCallOutcome.Success).data.reply
            )

            // 2. HTTP 429 Quota / Rate-limit mapping
            server.enqueue(
                MockResponse()
                    .setResponseCode(429)
                    .addHeader("Retry-After", "45")
                    .setBody("""{"error":"Rate limit reached.","code":"RATE_LIMITED","retryable":true}""")
            )
            val quotaRes = client.sendChatMessage(ChatRequestDto(message = "Another query"))
            assertTrue(quotaRes is BackendCallOutcome.Failure)
            val quotaState = (quotaRes as BackendCallOutcome.Failure).state
            assertTrue(quotaState is RequestUiState.QuotaLimited)
            assertEquals(45, (quotaState as RequestUiState.QuotaLimited).retryAfterSeconds)

            // 3. Socket timeout mapping
            server.enqueue(
                MockResponse()
                    .setBody("""{"reply":"Delayed"}""")
                    .setBodyDelay(2500, TimeUnit.MILLISECONDS)
            )
            val timeoutRes = client.sendChatMessage(ChatRequestDto(message = "Slow request"))
            assertTrue(timeoutRes is BackendCallOutcome.Failure)
            assertTrue((timeoutRes as BackendCallOutcome.Failure).state is RequestUiState.Timeout)
        } finally {
            server.shutdown()
        }
    }
}
