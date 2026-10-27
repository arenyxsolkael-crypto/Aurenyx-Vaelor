package org.aethervanguard.aurenyxvaelor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AddComment
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.aethervanguard.aurenyxvaelor.domain.TrustGridEngine
import org.aethervanguard.aurenyxvaelor.model.FeatureAvailabilityStatus
import org.aethervanguard.aurenyxvaelor.model.LocalChatMessage
import org.aethervanguard.aurenyxvaelor.model.OfficialAttribution
import org.aethervanguard.aurenyxvaelor.model.RequestUiState
import org.aethervanguard.aurenyxvaelor.ui.AurenyxVaelorTheme
import org.aethervanguard.aurenyxvaelor.ui.GatewayExecutionMode
import org.aethervanguard.aurenyxvaelor.ui.VaelorScreenState
import org.aethervanguard.aurenyxvaelor.ui.VaelorViewModel

private enum class MainTab(val label: String) {
    CHAT("Vaelor"),
    TRUSTGRID("TrustGrid"),
    CAPABILITIES("Status"),
    PRIVACY_ABOUT("Privacy")
}

class MainActivity : ComponentActivity() {

    private val viewModel: VaelorViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AurenyxVaelorTheme(darkTheme = true) {
                val state by viewModel.uiState.collectAsStateWithLifecycle()
                AurenyxVaelorAppScreen(
                    state = state,
                    onSendMessage = viewModel::sendMessage,
                    onNewConversation = viewModel::startNewConversation,
                    onSelectConversation = viewModel::selectConversation,
                    onDeleteConversation = viewModel::deleteSingleConversation,
                    onWipeAllHistory = viewModel::wipeAllPrivateChatHistory,
                    onSelectAgent = viewModel::selectPreferredAgent,
                    onToggleSentinel = viewModel::setUseSentinel,
                    onSelectGatewayMode = viewModel::selectGatewayMode,
                    onDismissBanner = viewModel::dismissRequestBanner,
                    onRefreshHealth = viewModel::refreshBackendHealth,
                    onUpdateTrustGrid = viewModel::updateTrustGridInput,
                    onEvaluateMath = viewModel::evaluateLocalMath,
                    onUpdateBackendUrl = viewModel::updateBackendBaseUrl
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AurenyxVaelorAppScreen(
    state: VaelorScreenState,
    onSendMessage: (String) -> Unit,
    onNewConversation: () -> Unit,
    onSelectConversation: (String) -> Unit,
    onDeleteConversation: (String) -> Unit,
    onWipeAllHistory: () -> Unit,
    onSelectAgent: (String?) -> Unit,
    onToggleSentinel: (Boolean) -> Unit,
    onSelectGatewayMode: (GatewayExecutionMode) -> Unit,
    onDismissBanner: () -> Unit,
    onRefreshHealth: () -> Unit,
    onUpdateTrustGrid: (TrustGridEngine.EvaluationInput) -> Unit,
    onEvaluateMath: (String) -> Unit,
    onUpdateBackendUrl: (String) -> Result<Unit>
) {
    var activeTab by rememberSaveable { mutableStateOf(MainTab.CHAT) }
    var confirmWipeAll by rememberSaveable { mutableStateOf(false) }

    if (confirmWipeAll) {
        AlertDialog(
            onDismissRequest = { confirmWipeAll = false },
            title = { Text("Delete all private history?") },
            text = {
                Text(
                    "This permanently deletes every local conversation stored on this Android device and requests ephemeral server session purge. This cannot be undone."
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onWipeAllHistory()
                        confirmWipeAll = false
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Delete Everything")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { confirmWipeAll = false },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = OfficialAttribution.PRODUCT_NAME,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = OfficialAttribution.TAGLINE,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = onNewConversation,
                        modifier = Modifier
                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                            .semantics { contentDescription = "Start new private conversation" }
                    ) {
                        Icon(Icons.Default.AddComment, contentDescription = null)
                    }
                    IconButton(
                        onClick = { confirmWipeAll = true },
                        modifier = Modifier
                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                            .semantics { contentDescription = "Delete all private chat history" }
                    ) {
                        Icon(
                            Icons.Default.DeleteForever,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = activeTab == MainTab.CHAT,
                    onClick = { activeTab = MainTab.CHAT },
                    icon = { Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null) },
                    label = { Text(MainTab.CHAT.label) }
                )
                NavigationBarItem(
                    selected = activeTab == MainTab.TRUSTGRID,
                    onClick = { activeTab = MainTab.TRUSTGRID },
                    icon = { Icon(Icons.Default.VerifiedUser, contentDescription = null) },
                    label = { Text(MainTab.TRUSTGRID.label) }
                )
                NavigationBarItem(
                    selected = activeTab == MainTab.CAPABILITIES,
                    onClick = { activeTab = MainTab.CAPABILITIES },
                    icon = { Icon(Icons.Default.Info, contentDescription = null) },
                    label = { Text(MainTab.CAPABILITIES.label) }
                )
                NavigationBarItem(
                    selected = activeTab == MainTab.PRIVACY_ABOUT,
                    onClick = { activeTab = MainTab.PRIVACY_ABOUT },
                    icon = { Icon(Icons.Default.Security, contentDescription = null) },
                    label = { Text(MainTab.PRIVACY_ABOUT.label) }
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            RequestStateBanner(
                requestState = state.requestState,
                onRetry = { prompt -> onSendMessage(prompt) },
                onDismiss = onDismissBanner
            )

            when (activeTab) {
                MainTab.CHAT -> ChatWorkspaceTab(
                    state = state,
                    onSendMessage = onSendMessage,
                    onSelectAgent = onSelectAgent,
                    onToggleSentinel = onToggleSentinel,
                    onSelectConversation = onSelectConversation,
                    onDeleteConversation = onDeleteConversation,
                    onEvaluateMath = onEvaluateMath
                )
                MainTab.TRUSTGRID -> TrustGridScorerTab(
                    input = state.trustGridInput,
                    result = state.trustGridResult,
                    onUpdateInput = onUpdateTrustGrid
                )
                MainTab.CAPABILITIES -> CapabilitiesStatusTab(
                    state = state,
                    onRefreshHealth = onRefreshHealth,
                    onSelectGatewayMode = onSelectGatewayMode
                )
                MainTab.PRIVACY_ABOUT -> PrivacyAndAttributionTab(
                    state = state,
                    onRequestWipeAll = { confirmWipeAll = true },
                    onUpdateBackendUrl = onUpdateBackendUrl
                )
            }
        }
    }
}

@Composable
private fun RequestStateBanner(
    requestState: RequestUiState,
    onRetry: (String) -> Unit,
    onDismiss: () -> Unit
) {
    when (requestState) {
        is RequestUiState.Idle -> Unit
        is RequestUiState.Loading -> {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.5.dp
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        text = requestState.stageDescription,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
        is RequestUiState.Offline -> {
            StatusCalloutCard(
                title = "Offline Mode",
                body = requestState.detail,
                borderColor = Color(0xFFFFD37A),
                icon = { Icon(Icons.Default.WifiOff, contentDescription = null, tint = Color(0xFFFFD37A)) },
                retryPrompt = requestState.pendingPrompt,
                onRetry = onRetry,
                onDismiss = onDismiss
            )
        }
        is RequestUiState.Timeout -> {
            StatusCalloutCard(
                title = "Request Timed Out (${requestState.timeoutSeconds}s)",
                body = "The model gateway did not finish within ${requestState.timeoutSeconds} seconds. Your private history is intact.",
                borderColor = Color(0xFFFFD37A),
                icon = { Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color(0xFFFFD37A)) },
                retryPrompt = requestState.retryPrompt.takeIf { it.isNotBlank() },
                onRetry = onRetry,
                onDismiss = onDismiss
            )
        }
        is RequestUiState.QuotaLimited -> {
            val waitHint = requestState.retryAfterSeconds?.let { " Retry after ~${it}s." }.orEmpty()
            StatusCalloutCard(
                title = "Free-Tier Quota / Rate Limit Reached",
                body = "${requestState.message}$waitHint",
                borderColor = Color(0xFFFFD37A),
                icon = { Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color(0xFFFFD37A)) },
                retryPrompt = requestState.retryPrompt.takeIf { it.isNotBlank() },
                onRetry = onRetry,
                onDismiss = onDismiss
            )
        }
        is RequestUiState.SanitizedError -> {
            StatusCalloutCard(
                title = "Request Notice (${requestState.code})",
                body = requestState.message,
                borderColor = MaterialTheme.colorScheme.error,
                icon = {
                    Icon(
                        Icons.Default.ErrorOutline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                },
                retryPrompt = if (requestState.retryable) requestState.retryPrompt else null,
                onRetry = onRetry,
                onDismiss = onDismiss
            )
        }
    }
}

@Composable
private fun StatusCalloutCard(
    title: String,
    body: String,
    borderColor: Color,
    icon: @Composable () -> Unit,
    retryPrompt: String?,
    onRetry: (String) -> Unit,
    onDismiss: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        border = BorderStroke(1.dp, borderColor.copy(alpha = 0.65f)),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                icon()
                Spacer(Modifier.width(10.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Dismiss")
                }
            }
            Text(
                text = body,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (!retryPrompt.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = { onRetry(retryPrompt) },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Retry Request")
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChatWorkspaceTab(
    state: VaelorScreenState,
    onSendMessage: (String) -> Unit,
    onSelectAgent: (String?) -> Unit,
    onToggleSentinel: (Boolean) -> Unit,
    onSelectConversation: (String) -> Unit,
    onDeleteConversation: (String) -> Unit,
    onEvaluateMath: (String) -> Unit
) {
    var draftPrompt by rememberSaveable { mutableStateOf("") }
    var showLocalMath by rememberSaveable { mutableStateOf(false) }
    val activeConv = state.activeConversation
    val isBusy = state.requestState is RequestUiState.Loading

    val agentChoices = listOf(
        null to "Auto Route",
        "aurenyx-research" to "Research",
        "vaelor-forge" to "Forge (Code)",
        "vaelor-knowledge" to "Knowledge",
        "vaelor-sentinel" to "Sentinel"
    )

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = "Specialist Routing & Sentinel",
                            style = MaterialTheme.typography.labelLarge,
                            modifier = Modifier.semantics { heading() }
                        )
                        Spacer(Modifier.height(8.dp))
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            agentChoices.forEach { (id, label) ->
                                FilterChip(
                                    selected = state.preferredAgent == id,
                                    onClick = { onSelectAgent(id) },
                                    label = { Text(label) },
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                )
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Vaelor Sentinel Verification Pass",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Switch(
                                checked = state.useSentinelVerification,
                                onCheckedChange = onToggleSentinel,
                                modifier = Modifier.semantics {
                                    contentDescription = "Toggle Vaelor Sentinel verification pass"
                                }
                            )
                        }
                        TextButton(
                            onClick = { showLocalMath = !showLocalMath },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        ) {
                            Text(if (showLocalMath) "Hide Offline Safe Calculator" else "Open Offline Safe Calculator")
                        }
                        if (showLocalMath) {
                            var expr by rememberSaveable { mutableStateOf(state.mathInput) }
                            OutlinedTextField(
                                value = expr,
                                onValueChange = { expr = it },
                                label = { Text("Arithmetic expression (zero-eval)") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
                            )
                            Spacer(Modifier.height(6.dp))
                            OutlinedButton(
                                onClick = { onEvaluateMath(expr) },
                                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                            ) {
                                Text("Evaluate Offline")
                            }
                            state.mathResultText?.let { res ->
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = res,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.secondary
                                )
                            }
                        }
                    }
                }
            }

            if (state.conversations.size > 1) {
                item {
                    Text(
                        text = "Private On-Device Threads (${state.conversations.size})",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        state.conversations.take(5).forEach { conv ->
                            AssistChip(
                                onClick = { onSelectConversation(conv.id) },
                                label = { Text(conv.title.take(22)) },
                                trailingIcon = {
                                    IconButton(
                                        onClick = { onDeleteConversation(conv.id) },
                                        modifier = Modifier
                                            .size(28.dp)
                                            .semantics {
                                                contentDescription = "Delete conversation ${conv.title}"
                                            }
                                    ) {
                                        Icon(
                                            Icons.Default.DeleteOutline,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            )
                        }
                    }
                }
            }

            if (activeConv == null || activeConv.messages.isEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface
                        ),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Private Workspace Ready",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = "Ask a reasoning, coding, planning, or analytical question. Prompts are validated, API keys are never embedded in this APK, and history stays private in sandboxed device storage.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            } else {
                items(activeConv.messages, key = { it.id }) { msg ->
                    ChatMessageBubble(msg)
                }
            }
        }

        Surface(
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 3.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = draftPrompt,
                    onValueChange = { draftPrompt = it },
                    placeholder = { Text("Ask Aurenyx Vaelor...") },
                    modifier = Modifier.weight(1f),
                    maxLines = 4
                )
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = {
                        val toSend = draftPrompt
                        if (toSend.isNotBlank()) {
                            draftPrompt = ""
                            onSendMessage(toSend)
                        }
                    },
                    enabled = !isBusy && draftPrompt.isNotBlank(),
                    modifier = Modifier
                        .defaultMinSize(minWidth = 52.dp, minHeight = 52.dp)
                        .semantics { contentDescription = "Send prompt" }
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
                }
            }
        }
    }
}

