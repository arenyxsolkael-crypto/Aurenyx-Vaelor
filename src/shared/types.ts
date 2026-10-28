export const OFFICIAL_ATTRIBUTION = {
  productName: 'AURENYX VAELOR',
  version: '0.3',
  releaseTitle: 'The Autonomous Intelligence Upgrade',
  tagline: 'Intelligence, Orchestrated.',
  secondaryBrandLine: 'One Vision. Multiple Intelligences. A New Frontier.',
  category: 'General-Purpose AI Assistant and Intelligent Workflow Platform',
  founderOrganization: 'The Aether Vanguard',
  founderName: 'Arenyx Sol Kael',
  statement: 'AURENYX VAELOR — Founded by The Aether Vanguard, founded by Arenyx Sol Kael.',
  aboutStatement:
    'AURENYX VAELOR was founded by The Aether Vanguard, founded by Arenyx Sol Kael, with the goal of building an accessible, modular, and intelligent AI platform capable of assisting with reasoning, research, creation, engineering, and structured workflows.',
  footerLines: [
    'AURENYX VAELOR',
    'An intelligent platform by The Aether Vanguard.',
    'Founded by The Aether Vanguard, founded by Arenyx Sol Kael.',
  ],
} as const;

export type AgentId =
  | 'vaelor-core'
  | 'aurenyx-research'
  | 'vaelor-forge'
  | 'vaelor-analyst'
  | 'vaelor-knowledge'
  | 'vaelor-sentinel';

export type TaskType =
  | 'general'
  | 'reasoning'
  | 'tutoring'
  | 'coding'
  | 'research'
  | 'writing'
  | 'analysis'
  | 'structured_data'
  | 'knowledge'
  | 'creative'
  | 'relationship_health_edu'
  | 'verification'
  | 'tool_assisted';

export type ResponseTone = 'balanced' | 'professional' | 'friendly' | 'academic' | 'direct';

export type ResponseLength = 'concise' | 'standard' | 'detailed';

export type SentinelVerificationStatus =
  | 'verified_evidence'
  | 'partially_verified'
  | 'unverified'
  | 'verification_unavailable';

export type ResearchStatus =
  | 'search_available'
  | 'research_completed'
  | 'partial_results'
  | 'search_unavailable'
  | 'verification_incomplete';

export type TaskLifecycleStage =
  | 'DRAFT'
  | 'PLAN'
  | 'APPROVAL_REQUIRED'
  | 'EXECUTE_TOOLS'
  | 'VERIFY'
  | 'COMPLETED'
  | 'FAILED';

export type ExecutionStatus =
  | 'draft'
  | 'queued'
  | 'classifying'
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed';

export type ToolStage = 'A' | 'B' | 'C' | 'D';

export type ToolAvailability = 'available' | 'requires_config';

export type ToolName =
  | 'calculator'
  | 'datetime_utility'
  | 'text_summarizer'
  | 'text_transformer'
  | 'json_validator'
  | 'structured_formatter'
  | 'code_static_reviewer'
  | 'task_planner'
  | 'document_processor'
  | 'csv_analyzer'
  | 'research_framework'
  | 'chart_generator'
  | 'web_search_connector'
  | 'workflow_connector_gate';

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'text';
  sizeBytes: number;
  textContent?: string;
  base64Data?: string;
}

export interface AgentMetadata {
  id: AgentId;
  name: string;
  shortRole: string;
  description: string;
  responsibilities: string[];
  boundaries: string[];
  permittedTools: ToolName[];
}

export interface ToolSummaryMetadata {
  name: ToolName;
  stage: ToolStage;
  availability: ToolAvailability;
  requiresConfirmation: boolean;
  description: string;
  allowedAgents: AgentId[];
  timeoutMs: number;
  maxCallsPerTask?: number;
  errorStrategy?: string;
  outputSchemaSummary?: string;
  resultFormat: string;
  setupGuide?: string;
}

export interface ToolCallRecord {
  tool: ToolName | string;
  input: Record<string, unknown>;
  output: string;
  status: 'completed' | 'denied' | 'failed';
  durationMs: number;
  error?: string;
  svgArtifact?: string;
}

