package org.aethervanguard.aurenyxvaelor.model

import kotlinx.serialization.Serializable

object OfficialAttribution {
    const val PRODUCT_NAME = "AURENYX VAELOR"
    const val VERSION = "0.2.0"
    const val TAGLINE = "Intelligence, Orchestrated."
    const val FOUNDER_ORGANIZATION = "The Aether Vanguard"
    const val FOUNDER_NAME = "Arenyx Sol Kael"
    const val STATEMENT =
        "AURENYX VAELOR — Founded by The Aether Vanguard, founded by Arenyx Sol Kael."
    const val TRUSTGRID_NAME = "AURENYX TRUSTGRID"
    const val TRUSTGRID_HEADLINE = "Turn AI innovation into trust."
}

@Serializable
data class ChatHistoryTurnDto(
    val role: String,
    val content: String
)

@Serializable
data class ChatRequestDto(
    val message: String,
    val history: List<ChatHistoryTurnDto> = emptyList(),
    val preferredAgent: String? = null,
    val useSentinel: Boolean = true,
    val researchMode: Boolean = false,
    val tone: String? = null,
    val responseLength: String? = null,
    val mockMode: Boolean = false,
    val conversationId: String? = null
)

@Serializable
data class ToolCallRecordDto(
    val tool: String = "",
    val status: String = "",
    val durationMs: Long = 0L,
    val output: String = "",
    val error: String? = null
)

@Serializable
data class CitationDto(
    val id: String = "",
    val sourceTitle: String = "",
    val sourceType: String = "",
    val excerpt: String = "",
    val url: String? = null
)

@Serializable
data class SentinelReviewDto(
    val approved: Boolean = true,
    val status: String = "verified",
    val verificationStatus: String? = null,
    val verificationLabel: String? = null,
    val flags: List<String> = emptyList(),
    val summary: String = ""
)

@Serializable
data class TaskRunDto(
    val taskId: String = "",
    val taskType: String = "general",
    val selectedAgent: String = "vaelor-core",
    val agentName: String = "Vaelor Core",
    val status: String = "completed",
    val stepCount: Int = 1,
    val maxSteps: Int = 4,
    val modelUsed: String? = null,
    val toolCalls: List<ToolCallRecordDto> = emptyList(),
    val citations: List<CitationDto> = emptyList(),
    val sentinelReview: SentinelReviewDto? = null
)

@Serializable
data class ChatResponseDto(
    val reply: String,
    val taskRun: TaskRunDto? = null
)

@Serializable
data class ApiErrorDto(
    val error: String = "Request could not be completed.",
    val code: String = "UNKNOWN_ERROR",
    val retryable: Boolean = false
)

@Serializable
data class HealthStatusDto(
    val ok: Boolean = false,
    val configured: Boolean = false,
    val provider: String = "Gemini Gateway",
    val primaryModel: String? = null,
    val liveSearchConfigured: Boolean = false,
    val rateLimitPerMinute: Int = 20
)

@Serializable
data class LocalChatMessage(
    val id: String,
    val role: String, // "user" | "assistant"
    val content: String,
    val agentName: String? = null,
    val sentinelStatus: String? = null,
    val citations: List<CitationDto> = emptyList(),
    val createdAtEpochMs: Long
)

@Serializable
data class PrivateConversation(
    val id: String,
    val title: String,
    val messages: List<LocalChatMessage> = emptyList(),
    val updatedAtEpochMs: Long,
    val archived: Boolean = false
)

@Serializable
data class PrivateWorkspacePayload(
    val schemaVersion: Int = 1,
    val conversations: List<PrivateConversation> = emptyList()
)

sealed interface RequestUiState {
    data object Idle : RequestUiState
    data class Loading(val stageDescription: String) : RequestUiState
    data class Offline(val detail: String, val pendingPrompt: String? = null) : RequestUiState
    data class Timeout(val timeoutSeconds: Int, val retryPrompt: String) : RequestUiState
    data class QuotaLimited(
        val retryAfterSeconds: Int?,
        val message: String,
        val retryPrompt: String
    ) : RequestUiState
    data class SanitizedError(
        val code: String,
        val message: String,
        val retryable: Boolean,
        val retryPrompt: String? = null
    ) : RequestUiState
}

enum class FeatureAvailabilityStatus {
    AVAILABLE,
    UNAVAILABLE_REQUIRES_CONFIG
}

data class HonestCapabilityItem(
    val name: String,
    val status: FeatureAvailabilityStatus,
    val summary: String
)
