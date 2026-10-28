import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 8000;
export const MAX_HISTORY_ITEMS = 24;
export const MAX_CONTEXT_WINDOW_TURNS = 8;
export const MAX_DOCUMENT_LENGTH = 60000;
export const MAX_MEMORY_LENGTH = 1200;
export const MAX_ATTACHMENT_TEXT_LENGTH = 30000;
export const MAX_ATTACHMENT_BASE64_LENGTH = 1_400_000;

export const AgentIdSchema = z.enum([
  'vaelor-core',
  'aurenyx-research',
  'vaelor-forge',
  'vaelor-analyst',
  'vaelor-knowledge',
  'vaelor-sentinel',
]);

export const ResponseToneSchema = z.enum([
  'balanced',
  'professional',
  'friendly',
  'academic',
  'direct',
]);

export const ResponseLengthSchema = z.enum(['concise', 'standard', 'detailed']);

export const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export const SAFE_TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'text/x-python',
  'text/html',
  'text/css',
  'application/xml',
  'text/xml',
]);

export const ChatAttachmentSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(160),
    mimeType: z.string().trim().min(3).max(80),
    kind: z.enum(['image', 'text']),
    sizeBytes: z.number().int().min(1).max(1_048_576),
    textContent: z.string().max(MAX_ATTACHMENT_TEXT_LENGTH).optional(),
    base64Data: z
      .string()
      .max(MAX_ATTACHMENT_BASE64_LENGTH)
      .regex(/^[A-Za-z0-9+/=\s]*$/, 'Invalid base64 encoding.')
      .optional(),
  })
  .superRefine((att, ctx) => {
    const normalizedMime = att.mimeType.toLowerCase();
    if (att.kind === 'image') {
      if (!SAFE_IMAGE_MIME_TYPES.has(normalizedMime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsupported image MIME type "${att.mimeType}". Allowed: PNG, JPEG, WEBP, GIF.`,
          path: ['mimeType'],
        });
      }
      if (!att.base64Data || att.base64Data.trim().length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Image attachment requires valid base64Data.',
          path: ['base64Data'],
        });
      }
    } else {
      if (!SAFE_TEXT_MIME_TYPES.has(normalizedMime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsupported text attachment MIME type "${att.mimeType}".`,
          path: ['mimeType'],
        });
      }
    }
  });

export const ChatMessageInputSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(MAX_MESSAGE_LENGTH),
});

export const ChatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(
      MAX_MESSAGE_LENGTH,
      `Message exceeds the ${MAX_MESSAGE_LENGTH.toLocaleString()}-character limit.`
    ),
  conversationId: z.string().trim().max(120).optional(),
  projectId: z.string().trim().max(120).optional(),
  preferredAgent: AgentIdSchema.optional(),
  useSentinel: z.boolean().optional().default(true),
  researchMode: z.boolean().optional().default(false),
  tone: ResponseToneSchema.optional().default('balanced'),
  responseLength: ResponseLengthSchema.optional().default('standard'),
  mockMode: z.boolean().optional().default(false),
  bypassCache: z.boolean().optional().default(false),
  requestedTools: z.array(z.string().trim().max(64)).max(5).optional(),
  attachments: z.array(ChatAttachmentSchema).max(2).optional().default([]),
  history: z.array(ChatMessageInputSchema).max(MAX_HISTORY_ITEMS).optional().default([]),
});

export const StoredChatMessageSchema = z.object({
  id: z.string().trim().min(1).max(120),
  role: z.enum(['user', 'assistant']),
  content: z.string().max(20000),
  createdAt: z.string().trim().min(4).max(64),
  editedAt: z.string().trim().max(64).optional(),
  agentId: AgentIdSchema.optional(),
  agentName: z.string().trim().max(120).optional(),
  isMockResponse: z.boolean().optional(),
});