export interface CitationItem {
  id: string;
  sourceTitle: string;
  sourceType: 'document' | 'memory' | 'tool' | 'web';
  excerpt: string;
  url?: string;
  domain?: string;
  retrievedAt?: string;
  documentId?: string;
  chunkIndex?: number;
}

export interface SentinelCitationCheck {
  citationId?: string;
  url?: string;
  validSyntax: boolean;
  matchedRetrievedSource: boolean;
  note: string;
}

export interface SentinelReview {
  approved: boolean;
  status: 'verified' | 'flagged' | 'skipped';
  verificationStatus?: SentinelVerificationStatus;
  verificationLabel?: string;
  flags: string[];
  issues?: string[];
  unsupportedClaims?: string[];
  citationChecks?: SentinelCitationCheck[];
  requiredCorrections?: string[];
  verificationLimitations?: string[];
  summary: string;
  revised: boolean;
}

export interface TaskPlanRecord {
  goal: string;
  detectedCategories: TaskType[];
  selectedAgent: AgentId;
  requiresTools: boolean;
  permittedTools: ToolName[];
  selectedTools: ToolName[];
  isMultiStep: boolean;
  requiresExternalEvidence: boolean;
  completionCriteria: string;
  plannerSource: 'deterministic-schema' | 'fallback-direct';
}

export interface TaskErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
}

