package org.aethervanguard.aurenyxvaelor.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.aethervanguard.aurenyxvaelor.BuildConfig
import org.aethervanguard.aurenyxvaelor.VaelorApplication
import org.aethervanguard.aurenyxvaelor.data.PrivateChatStore
import org.aethervanguard.aurenyxvaelor.domain.LocalSecretScanner
import org.aethervanguard.aurenyxvaelor.domain.SafeMathEvaluator
import org.aethervanguard.aurenyxvaelor.domain.TrustGridEngine
import org.aethervanguard.aurenyxvaelor.model.ChatHistoryTurnDto
import org.aethervanguard.aurenyxvaelor.model.ChatRequestDto
import org.aethervanguard.aurenyxvaelor.model.FeatureAvailabilityStatus
import org.aethervanguard.aurenyxvaelor.model.HealthStatusDto
import org.aethervanguard.aurenyxvaelor.model.HonestCapabilityItem
import org.aethervanguard.aurenyxvaelor.model.LocalChatMessage
import org.aethervanguard.aurenyxvaelor.model.PrivateConversation
import org.aethervanguard.aurenyxvaelor.model.RequestUiState
import org.aethervanguard.aurenyxvaelor.network.BackendCallOutcome
import org.aethervanguard.aurenyxvaelor.network.FirebaseAiLogicGateway
import org.aethervanguard.aurenyxvaelor.network.NetworkConnectivityMonitor
import org.aethervanguard.aurenyxvaelor.network.VaelorBackendClient
import java.io.File
import java.util.UUID

enum class GatewayExecutionMode {
    SECURE_BACKEND_ORCHESTRATOR,
    FIREBASE_AI_LOGIC_DIRECT
}

data class VaelorScreenState(
    val backendBaseUrl: String = BuildConfig.DEFAULT_BACKEND_URL,
    val gatewayMode: GatewayExecutionMode = GatewayExecutionMode.SECURE_BACKEND_ORCHESTRATOR,
    val firebaseAiConfigured: Boolean = false,
    val isDeviceOnline: Boolean = true,
    val healthStatus: HealthStatusDto? = null,
    val conversations: List<PrivateConversation> = emptyList(),
    val activeConversationId: String? = null,
    val preferredAgent: String? = null,
    val useSentinelVerification: Boolean = true,
    val requestState: RequestUiState = RequestUiState.Idle,
    val mathInput: String = "(1450 * 12) + sqrt(144) - 380",
    val mathResultText: String? = null,
    val trustGridInput: TrustGridEngine.EvaluationInput = TrustGridEngine.EvaluationInput(
        workflowName = "Customer Triage Assistant",
        dataSensitivity = TrustGridEngine.DataSensitivity.PERSONAL,
        autonomy = TrustGridEngine.Autonomy.HUMAN_DRAFTS,
        impact = TrustGridEngine.Impact.FINANCIAL_PRIVACY,
        externalUntrustedInput = true,
        logging = TrustGridEngine.Logging.PARTIAL,
        approval = TrustGridEngine.Approval.REQUIRED,
        missingRollbackProcedure = false
    ),
    val trustGridResult: TrustGridEngine.EvaluationOutput = TrustGridEngine.evaluate(
        TrustGridEngine.EvaluationInput(
            workflowName = "Customer Triage Assistant",
            dataSensitivity = TrustGridEngine.DataSensitivity.PERSONAL,
            autonomy = TrustGridEngine.Autonomy.HUMAN_DRAFTS,
            impact = TrustGridEngine.Impact.FINANCIAL_PRIVACY,
            externalUntrustedInput = true,
            logging = TrustGridEngine.Logging.PARTIAL,
            approval = TrustGridEngine.Approval.REQUIRED,
            missingRollbackProcedure = false
        )
    ),
    val capabilities: List<HonestCapabilityItem> = emptyList()
) {
    val activeConversation: PrivateConversation?
        get() = conversations.firstOrNull { it.id == activeConversationId } ?: conversations.firstOrNull()
}

class VaelorViewModel(application: Application) : AndroidViewModel(application) {

    private val privateStore = PrivateChatStore(
        File(application.filesDir, "private_conversations")
    )
    private val connectivityMonitor = NetworkConnectivityMonitor(application)
    private val firebaseGateway: FirebaseAiLogicGateway =
        (application as? VaelorApplication)?.firebaseAiGateway
            ?: FirebaseAiLogicGateway(application)