export const ConversationSyncSchema = z.object({
  id: z.string().trim().min(2).max(120),
  title: z.string().trim().min(1).max(120),
  projectId: z.string().trim().max(120).optional(),
  archived: z.boolean().optional().default(false),
  messages: z.array(StoredChatMessageSchema).max(100).optional().default([]),
  createdAt: z.string().trim().max(64).optional(),
  updatedAt: z.string().trim().max(64).optional(),
});

export const ConversationPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  archived: z.boolean().optional(),
});

export const ToolDirectExecuteSchema = z.object({
  tool: z.enum([
    'calculator',
    'datetime_utility',
    'text_summarizer',
    'text_transformer',
    'json_validator',
    'structured_formatter',
    'code_static_reviewer',
    'task_planner',
    'csv_analyzer',
    'chart_generator',
    'document_processor',
    'research_framework',
    'web_search_connector',
    'workflow_connector_gate',
  ]),
  args: z.record(z.string(), z.unknown()),
  confirmedByUser: z.boolean().optional().default(false),
});

export const ProjectCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Project name must be at least 2 characters.')
    .max(80, 'Project name must be under 80 characters.'),
  objective: z
    .string()
    .trim()
    .min(4, 'Project objective must be at least 4 characters.')
    .max(600, 'Project objective must be under 600 characters.'),
  description: z.string().trim().max(800).optional(),
  brief: z.string().trim().max(2400).optional(),
  category: z.enum(['research', 'software', 'strategy', 'documentation']).default('software'),
});

export const ProjectUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  objective: z.string().trim().min(4).max(600).optional(),
  description: z.string().trim().max(800).optional(),
  brief: z.string().trim().max(2400).optional(),
  category: z.enum(['research', 'software', 'strategy', 'documentation']).optional(),
  status: z.enum(['active', 'planning', 'paused', 'archived']).optional(),
  addTaskPlan: z
    .object({
      title: z.string().trim().min(2).max(120),
      steps: z.array(z.string().trim().min(2).max(240)).min(1).max(8),
      status: z.enum(['planned', 'in_progress', 'completed']).optional().default('planned'),
    })
    .optional(),
  updateTaskPlanStatus: z
    .object({
      planId: z.string().trim().min(1).max(80),
      status: z.enum(['planned', 'in_progress', 'completed']),
    })
    .optional(),
  removeTaskPlanId: z.string().trim().min(1).max(80).optional(),
  addSummary: z
    .object({
      title: z.string().trim().min(2).max(120),
      summary: z.string().trim().min(4).max(1600),
      sourceConversationId: z.string().trim().max(120).optional(),
      approvedByUser: z.boolean().default(true),
    })
    .optional(),
  removeSummaryId: z.string().trim().min(1).max(80).optional(),
});

export const TaskWorkflowPlanSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Task title must be at least 2 characters.')
    .max(120, 'Task title must be under 120 characters.'),
  objective: z
    .string()
    .trim()
    .min(4, 'Task objective must be at least 4 characters.')
    .max(2000, 'Task objective must be under 2,000 characters.'),
  preferredAgent: AgentIdSchema.optional(),
  projectId: z.string().trim().max(120).optional(),
  researchMode: z.boolean().optional().default(false),
  requiresApproval: z.boolean().optional().default(false),
  requestedTools: z.array(z.string().trim().max(64)).max(5).optional().default([]),
});

export const TaskWorkflowExecuteSchema = z.object({
  confirmedByUser: z.boolean().optional().default(false),
  mockMode: z.boolean().optional().default(false),
  useSentinel: z.boolean().optional().default(true),
});

export const MemoryItemTypeSchema = z.enum([
  'note',
  'decision',
  'goal',
  'summary',
  'reference',
]);