export interface StructuredTaskRun {
  taskId: string;
  title?: string;
  objective?: string;
  lifecycleStage?: TaskLifecycleStage;
  requiresApproval?: boolean;
  approvedByUser?: boolean;
  completedStages?: string[];
  failedStage?: string;
  nextSafeStep?: string;
  limitations?: string[];
  researchStatus?: ResearchStatus;
  researchStatusLabel?: string;
  taskType: TaskType;
  detectedCategories?: TaskType[];
  taskPlan?: TaskPlanRecord;
  userRequest: string;
  selectedAgent: AgentId;
  agentName: string;
  status: ExecutionStatus;
  permittedTools: ToolName[];
  planSteps: string[];
  stepCount: number;
  maxSteps: number;
  toolCalls: ToolCallRecord[];
  citations: CitationItem[];
  sentinelReview?: SentinelReview;
  promptInjectionFlagged: boolean;
  researchMode?: boolean;
  webSearchUsed?: boolean;
  tone?: ResponseTone;
  responseLength?: ResponseLength;
  mockMode?: boolean;
  isMockResponse?: boolean;
  contextTruncated?: boolean;
  totalHistoryTurns?: number;
  policyAction?: 'allowed' | 'educational_safe_framing' | 'refused_prohibited';
  attachmentNames?: string[];
  result?: string;
  modelUsed?: string;
  error?: TaskErrorInfo;
  projectId?: string;
  conversationId?: string;
  ownerSessionId?: string;
  createdAt: string;
  updatedAt?: string;
  durationMs: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  editedAt?: string;
  agentId?: AgentId;
  agentName?: string;
  taskRun?: StructuredTaskRun;
  failedPrompt?: string;
  error?: TaskErrorInfo;
  generatedSvgBlueprint?: string;
  attachments?: Pick<ChatAttachment, 'id' | 'name' | 'mimeType' | 'kind' | 'sizeBytes'>[];
  isStreaming?: boolean;
  isMockResponse?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  projectId?: string;
  archived?: boolean;
  ownerSessionId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedMemory {
  id: string;
  label: string;
  content: string;
  category: 'preference' | 'project-fact' | 'constraint' | 'note';
  ownerSessionId?: string;
  createdAt: string;
}

export interface DocumentChunk {
  id: string;
  index: number;
  text: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  fileName?: string;
  sourceKind: 'upload' | 'paste' | 'starter';
  charCount: number;
  wordCount: number;
  chunks: DocumentChunk[];
  ownerSessionId?: string;
  createdAt: string;
}

export interface ProjectTaskPlanItem {
  id: string;
  title: string;
  steps: string[];
  status: 'planned' | 'in_progress' | 'completed';
  createdAt: string;
}

export interface ProjectSummaryNote {
  id: string;
  title: string;
  summary: string;
  sourceConversationId?: string;
  approvedByUser: boolean;
  createdAt: string;
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  objective: string;
  description?: string;
  brief?: string;
  category: 'research' | 'software' | 'strategy' | 'documentation';
  status: 'active' | 'planning' | 'paused' | 'archived';
  ownerSessionId?: string;
  taskPlans?: ProjectTaskPlanItem[];
  summaries?: ProjectSummaryNote[];
  createdAt: string;
  updatedAt?: string;
}

export interface UsageMetadata {
  inputChars: number;
  outputChars: number;
  attachmentCount: number;
}

export interface AIRequest {
  systemInstruction: string;
  messages: { role: 'user' | 'model'; text: string }[];
  attachments?: ChatAttachment[];
  tier?: 'primary' | 'fast';
  temperature?: number;
  timeoutMs?: number;
  maxOutputChars?: number;
  mockMode?: boolean;
  bypassCache?: boolean;
  cacheScope?: string;
  signal?: AbortSignal;
}

export interface AIResponse {
  text: string;
  modelUsed: string;
  provider: string;
  isMockResponse?: boolean;
  cached?: boolean;
  usage: UsageMetadata;
}

export interface AIStreamEvent {
  type: 'stage' | 'delta' | 'complete' | 'error';
  stage?: string;
  delta?: string;
  reply?: string;
  modelUsed?: string;
  taskRun?: StructuredTaskRun;
  generatedSvgBlueprint?: string;
  error?: TaskErrorInfo;
}

export interface ModelCapabilities {
  provider: string;
  configured: boolean;
  primaryModel: string;
  fastModel: string;
  paidModelsEnabled: boolean;
  mockModeAvailable: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsStructuredJson: boolean;
  supportsImageGeneration: boolean;
  supportsLiveWebSearch: boolean;
  maxContextTurns: number;
  maxStepsPerRequest: number;
}

export interface WorkflowState {
  taskId: string;
  status: ExecutionStatus;
  stepCount: number;
  maxSteps: number;
  requiresConfirmation: boolean;
}

export interface HealthResponse {
  ok: boolean;
  version?: string;
  configured: boolean;
  provider: string;
  primaryModel?: string;
  fastModel?: string;
  paidModelsEnabled: boolean;
  liveSearchConfigured?: boolean;
  groundedSearchMode?: 'gemini-google-search' | 'external-search-key' | 'unavailable';
  mockModeDefault?: boolean;
  maxStepsPerRequest: number;
  maxConcurrentRequests?: number;
  rateLimitPerMinute: number;
  rateLimitNote?: string;
  authRequired?: boolean;
  firebaseProjectId?: string;
  storageMode: 'in-memory-ephemeral' | 'firestore-plus-session';
  storageNotice: string;
  attribution?: {
    productName: string;
    founderOrganization: string;
    founderName: string;
    statement: string;
  };
  counts: {
    conversations: number;
    memories: number;
    documents: number;
    projects: number;
    tasks: number;
  };
}

export interface AuthProviderStatusItem {
  id: 'google.com' | 'password' | 'emailLink' | 'apple.com' | 'github.com';
  label: string;
  status: 'configured' | 'console_enable_required' | 'planned_future';
  note: string;
}

export interface AuthConfigResponse {
  ok: boolean;
  authRequiredOnProtectedApis: boolean;
  firebaseConfigured: boolean;
  projectId: string;
  authDomain: string;
  firestoreDatabaseId: string;
  providers: AuthProviderStatusItem[];
  recommendedAuthorizedDomains: string[];
}

export interface AuthenticatedAccountSummary {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  signInProvider: string;
  geminiKeyExposedToUser: false;
  counts: {
    projects: number;
    conversations: number;
    documents: number;
    memories: number;
    tasks: number;
  };
}

export type ImageAspectRatio =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '9:16'
  | '16:9'
  | '21:9';

export type ImageResolutionSize = '1K' | '2K' | '4K';

export interface EvaluationPromptCase {
  id: string;
  category:
    | 'ordinary'
    | 'research'
    | 'coding'
    | 'document'
    | 'calculator'
    | 'verification'
    | 'security'
    | 'validation'
    | 'education';
  title: string;
  prompt: string;
  expectedBehavior: string;
  expectedAgent?: AgentId;
}
