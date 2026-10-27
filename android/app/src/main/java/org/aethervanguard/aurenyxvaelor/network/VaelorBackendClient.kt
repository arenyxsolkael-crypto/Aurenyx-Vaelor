package org.aethervanguard.aurenyxvaelor.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.aethervanguard.aurenyxvaelor.domain.LocalSecretScanner
import org.aethervanguard.aurenyxvaelor.model.ApiErrorDto
import org.aethervanguard.aurenyxvaelor.model.ChatRequestDto
import org.aethervanguard.aurenyxvaelor.model.ChatResponseDto
import org.aethervanguard.aurenyxvaelor.model.HealthStatusDto
import org.aethervanguard.aurenyxvaelor.model.RequestUiState
import java.io.IOException
import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

sealed interface BackendCallOutcome<out T> {
    data class Success<T>(val data: T) : BackendCallOutcome<T>
    data class Failure(val state: RequestUiState) : BackendCallOutcome<Nothing>
}

class VaelorBackendClient(
    baseUrl: String,
    private val allowLoopbackHttp: Boolean = false,
    private val readTimeoutSeconds: Long = 35L,
    httpClientOverride: OkHttpClient? = null
) {

    private val normalizedBaseUrl: String = validateAndNormalizeBaseUrl(baseUrl, allowLoopbackHttp)

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val client: OkHttpClient = httpClientOverride ?: OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(readTimeoutSeconds, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .callTimeout(readTimeoutSeconds + 5L, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .build()

    suspend fun fetchHealth(): BackendCallOutcome<HealthStatusDto> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$normalizedBaseUrl/api/health")
            .get()
            .build()

        executeSafely(retryPrompt = null) { responseBody ->
            json.decodeFromString<HealthStatusDto>(responseBody)
        }.invoke(request)
    }

    suspend fun sendChatMessage(payload: ChatRequestDto): BackendCallOutcome<ChatResponseDto> =
        withContext(Dispatchers.IO) {
            val trimmed = payload.message.trim()
            if (trimmed.isEmpty()) {
                return@withContext BackendCallOutcome.Failure(
                    RequestUiState.SanitizedError(
                        code = "VALIDATION_ERROR",
                        message = "Enter a message before sending.",
                        retryable = false
                    )
                )
            }
            if (LocalSecretScanner.containsSecret(trimmed)) {
                return@withContext BackendCallOutcome.Failure(
                    RequestUiState.SanitizedError(
                        code = "SECRET_DETECTED_IN_INPUT",
                        message = "Security guardrail: Never submit API keys or private credentials in chat.",
                        retryable = false
                    )
                )
            }

            val bodyString = json.encodeToString(payload.copy(message = trimmed))
            val request = Request.Builder()
                .url("$normalizedBaseUrl/api/chat")
                .post(bodyString.toRequestBody(jsonMediaType))
                .build()

            executeSafely(retryPrompt = trimmed) { responseBody ->
                json.decodeFromString<ChatResponseDto>(responseBody)
            }.invoke(request)
        }

    suspend fun purgeServerSession(): Boolean = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url("$normalizedBaseUrl/api/session/purge")
                .post("""{"scope":"all"}""".toRequestBody(jsonMediaType))
                .build()
            client.newCall(req).execute().use { it.isSuccessful }
        } catch (_: Exception) {
            false
        }
    }

    private fun <T> executeSafely(
        retryPrompt: String?,
        decodeSuccess: (String) -> T
    ): (Request) -> BackendCallOutcome<T> = { request ->
        try {
            client.newCall(request).execute().use { response ->
                val rawBody = response.body?.string().orEmpty()
                if (response.isSuccessful) {
                    BackendCallOutcome.Success(decodeSuccess(rawBody))
                } else {
                    BackendCallOutcome.Failure(
                        mapHttpErrorToUiState(
                            httpCode = response.code,
                            retryAfterHeader = response.header("Retry-After"),
                            rawBody = rawBody,
                            retryPrompt = retryPrompt
                        )
                    )
                }
            }
        } catch (timeout: SocketTimeoutException) {
            BackendCallOutcome.Failure(
                RequestUiState.Timeout(
                    timeoutSeconds = readTimeoutSeconds.toInt(),
                    retryPrompt = retryPrompt.orEmpty()
                )
            )
        } catch (interrupted: InterruptedIOException) {
            BackendCallOutcome.Failure(
                RequestUiState.Timeout(
                    timeoutSeconds = readTimeoutSeconds.toInt(),
                    retryPrompt = retryPrompt.orEmpty()
                )
            )
        } catch (offline: UnknownHostException) {
            BackendCallOutcome.Failure(
                RequestUiState.Offline(
                    detail = "Unable to resolve server address. Check Wi-Fi or mobile data.",
                    pendingPrompt = retryPrompt
                )
            )
        } catch (connect: ConnectException) {
            BackendCallOutcome.Failure(
                RequestUiState.Offline(
                    detail = "Could not connect to secure orchestration server.",
                    pendingPrompt = retryPrompt
                )
            )
        } catch (io: IOException) {
            BackendCallOutcome.Failure(
                RequestUiState.SanitizedError(
                    code = "NETWORK_IO_ERROR",
                    message = "Network connection interrupted cleanly. Tap Retry to try again.",
                    retryable = true,
                    retryPrompt = retryPrompt
                )
            )
        } catch (_: Exception) {
            BackendCallOutcome.Failure(
                RequestUiState.SanitizedError(
                    code = "MALFORMED_SERVER_RESPONSE",
                    message = "Received an unexpected response format from server.",
                    retryable = true,
                    retryPrompt = retryPrompt
                )
            )
        }
    }

    internal fun mapHttpErrorToUiState(
        httpCode: Int,
        retryAfterHeader: String?,
        rawBody: String,
        retryPrompt: String?
    ): RequestUiState {
        val parsed = try {
            if (rawBody.isNotBlank()) json.decodeFromString<ApiErrorDto>(rawBody) else null
        } catch (_: Exception) {
            null
        }

        val safeMessage = LocalSecretScanner.redactSecrets(
            parsed?.error?.takeIf { it.isNotBlank() }
                ?: "The request could not be completed (HTTP $httpCode)."
        )
        val errorCode = parsed?.code ?: "HTTP_$httpCode"

        if (httpCode == 429 || errorCode == "RATE_LIMITED" || errorCode == "QUOTA_EXCEEDED") {
            val retrySeconds = retryAfterHeader?.trim()?.toIntOrNull()
            return RequestUiState.QuotaLimited(
                retryAfterSeconds = retrySeconds,
                message = safeMessage,
                retryPrompt = retryPrompt.orEmpty()
            )
        }

        if (httpCode == 408 || httpCode == 504 || errorCode == "TIMEOUT") {
            return RequestUiState.Timeout(
                timeoutSeconds = readTimeoutSeconds.toInt(),
                retryPrompt = retryPrompt.orEmpty()
            )
        }

        return RequestUiState.SanitizedError(
            code = errorCode,
            message = safeMessage,
            retryable = parsed?.retryable ?: (httpCode >= 500),
            retryPrompt = retryPrompt
        )
    }

    companion object {
        fun validateAndNormalizeBaseUrl(rawUrl: String, allowLoopbackHttp: Boolean): String {
            val trimmed = rawUrl.trim().trimEnd('/')
            if (trimmed.startsWith("https://")) {
                return trimmed
            }
            if (allowLoopbackHttp && (
                    trimmed.startsWith("http://10.0.2.2") ||
                        trimmed.startsWith("http://127.0.0.1") ||
                        trimmed.startsWith("http://localhost")
                    )
            ) {
                return trimmed
            }
            throw IllegalArgumentException(
                "Backend URL must use HTTPS in production builds (got '$trimmed')."
            )
        }
    }
}