export const MemoryCreateSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, 'Memory label must be at least 2 characters.')
    .max(80, 'Memory label must be under 80 characters.'),
  content: z
    .string()
    .trim()
    .min(2, 'Memory content cannot be empty.')
    .max(MAX_MEMORY_LENGTH, `Memory content must be under ${MAX_MEMORY_LENGTH} characters.`),
  category: z.enum(['preference', 'project-fact', 'constraint', 'note']).default('note'),
  memoryType: MemoryItemTypeSchema.optional().default('note'),
  projectId: z.string().trim().max(120).optional(),
  referenceUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (val) => !val || /^https?:\/\/[^\s]+$/i.test(val),
      'Reference URL must use http:// or https://.'
    )
    .optional(),
  approvedByUser: z.boolean().optional().default(true),
});

export const MemoryUpdateSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  content: z.string().trim().min(2).max(MAX_MEMORY_LENGTH).optional(),
  category: z.enum(['preference', 'project-fact', 'constraint', 'note']).optional(),
  memoryType: MemoryItemTypeSchema.optional(),
  projectId: z.string().trim().max(120).optional(),
  referenceUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (val) => !val || /^https?:\/\/[^\s]+$/i.test(val),
      'Reference URL must use http:// or https://.'
    )
    .optional(),
});

export const MemorySettingsSchema = z.object({
  globalEnabled: z.boolean().optional(),
  disabledProjectIds: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
});

export const DocumentIngestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Document title must be at least 2 characters.')
    .max(120, 'Document title must be under 120 characters.'),
  fileName: z.string().trim().max(160).optional(),
  sourceKind: z.enum(['upload', 'paste']).default('paste'),
  content: z
    .string()
    .trim()
    .min(10, 'Document text must contain at least 10 characters.')
    .max(
      MAX_DOCUMENT_LENGTH,
      `Document text exceeds the ${MAX_DOCUMENT_LENGTH.toLocaleString()}-character prototype limit.`
    ),
});

export const StudioVisualRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, 'Visual prompt must be at least 3 characters.')
    .max(2000, 'Visual prompt must be under 2,000 characters.'),
  aspectRatio: z
    .enum(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'])
    .default('16:9'),
  imageSize: z.enum(['1K', '2K', '4K']).default('1K'),
  qualityTier: z.enum(['general', 'studio']).default('studio'),
  generateFreeBlueprintFallback: z.boolean().optional().default(true),
});

export const MissionPlanSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Mission title must be at least 2 characters.')
    .max(120, 'Mission title must be under 120 characters.'),
  objective: z
    .string()
    .trim()
    .min(4, 'Mission objective must be at least 4 characters.')
    .max(2000, 'Mission objective must be under 2,000 characters.'),
  projectId: z.string().trim().max(120).optional(),
  preferredAgent: AgentIdSchema.optional(),
  requestedTools: z.array(z.string().trim().max(64)).max(5).optional().default([]),
  requireHumanApproval: z.boolean().optional().default(false),
  mockMode: z.boolean().optional().default(false),
  maxSteps: z.number().int().min(2).max(8).optional().default(5),
  maxRetries: z.number().int().min(0).max(2).optional().default(2),
  maxElapsedMs: z.number().int().min(5000).max(45000).optional().default(30000),
  maxModelCalls: z.number().int().min(1).max(4).optional().default(3),
});

export const MissionExecuteSchema = z.object({
  mockMode: z.boolean().optional(),
});

export const MissionControlSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
  z.object({ action: z.literal('cancel') }),
  z.object({
    action: z.literal('approve_task'),
    taskId: z.string().trim().min(1).max(64),
  }),
  z.object({
    action: z.literal('retry_task'),
    taskId: z.string().trim().min(1).max(64),
  }),
]);

export const DeepResearchRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(4, 'Research question must be at least 4 characters.')
    .max(1500, 'Research question must be under 1,500 characters.'),
  projectId: z.string().trim().max(120).optional(),
  mockMode: z.boolean().optional().default(false),
});

export const CouncilRoleIdSchema = z.enum([
  'researcher',
  'engineer',
  'strategist',
  'skeptical_reviewer',
]);

