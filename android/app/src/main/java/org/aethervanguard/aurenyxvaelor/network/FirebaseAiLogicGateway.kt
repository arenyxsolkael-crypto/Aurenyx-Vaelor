package org.aethervanguard.aurenyxvaelor.network

import android.content.Context
import com.google.firebase.Firebase
import com.google.firebase.FirebaseApp
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import org.aethervanguard.aurenyxvaelor.domain.LocalSecretScanner

/**
 * Optional direct client-side Gemini gateway using official Firebase AI Logic + Firebase App Check.
 *
 * Security invariants:
 * - Never embeds a raw Gemini API key in Kotlin source, resources, or BuildConfig.
 * - Requires a real Firebase project (google-services.json) with Play Integrity App Check registered.
 * - Clearly reports UNAVAILABLE when google-services.json is absent so the app never fakes direct mode
 *   and instead uses the Secure Backend Orchestration gateway (VaelorBackendClient).
 */
class FirebaseAiLogicGateway(private val appContext: Context) {

    @Volatile
    private var appCheckInstalled: Boolean = false

    fun isConfigured(): Boolean {
        return FirebaseApp.getApps(appContext).isNotEmpty()
    }

    fun installPlayIntegrityAppCheckIfConfigured(): Boolean {
        if (!isConfigured()) return false
        if (!appCheckInstalled) {
            synchronized(this) {
                if (!appCheckInstalled) {
                    val appCheck = FirebaseAppCheck.getInstance()
                    appCheck.installAppCheckProviderFactory(
                        PlayIntegrityAppCheckProviderFactory.getInstance()
                    )
                    appCheckInstalled = true
                }
            }
        }
        return true
    }

    suspend fun generateDirectPromptIfConfigured(prompt: String): Result<String> {
        if (LocalSecretScanner.containsSecret(prompt)) {
            return Result.failure(
                IllegalArgumentException("Security guardrail: Never send API keys or private credentials in prompts.")
            )
        }
        if (!installPlayIntegrityAppCheckIfConfigured()) {
            return Result.failure(
                IllegalStateException(
                    "Direct Firebase AI Logic is unavailable until google-services.json and Play Integrity App Check are configured. Use Secure Backend Orchestration mode."
                )
            )
        }

        return try {
            val model = Firebase.ai(backend = GenerativeBackend.googleAI())
                .generativeModel(modelName = "gemini-3.1-flash-lite")
            val response = model.generateContent(prompt)
            val text = response.text?.trim().orEmpty()
            if (text.isEmpty()) {
                Result.failure(IllegalStateException("Empty response from Firebase AI Logic."))
            } else {
                Result.success(text)
            }
        } catch (e: Exception) {
            Result.failure(
                IllegalStateException(
                    LocalSecretScanner.redactSecrets(
                        e.message ?: "Firebase AI Logic request failed."
                    )
                )
            )
        }
    }
}
