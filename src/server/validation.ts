import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 8000;
export const MAX_HISTORY_ITEMS = 10;
export const MAX_DOCUMENT_LENGTH = 60000;
export const MAX_MEMORY_LENGTH = 1200;
export const MAX_ATTACHMENT_TEXT_LENGTH = 30000;
export const MAX_ATTACHMENT_BASE64_LENGTH = 1_400_000;

export const AgentIdSchema = z.enum([
  'vaelor-core',
  'aurenyx-research',
  'vaelor-forge',
  'vaelor-knowledge',
  'vaelor-sentinel',
]);

export const ChatAttachmentSchema = z.object({
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
    .max(MAX_MESSAGE_LENGTH, `Message exceeds the ${MAX_MESSAGE_LENGTH.toLocaleString()}-character limit.`),
  conversationId: z.string().trim().max(120).optional(),
  projectId: z.string().trim().max(120).optional(),
  preferredAgent: AgentIdSchema.optional(),
  useSentinel: z.boolean().optional().default(true),
  researchMode: z.boolean().optional().default(false),
  requestedTools: z.array(z.string().trim().max(64)).max(5).optional(),
  attachments: z.array(ChatAttachmentSchema).max(2).optional().default([]),
  history: z
    .array(ChatMessageInputSchema)
    .max(MAX_HISTORY_ITEMS)
    .optional()
    .default([]),
});

export const ToolDirectExecuteSchema = z.object({
  tool: z.enum([
    'calculator',
    'datetime_utility',
    'text_transformer',
    'json_validator',
    'csv_analyzer',
    'chart_generator',
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
  category: z.enum(['research', 'software', 'strategy', 'documentation']).default('software'),
});

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
    .max(MAX_DOCUMENT_LENGTH, `Document text exceeds the ${MAX_DOCUMENT_LENGTH.toLocaleString()}-character prototype limit.`),
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
    pattern: /\b(reveal|print|dump|output|expose|echo)\b.{0,40}\b(system\s+prompt|api[_\s-]?key|gemini_api_key|process\.env|environment\s+variables|secrets?)\b/i,
    reason: 'Attempted secret or system configuration exfiltration',
  },
  {
    pattern: /\b(grant|enable|unlock|escalate)\b.{0,35}\b(all\s+tools|shell|bash|sudo|admin|root|unrestricted)\b/i,
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

  public check(key: string, now = Date.now()): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
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