export const CouncilRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(4, 'Council deliberation prompt must be at least 4 characters.')
    .max(2000, 'Council prompt must be under 2,000 characters.'),
  projectId: z.string().trim().max(120).optional(),
  selectedRoles: z.array(CouncilRoleIdSchema).min(1).max(4).optional(),
  maxCallBudget: z.number().int().min(1).max(4).optional().default(4),
  maxCharsPerRole: z.number().int().min(400).max(2400).optional().default(1200),
  mockMode: z.boolean().optional().default(false),
});

export const CodingLabFileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'File name is required.')
    .max(80)
    .regex(/^[a-zA-Z0-9._/-]+$/, 'File name contains invalid path characters.')
    .refine((n) => !n.includes('..'), 'Path traversal is not permitted.'),
  language: z.string().trim().min(1).max(24).default('typescript'),
  content: z.string().max(30_000),
});

export const CodingLabRequestSchema = z.object({
  mode: z.enum(['inspect_and_review', 'generate_code', 'generate_test_plan']),
  prompt: z
    .string()
    .trim()
    .min(2, 'Coding Lab prompt must be at least 2 characters.')
    .max(2000, 'Coding Lab prompt must be under 2,000 characters.'),
  files: z.array(CodingLabFileSchema).max(8).optional().default([]),
  mockMode: z.boolean().optional().default(false),
});

const SECRET_PATTERNS: RegExp[] = [
  /\bAIza[0-9A-Za-z_-]{25,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bghp_[A-Za-z0-9]{25,}\b/,
  /\b(GEMINI_API_KEY|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*["']?[A-Za-z0-9_-]{12,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

export function detectSecretInText(input: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(input));
}

const PROMPT_INJECTION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|system|developer)\s+(instructions|prompts|rules)/i,
    reason: 'Attempted system instruction override',
  },
  {
    pattern:
      /\b(reveal|print|dump|output|expose|echo)\b.{0,40}\b(system\s+prompt|api[_\s-]?key|gemini_api_key|process\.env|environment\s+variables|secrets?)\b/i,
    reason: 'Attempted secret or system configuration exfiltration',
  },
  {
    pattern:
      /\b(grant|enable|unlock|escalate)\b.{0,35}\b(all\s+tools|shell|bash|sudo|admin|root|unrestricted)\b/i,
    reason: 'Attempted unauthorized tool or privilege escalation',
  },
  {
    pattern: /<\s*\/?\s*(system_instruction|developer_prompt|tool_override)\s*>/i,
    reason: 'Delimiter spoofing tag detected',
  },
];

export interface PromptInjectionAssessment {
  flagged: boolean;
  reasons: string[];
}

export function assessPromptInjection(text: string): PromptInjectionAssessment {
  const reasons: string[] = [];
  for (const item of PROMPT_INJECTION_PATTERNS) {
    if (item.pattern.test(text)) {
      reasons.push(item.reason);
    }
  }
  return {
    flagged: reasons.length > 0,
    reasons,
  };
}

export function wrapUntrustedData(label: string, content: string): string {
  const sanitized = content
    .replace(/<\/untrusted_data>/gi, '[escaped_closing_tag]')
    .slice(0, MAX_DOCUMENT_LENGTH);
  return `<untrusted_data source="${label.replace(/[^a-zA-Z0-9_-]/g, '_')}">\n${sanitized}\n</untrusted_data>`;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(options: { windowMs: number; maxRequests: number }) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  public check(
    key: string,
    now = Date.now()
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const timestamps = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (timestamps.length >= this.maxRequests) {
      const oldest = timestamps[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((this.windowMs - (now - oldest)) / 1000));
      this.hits.set(key, timestamps);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    timestamps.push(now);
    this.hits.set(key, timestamps);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - timestamps.length),
      retryAfterSeconds: 0,
    };
  }
}