@Composable
private fun ChatMessageBubble(message: LocalChatMessage) {
    val isUser = message.role == "user"
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isUser) {
                MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)
            } else {
                MaterialTheme.colorScheme.surface
            }
        ),
        border = BorderStroke(
            1.dp,
            if (isUser) MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)
            else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = if (isUser) "You" else (message.agentName ?: "Vaelor"),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary
                )
                message.sentinelStatus?.let { status ->
                    Text(
                        text = "Sentinel: $status",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(Modifier.height(6.dp))
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodyMedium
            )
            if (message.citations.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Verified Document Citations (${message.citations.size})",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold
                )
                message.citations.forEach { cite ->
                    Text(
                        text = "• ${cite.sourceTitle}: ${cite.excerpt.take(120)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TrustGridScorerTab(
    input: TrustGridEngine.EvaluationInput,
    result: TrustGridEngine.EvaluationOutput,
    onUpdateInput: (TrustGridEngine.EvaluationInput) -> Unit
) {
    val bandColor = when (result.riskBand) {
        "Critical" -> Color(0xFFFF7B8B)
        "High" -> Color(0xFFFFD37A)
        "Moderate" -> Color(0xFF35C8FF)
        else -> Color(0xFF42D6A4)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1B30)),
            border = BorderStroke(1.dp, bandColor.copy(alpha = 0.65f))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "${OfficialAttribution.TRUSTGRID_NAME} • ${result.methodologyVersion}",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF35C8FF)
                )
                Text(
                    text = OfficialAttribution.TRUSTGRID_HEADLINE,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF3F7FF)
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Provisional Risk Band: ${result.riskBand} (${result.score} / 12 pts)",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = bandColor
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Provisional Risk Indicator only — structured heuristic documentation aid, not legal advice or regulatory certification.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFAEBFD4)
                )
                if (result.criticalReviewFlags.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    result.criticalReviewFlags.forEach { flag ->
                        Text(
                            text = "⚠ $flag",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFFFF7B8B)
                        )
                    }
                }
            }
        }

        OutlinedTextField(
            value = input.workflowName,
            onValueChange = { onUpdateInput(input.copy(workflowName = it)) },
            label = { Text("AI Workflow Name") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Text("1. Data Sensitivity", style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TrustGridEngine.DataSensitivity.entries.forEach { option ->
                FilterChip(
                    selected = input.dataSensitivity == option,
                    onClick = { onUpdateInput(input.copy(dataSensitivity = option)) },
                    label = { Text("${option.label} (+${option.points})") },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                )
            }
        }

        Text("2. Decision Autonomy", style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TrustGridEngine.Autonomy.entries.forEach { option ->
                FilterChip(
                    selected = input.autonomy == option,
                    onClick = { onUpdateInput(input.copy(autonomy = option)) },
                    label = { Text("${option.label} (+${option.points})") },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                )
            }
        }

        Text("3. Potential Failure Impact", style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TrustGridEngine.Impact.entries.forEach { option ->
                FilterChip(
                    selected = input.impact == option,
                    onClick = { onUpdateInput(input.copy(impact = option)) },
                    label = { Text("${option.label} (+${option.points})") },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                )
            }
        }

        Text("4. Audit Logging Coverage", style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TrustGridEngine.Logging.entries.forEach { option ->
                FilterChip(
                    selected = input.logging == option,
                    onClick = { onUpdateInput(input.copy(logging = option)) },
                    label = { Text("${option.label} (+${option.points})") },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                )
            }
        }

        Text("5. Human Approval Gate", style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TrustGridEngine.Approval.entries.forEach { option ->
                FilterChip(
                    selected = input.approval == option,
                    onClick = { onUpdateInput(input.copy(approval = option)) },
                    label = { Text("${option.label} (+${option.points})") },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Accepts external or untrusted user input (+1)")
            Switch(
                checked = input.externalUntrustedInput,
                onCheckedChange = { onUpdateInput(input.copy(externalUntrustedInput = it)) }
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Missing stop / rollback procedure (+1)")
            Switch(
                checked = input.missingRollbackProcedure,
                onCheckedChange = { onUpdateInput(input.copy(missingRollbackProcedure = it)) }
            )
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(
                    text = "Transparent Rule Breakdown",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(6.dp))
                result.breakdown.forEach { line ->
                    Text(
                        text = "• $line",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun CapabilitiesStatusTab(
    state: VaelorScreenState,
    onRefreshHealth: () -> Unit,
    onSelectGatewayMode: (GatewayExecutionMode) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Honest Capability & Gateway Audit",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.semantics { heading() }
            )
            OutlinedButton(
                onClick = onRefreshHealth,
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text("Check")
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(
                    text = "Model Gateway Path",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = state.gatewayMode == GatewayExecutionMode.SECURE_BACKEND_ORCHESTRATOR,
                        onClick = { onSelectGatewayMode(GatewayExecutionMode.SECURE_BACKEND_ORCHESTRATOR) },
                        label = { Text("Secure Backend") },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    )
                    FilterChip(
                        selected = state.gatewayMode == GatewayExecutionMode.FIREBASE_AI_LOGIC_DIRECT,
                        onClick = { onSelectGatewayMode(GatewayExecutionMode.FIREBASE_AI_LOGIC_DIRECT) },
                        label = { Text("Firebase AI Logic") },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = if (state.firebaseAiConfigured) {
                        "Firebase AI Logic + Play Integrity App Check is configured."
                    } else {
                        "Note: google-services.json is not bundled in source control. Selecting Firebase AI Logic without configuring Firebase will honestly report UNAVAILABLE rather than faking responses."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        state.capabilities.forEach { item ->
            val available = item.status == FeatureAvailabilityStatus.AVAILABLE
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(
                    1.dp,
                    if (available) Color(0xFF42D6A4).copy(alpha = 0.45f)
                    else Color(0xFFFFD37A).copy(alpha = 0.45f)
                )
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (available) Icons.Default.CheckCircle else Icons.Default.Info,
                            contentDescription = null,
                            tint = if (available) Color(0xFF42D6A4) else Color(0xFFFFD37A)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = item.name,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = item.summary,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun PrivacyAndAttributionTab(
    state: VaelorScreenState,
    onRequestWipeAll: () -> Unit,
    onUpdateBackendUrl: (String) -> Result<Unit>
) {
    var endpointDraft by rememberSaveable { mutableStateOf(state.backendBaseUrl) }
    var endpointFeedback by rememberSaveable { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = OfficialAttribution.STATEMENT,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Application ID: org.aethervanguard.aurenyxvaelor • Version ${OfficialAttribution.VERSION}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Parent Ecosystem: AURENYX VÆLOR & AURENYX TRUSTGRID (“Intelligence. Integrity. Infinity.”)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Private Chat Storage & Deletion",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Saved conversations (${state.conversations.size}) live exclusively in your Android app sandbox (filesDir/private_conversations) with allowBackup=\"false\" and Android 12+ cloud extraction exclusions.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = onRequestWipeAll,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.DeleteForever, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Delete All Private History")
                }
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Secure Backend Endpoint (HTTPS Enforced)",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = endpointDraft,
                    onValueChange = { endpointDraft = it },
                    label = { Text("Orchestration Server URL") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = {
                        val res = onUpdateBackendUrl(endpointDraft)
                        endpointFeedback = res.fold(
                            onSuccess = { "Endpoint updated and validated." },
                            onFailure = { it.message ?: "Invalid URL." }
                        )
                    },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Save HTTPS Endpoint")
                }
                endpointFeedback?.let { msg ->
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = msg,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.secondary
                    )
                }
            }
        }
    }
}
