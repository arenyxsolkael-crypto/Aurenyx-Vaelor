export const OFFICIAL_ATTRIBUTION = {
  productName: 'AURENYX VAELOR',
  version: '0.1',
  tagline: 'Intelligence, Orchestrated.',
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
  | 'vaelor-knowledge'
  | 'vaelor-sentinel';

export type TaskType =
  | 'general'
  | 'research'
  | 'coding'
  | 'knowledge'
  | 'verification';

export type ExecutionStatus =
  | 'queued'
  | 'classifying'
  | 'planning'
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
  sourceType: 'document' | 'memory' | 'tool';
  excerpt: string;
  documentId?: string;
  chunkIndex?: number;
}

export interface SentinelReview {
  approved: boolean;
  status: 'verified' | 'flagged' | 'skipped';
  flags: string[];
  summary: string;
  revised: boolean;
}

export interface TaskErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
}

export interface StructuredTaskRun {
  taskId: string;
  taskType: TaskType;
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
  attachmentNames?: string[];
  result?: string;
  modelUsed?: string;
  error?: TaskErrorInfo;
  projectId?: string;
  conversationId?: string;
  createdAt: string;
  durationMs: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  agentId?: AgentId;
  agentName?: string;
  taskRun?: StructuredTaskRun;
  failedPrompt?: string;
  error?: TaskErrorInfo;
  generatedSvgBlueprint?: string;
  attachments?: Pick<ChatAttachment, 'id' | 'name' | 'mimeType' | 'kind' | 'sizeBytes'>[];
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  projectId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedMemory {
  id: string;
  label: string;
  content: string;
  category: 'preference' | 'project-fact' | 'constraint' | 'note';
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
  createdAt: string;
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  objective: string;
  category: 'research' | 'software' | 'strategy' | 'documentation';
  status: 'active' | 'planning' | 'paused';
  createdAt: string;
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
}

export interface AIResponse {
  text: string;
  modelUsed: string;
  provider: string;
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
  configured: boolean;
  provider: string;
  primaryModel?: string;
  fastModel?: string;
  paidModelsEnabled: boolean;
  liveSearchConfigured?: boolean;
  maxStepsPerRequest: number;
  rateLimitPerMinute: number;
  storageMode: 'in-memory-ephemeral';
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
    | 'validation';
  title: string;
  prompt: string;
  expectedBehavior: string;
  expectedAgent?: AgentId;
}