    private var backendClient = VaelorBackendClient(
        baseUrl = BuildConfig.DEFAULT_BACKEND_URL,
        allowLoopbackHttp = BuildConfig.ALLOW_DEBUG_EMULATOR_HTTP
    )

    private val _uiState = MutableStateFlow(buildInitialState())
    val uiState: StateFlow<VaelorScreenState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            connectivityMonitor.isOnline.collect { online ->
                _uiState.update { current ->
                    val nextRequestState = if (!online && current.requestState is RequestUiState.Idle) {
                        RequestUiState.Offline(
                            detail = "Device has no active internet connection. Private local history and TrustGrid scoring remain available offline."
                        )
                    } else if (online && current.requestState is RequestUiState.Offline && current.requestState.pendingPrompt == null) {
                        RequestUiState.Idle
                    } else {
                        current.requestState
                    }
                    current.copy(isDeviceOnline = online, requestState = nextRequestState)
                }
            }
        }
        refreshBackendHealth()
    }

    private fun buildInitialState(): VaelorScreenState {
        val loaded = privateStore.loadConversations()
        val firebaseReady = firebaseGateway.isConfigured()
        return VaelorScreenState(
            firebaseAiConfigured = firebaseReady,
            isDeviceOnline = connectivityMonitor.checkCurrentlyConnected(),
            conversations = loaded,
            activeConversationId = loaded.firstOrNull()?.id,
            capabilities = computeHonestCapabilities(
                firebaseConfigured = firebaseReady,
                health = null
            )
        )
    }

    fun refreshBackendHealth() {
        viewModelScope.launch {
            if (!connectivityMonitor.checkCurrentlyConnected()) {
                _uiState.update {
                    it.copy(
                        isDeviceOnline = false,
                        requestState = RequestUiState.Offline(
                            detail = "Offline: Connect to Wi-Fi or mobile data to reach the Vaelor orchestration server."
                        )
                    )
                }
                return@launch
            }

            when (val outcome = backendClient.fetchHealth()) {
                is BackendCallOutcome.Success -> {
                    _uiState.update { current ->
                        current.copy(
                            healthStatus = outcome.data,
                            capabilities = computeHonestCapabilities(
                                firebaseConfigured = current.firebaseAiConfigured,
                                health = outcome.data
                            )
                        )
                    }
                }
                is BackendCallOutcome.Failure -> {
                    _uiState.update { current ->
                        current.copy(
                            healthStatus = null,
                            capabilities = computeHonestCapabilities(
                                firebaseConfigured = current.firebaseAiConfigured,
                                health = null
                            )
                        )
                    }
                }
            }
        }
    }

    fun selectGatewayMode(mode: GatewayExecutionMode) {
        _uiState.update { it.copy(gatewayMode = mode, requestState = RequestUiState.Idle) }
    }

    fun selectPreferredAgent(agentId: String?) {
        _uiState.update { it.copy(preferredAgent = agentId) }
    }

    fun setUseSentinel(enabled: Boolean) {
        _uiState.update { it.copy(useSentinelVerification = enabled) }
    }

    fun startNewConversation() {
        _uiState.update {
            it.copy(activeConversationId = null, requestState = RequestUiState.Idle)
        }
    }

    fun selectConversation(conversationId: String) {
        _uiState.update {
            it.copy(activeConversationId = conversationId, requestState = RequestUiState.Idle)
        }
    }

    fun dismissRequestBanner() {
        _uiState.update { it.copy(requestState = RequestUiState.Idle) }
    }

    fun sendMessage(rawPrompt: String) {
        val trimmed = rawPrompt.trim()
        if (trimmed.isEmpty()) {
            _uiState.update {
                it.copy(
                    requestState = RequestUiState.SanitizedError(
                        code = "EMPTY_PROMPT",
                        message = "Enter a prompt before sending.",
                        retryable = false
                    )
                )
            }
            return
        }

        if (LocalSecretScanner.containsSecret(trimmed)) {
            _uiState.update {
                it.copy(
                    requestState = RequestUiState.SanitizedError(
                        code = "SECRET_BLOCKED",
                        message = "Security guardrail: API keys and private keys are blocked from leaving your device.",
                        retryable = false
                    )
                )
            }
            return
        }

        if (!connectivityMonitor.checkCurrentlyConnected()) {
            _uiState.update {
                it.copy(
                    isDeviceOnline = false,
                    requestState = RequestUiState.Offline(
                        detail = "Device is offline. Reconnect and tap Retry to send your prompt.",
                        pendingPrompt = trimmed
                    )
                )
            }
            return
        }

        val currentState = _uiState.value
        val conversationId = currentState.activeConversationId ?: "conv-${UUID.randomUUID()}"
        val priorHistory = currentState.conversations
            .firstOrNull { it.id == conversationId }
            ?.messages
            .orEmpty()
            .takeLast(8)
            .map { ChatHistoryTurnDto(role = it.role, content = it.content) }

        val userMessage = LocalChatMessage(
            id = "msg-${UUID.randomUUID()}",
            role = "user",
            content = trimmed,
            createdAtEpochMs = System.currentTimeMillis()
        )
        val afterUserAppend = privateStore.appendMessage(conversationId, userMessage)

        _uiState.update {
            it.copy(
                conversations = afterUserAppend,
                activeConversationId = conversationId,
                requestState = RequestUiState.Loading(
                    stageDescription = if (it.gatewayMode == GatewayExecutionMode.FIREBASE_AI_LOGIC_DIRECT) {
                        "Verifying Play Integrity App Check & calling Firebase AI Logic..."
                    } else {
                        "Routing via Vaelor Orchestrator & Sentinel Verification..."
                    }
                )
            )
        }

        viewModelScope.launch {
            if (_uiState.value.gatewayMode == GatewayExecutionMode.FIREBASE_AI_LOGIC_DIRECT) {
                val directResult = firebaseGateway.generateDirectPromptIfConfigured(trimmed)
                directResult.fold(
                    onSuccess = { replyText ->
                        val assistantMsg = LocalChatMessage(
                            id = "msg-${UUID.randomUUID()}",
                            role = "assistant",
                            content = replyText,
                            agentName = "Firebase AI Logic (App Check)",
                            sentinelStatus = "client-direct",
                            createdAtEpochMs = System.currentTimeMillis()
                        )
                        val updated = privateStore.appendMessage(conversationId, assistantMsg)
                        _uiState.update {
                            it.copy(conversations = updated, requestState = RequestUiState.Idle)
                        }
                    },
                    onFailure = { err ->
                        _uiState.update {
                            it.copy(
                                requestState = RequestUiState.SanitizedError(
                                    code = "FIREBASE_AI_UNCONFIGURED",
                                    message = err.message
                                        ?: "Firebase AI Logic requires google-services.json and App Check.",
                                    retryable = false
                                )
                            )
                        }
                    }
                )
            } else {
                val requestDto = ChatRequestDto(
                    message = trimmed,
                    history = priorHistory,
                    preferredAgent = currentState.preferredAgent,
                    useSentinel = currentState.useSentinelVerification,
                    conversationId = conversationId
                )

                when (val outcome = backendClient.sendChatMessage(requestDto)) {
                    is BackendCallOutcome.Success -> {
                        val run = outcome.data.taskRun
                        val assistantMsg = LocalChatMessage(
                            id = "msg-${UUID.randomUUID()}",
                            role = "assistant",
                            content = outcome.data.reply,
                            agentName = run?.agentName ?: "Vaelor Core",
                            sentinelStatus = run?.sentinelReview?.status,
                            citations = run?.citations.orEmpty(),
                            createdAtEpochMs = System.currentTimeMillis()
                        )
                        val updated = privateStore.appendMessage(conversationId, assistantMsg)
                        _uiState.update {
                            it.copy(conversations = updated, requestState = RequestUiState.Idle)
                        }
                    }
                    is BackendCallOutcome.Failure -> {
                        _uiState.update { it.copy(requestState = outcome.state) }
                    }
                }
            }
        }
    }

    fun deleteSingleConversation(conversationId: String) {
        val remaining = privateStore.deleteConversation(conversationId)
        _uiState.update { current ->
            val nextActive = if (current.activeConversationId == conversationId) {
                remaining.firstOrNull()?.id
            } else {
                current.activeConversationId
            }
            current.copy(conversations = remaining, activeConversationId = nextActive)
        }
    }

    fun wipeAllPrivateChatHistory() {
        val empty = privateStore.wipeAllPrivateHistory()
        _uiState.update {
            it.copy(
                conversations = empty,
                activeConversationId = null,
                requestState = RequestUiState.Idle
            )
        }
        viewModelScope.launch {
            backendClient.purgeServerSession()
        }
    }

    fun updateBackendBaseUrl(newUrl: String): Result<Unit> {
        return try {
            val updatedClient = VaelorBackendClient(
                baseUrl = newUrl,
                allowLoopbackHttp = BuildConfig.ALLOW_DEBUG_EMULATOR_HTTP
            )
            backendClient = updatedClient
            _uiState.update { it.copy(backendBaseUrl = newUrl.trim().trimEnd('/')) }
            refreshBackendHealth()
            Result.success(Unit)
        } catch (e: IllegalArgumentException) {
            Result.failure(e)
        }
    }

    fun evaluateLocalMath(expression: String) {
        val resultText = try {
            val value = SafeMathEvaluator.evaluate(expression)
            "Result: $value"
        } catch (e: IllegalArgumentException) {
            "Validation error: ${e.message}"
        }
        _uiState.update { it.copy(mathInput = expression, mathResultText = resultText) }
    }

    fun updateTrustGridInput(updated: TrustGridEngine.EvaluationInput) {
        _uiState.update {
            it.copy(
                trustGridInput = updated,
                trustGridResult = TrustGridEngine.evaluate(updated)
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        connectivityMonitor.unregister()
    }

    companion object {
        fun computeHonestCapabilities(
            firebaseConfigured: Boolean,
            health: HealthStatusDto?
        ): List<HonestCapabilityItem> {
            return listOf(
                HonestCapabilityItem(
                    name = "Secure Multi-Agent Backend Orchestration",
                    status = if (health?.configured == true) {
                        FeatureAvailabilityStatus.AVAILABLE
                    } else {
                        FeatureAvailabilityStatus.UNAVAILABLE_REQUIRES_CONFIG
                    },
                    summary = if (health?.configured == true) {
                        "Connected to server-side Gemini gateway (${health.primaryModel ?: "gemini-3.1-flash-lite"}) with Sentinel audit and ${health.rateLimitPerMinute}/min rate limit."
                    } else {
                        "Requires reachable HTTPS backend with server-side GEMINI_API_KEY configured."
                    }
                ),
                HonestCapabilityItem(
                    name = "Firebase AI Logic + Play Integrity App Check",
                    status = if (firebaseConfigured) {
                        FeatureAvailabilityStatus.AVAILABLE
                    } else {
                        FeatureAvailabilityStatus.UNAVAILABLE_REQUIRES_CONFIG
                    },
                    summary = if (firebaseConfigured) {
                        "Firebase project detected; Play Integrity App Check provider installed."
                    } else {
                        "Unavailable until google-services.json and Play Integrity App Check are added to android/app/. Never faked."
                    }
                ),
                HonestCapabilityItem(
                    name = "Private On-Device Chat History & Wipe",
                    status = FeatureAvailabilityStatus.AVAILABLE,
                    summary = "Stored strictly inside sandboxed internal filesDir with cloud auto-backup disabled and instant local deletion."
                ),
                HonestCapabilityItem(
                    name = "Aurenyx TrustGrid Provisional Risk Scorer",
                    status = FeatureAvailabilityStatus.AVAILABLE,
                    summary = "Works 100% offline using transparent TG-PROVISIONAL-0.1 point rules and Critical Review Flags."
                ),
                HonestCapabilityItem(
                    name = "Deterministic Safe Calculator & Secret Scanner",
                    status = FeatureAvailabilityStatus.AVAILABLE,
                    summary = "Zero-eval recursive-descent math parser and client-side API key leak blocker."
                ),
                HonestCapabilityItem(
                    name = "Live Web Search & External Citations",
                    status = if (health?.liveSearchConfigured == true) {
                        FeatureAvailabilityStatus.AVAILABLE
                    } else {
                        FeatureAvailabilityStatus.UNAVAILABLE_REQUIRES_CONFIG
                    },
                    summary = if (health?.liveSearchConfigured == true) {
                        "Authorized search connector enabled on backend."
                    } else {
                        "Unavailable: SEARCH_API_KEY is not configured on backend. Live browsing and external citations are never fabricated."
                    }
                ),
                HonestCapabilityItem(
                    name = "Cross-Device Cloud Sync & Server Database",
                    status = FeatureAvailabilityStatus.UNAVAILABLE_REQUIRES_CONFIG,
                    summary = "Unavailable in v0.1: Chat history stays private on-device rather than syncing to external cloud storage."
                )
            )
        }
    }
}
