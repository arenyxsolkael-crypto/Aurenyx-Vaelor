import { z } from 'zod';
import type {
  AgentId,
  ResponseLength,
  ResponseTone,
  TaskPlanRecord,
  TaskType,
  ToolName,
} from '../shared/types.ts';

export const MAX_PLANNING_ITERATIONS = 2;
export const MAX_TOOL_CALLS_PER_TASK = 3;
export const MAX_TASK_EXECUTION_MS = 35_000;

const VALID_AGENTS = [
  'vaelor-core',
  'aurenyx-research',
  'vaelor-forge',
  'vaelor-analyst',
  'vaelor-knowledge',
  'vaelor-sentinel',
] as const;

const VALID_TASK_TYPES = [
  'general',
  'reasoning',
  'tutoring',
  'coding',
  'research',
  'writing',
  'analysis',
  'structured_data',
  'knowledge',
  'creative',
  'relationship_health_edu',
  'verification',
  'tool_assisted',
] as const;

const VALID_TOOLS = [
  'calculator',
  'datetime_utility',
  'text_summarizer',
  'text_transformer',
  'json_validator',
  'structured_formatter',
  'task_planner',
  'document_processor',
  'csv_analyzer',
  'research_framework',
  'chart_generator',
  'web_search_connector',
  'workflow_connector_gate',
] as const;

/**
 * Schema for structured VAELOR PLANNER output.
 * Any planner output (deterministic or LLM-generated) must pass this schema;
 * otherwise parseAndValidateTaskPlan safely falls back to a bounded direct response plan.
 */
export const TaskPlanSchema = z.object({
  goal: z.string().trim().min(3).max(400),
  detectedCategories: z.array(z.enum(VALID_TASK_TYPES)).min(1).max(6),
  selectedAgent: z.enum(VALID_AGENTS),
  requiresTools: z.boolean(),
  permittedTools: z.array(z.enum(VALID_TOOLS)).max(13),
  selectedTools: z.array(z.enum(VALID_TOOLS)).max(MAX_TOOL_CALLS_PER_TASK),
  isMultiStep: z.boolean(),
  requiresExternalEvidence: z.boolean(),
  completionCriteria: z.string().trim().min(3).max(300),
  plannerSource: z.enum(['deterministic-schema', 'fallback-direct']),
});

export interface ContentPolicyDecision {
  allowed: boolean;
  action: 'allowed' | 'educational_safe_framing' | 'refused_prohibited';
  refusalMessage?: string;
  framingDirective?: string;
  reasonCode?: string;
}

/**
 * Responsible Content & Google Play Generative AI Policy Guardrail (Section 6).
 * - Strictly refuses CSAM/minors, sexual violence/coercion/non-consensual content, exploitation,
 *   and explicit pornography / erotic arousal roleplay.
 * - Explicitly allows factual, respectful, non-judgmental educational questions on relationships,
 *   consent, boundaries, anatomy, contraception, STI prevention, and reproductive health.
 */
export function evaluateContentSafetyPolicy(message: string): ContentPolicyDecision {
  const normalized = message.toLowerCase();

  // 1. Absolute zero-tolerance: minor / underage sexual content or exploitation
  if (
    /\b(csam|child\s+porn|underage\s+sex|minor\s+sexual|sex\s+with\s+a?\s*(?:child|minor|kid|teenager\s+under\s+18)|sexualize\s+(?:children|minors))\b/i.test(
      normalized
    )
  ) {
    return {
      allowed: false,
      action: 'refused_prohibited',
      reasonCode: 'PROHIBITED_MINOR_SAFETY',
      refusalMessage:
        'I cannot fulfill requests involving minors in any sexual or exploitative context. AURENYX VAELOR strictly enforces child safety and zero-tolerance exploitation protections.',
    };
  }

  // 2. Non-consensual sexual content, sexual violence, coercion, or intimate image abuse
  if (
    /\b(revenge\s+porn|non[- ]?consensual\s+(?:sex|porn|intimate|nudes)|deepfake\s+nudes|how\s+to\s+(?:coerce|force|drug)\s+someone\s+into\s+sex|sexual\s+assault\s+fantasy|rape\s+(?:roleplay|story|erotica))\b/i.test(
      normalized
    )
  ) {
    return {
      allowed: false,
      action: 'refused_prohibited',
      reasonCode: 'PROHIBITED_NON_CONSENSUAL_OR_COERCION',
      refusalMessage:
        'I cannot assist with non-consensual sexual content, coercion, sexual violence, or intimate image abuse. If you would like factual educational information about consent, personal safety, or support resources, I can help with that.',
    };
  }

  // 3. Explicit pornography / erotic roleplay / sexual arousal generation (Google Play compliance)
  if (
    /\b(write\s+(?:explicit\s+)?(?:erotica|porn|pornography|smut|nsfw\s+sex\s+scene)|erotic\s+roleplay|sexting\s+roleplay|talk\s+dirty\s+to\s+me|explicit\s+sexual\s+fantasy|generate\s+pornographic)\b/i.test(
      normalized
    )
  ) {
    return {
      allowed: false,
      action: 'refused_prohibited',
      reasonCode: 'PROHIBITED_EXPLICIT_EROTICA',
      refusalMessage:
        'I cannot generate sexually explicit erotica, pornography, or arousal roleplay in order to comply with platform and Google Play safety standards. However, I can gladly answer factual questions about relationships, communication, consent, anatomy, contraception, or sexual health.',
    };
  }

  // 4. Legitimate relationship, consent, anatomy, contraception, STI & sexual-health education
  if (
    /\b(contracepti(?:on|ve)|birth\s+control|condoms?|sti\b|std\b|sexually\s+transmitted|reproductive\s+health|sexual\s+health|consent\s+boundaries|healthy\s+intimacy|intimacy\s+communication|dating\s+advice|relationship\s+conflict|menstrua(?:l|tion)|ovulation|anatomy|pelvic\s+health|hpv\s+vaccine|prep\s+hiv)\b/i.test(
      normalized
    )
  ) {
    return {
      allowed: true,
      action: 'educational_safe_framing',
      framingDirective:
        'Educational & Health Framing Active: Answer factually, respectfully, and without shame or moralizing. Use clear, medically grounded, age-safe educational language suitable for a general audience (do not assume user age). Clarify that educational information is not a substitute for personalized clinical diagnosis, and recommend consulting a qualified healthcare professional for personal symptoms or prescriptions.',
    };
  }

  return {
    allowed: true,
    action: 'allowed',
  };
}

/**
 * Multi-label broad-purpose task classifier for Universal Chat Engine v1.0 & v0.2.
 */
export function detectBroadTaskCategories(
  message: string,
  options?: {
    hasTextAttachment?: boolean;
    hasImageAttachment?: boolean;
    researchMode?: boolean;
    hasSuggestedTools?: boolean;
  }
): TaskType[] {
  const lower = message.toLowerCase();
  const categories = new Set<TaskType>();

  if (options?.researchMode || /\b(latest|current\s+news|recent\s+developments|search\s+the\s+web|web\s+research|investigate|literature\s+review|primary\s+sources?|who\s+is\s+the\s+current|in\s+202[567])\b/.test(lower)) {
    categories.add('research');
  }

  if (
    /\b(code|coding|typescript|javascript|python|kotlin|java|rust|go\b|react|express|sql|regex|refactor|debug|stack\s*trace|compile|unit\s*test|architecture|api\s*design|endpoint|function|class|interface|dockerfile|git|bug)\b/.test(
      lower
    ) ||
    /```/.test(message)
  ) {
    categories.add('coding');
  }

  if (
    /\b(contracepti(?:on|ve)|birth\s+control|sti\b|std\b|sexually\s+transmitted|reproductive\s+health|sexual\s+health|consent|boundaries|dating|relationship|partner\s+communication|conflict\s+resolution|breakup|emotional\s+support|intimacy)\b/.test(
      lower
    )
  ) {
    categories.add('relationship_health_edu');
  }

  if (
    /\b(explain|tutor|teach\s+me|step[- ]by[- ]step|how\s+does\b.{1,40}\bwork|prove|theorem|calculus|algebra|derivative|integral|quadratic|physics|chemistry|biology|grammar|translate)\b/.test(
      lower
    )
  ) {
    categories.add('tutoring');
  }

  if (
    /\b(compare|comparison|versus|\bvs\.?\b|trade[- ]?offs?|pros\s+and\s+cons|matrix|benchmark|financial\s+model|unit\s+economics|business\s+plan|go[- ]to[- ]market|roi\b|cagr|margin|calculate|compute|solve)\b/.test(
      lower
    )
  ) {
    categories.add('analysis');
  }

  if (
    /\b(json\s+schema|markdown\s+table|format\s+as\s+(?:json|csv|table)|structured\s+output|yaml|xml)\b/.test(
      lower
    )
  ) {
    categories.add('structured_data');
  }

  if (
    options?.hasTextAttachment ||
    options?.hasImageAttachment ||
    /\b(pdf|document|passage|excerpt|uploaded|attached|in\s+my\s+notes|saved\s+memor|according\s+to\s+the\s+(?:text|brief|file))\b/.test(
      lower
    )
  ) {
    categories.add('knowledge');
  }

  if (
    /\b(summari[sz]e|rewrite|draft\s+an?\s+(?:email|memo|essay|article|report|pitch|presentation)|technical\s+writing|executive\s+summary|condense)\b/.test(
      lower
    )
  ) {
    categories.add('writing');
  }

  if (
    /\b(novel|story|fiction|sci-fi|poem|poetry|song|lyrics|screenplay|script|character\s+backstory|worldbuilding|brainstorm\s+creative|haiku|dialogue\s+scene|roleplay)\b/.test(
      lower
    )
  ) {
    categories.add('creative');
  }

  if (
    /\b(fact[- ]?check|verify\s+this|audit\s+this|unsupported\s+claims?|hallucinat)\b/.test(lower)
  ) {
    categories.add('verification');
  }

  if (
    /\b(puzzle|logic\s+problem|deduce|multi[- ]step\s+reasoning|plan\s+out|roadmap|milestone)\b/.test(
      lower
    )
  ) {
    categories.add('reasoning');
  }

  if (options?.hasSuggestedTools) {
    categories.add('tool_assisted');
  }

  if (categories.size === 0) {
    categories.add('general');
  }

  return Array.from(categories).slice(0, 6);
}

/**
 * Validates any raw planner candidate object or JSON string against TaskPlanSchema.
 * If validation fails, returns a guaranteed-valid bounded fallback plan rather than throwing.
 */
export function parseAndValidatePlannerOutput(
  candidate: unknown,
  fallback: {
    userMessage: string;
    selectedAgent: AgentId;
    permittedTools: ToolName[];
    detectedCategories?: TaskType[];
  }
): TaskPlanRecord {
  try {
    const rawObj = typeof candidate === 'string' ? (JSON.parse(candidate) as unknown) : candidate;
    const parsed = TaskPlanSchema.safeParse(rawObj);
    if (parsed.success) {
      // Enforce strict subset: selectedTools MUST be permitted for selectedAgent
      const allowedSet = new Set(fallback.permittedTools);
      const safeSelectedTools = parsed.data.selectedTools
        .filter((t) => allowedSet.has(t))
        .slice(0, MAX_TOOL_CALLS_PER_TASK);
      return {
        ...parsed.data,
        permittedTools: fallback.permittedTools,
        selectedTools: safeSelectedTools,
        requiresTools: safeSelectedTools.length > 0,
      };
    }
  } catch {
    // Fall through to safe direct response fallback
  }

  const cleanGoal =
    fallback.userMessage.trim().replace(/\s+/g, ' ').slice(0, 220) ||
    'Respond directly and accurately to the user request.';

  return {
    goal: cleanGoal,
    detectedCategories:
      fallback.detectedCategories && fallback.detectedCategories.length > 0
        ? fallback.detectedCategories.slice(0, 6)
        : ['general'],
    selectedAgent: fallback.selectedAgent,
    requiresTools: false,
    permittedTools: fallback.permittedTools,
    selectedTools: [],
    isMultiStep: false,
    requiresExternalEvidence: false,
    completionCriteria:
      'Deliver a clear, direct, policy-compliant response without unverified tool or source claims.',
    plannerSource: 'fallback-direct',
  };
}

/**
 * Builds formatting instructions for user-selected Tone and Response Length preferences.
 */
export function buildStylePreferenceDirective(
  tone: ResponseTone = 'balanced',
  responseLength: ResponseLength = 'standard'
): string {
  const toneMap: Record<ResponseTone, string> = {
    balanced: 'Tone: Clear, natural, helpful, and well-calibrated to the user prompt.',
    professional: 'Tone: Executive, structured, precise, and business-ready.',
    friendly: 'Tone: Warm, approachable, encouraging, and conversational without losing accuracy.',
    academic: 'Tone: Rigorous, analytical, scholarly, with explicit definitions and assumptions.',
    direct: 'Tone: Crisp, no-fluff, action-first; lead immediately with the answer.',
  };

  const lengthMap: Record<ResponseLength, string> = {
    concise:
      'Length preference: Concise — keep the answer compact (roughly 80–220 words unless code/tables require slightly more), focusing on highest-signal points.',
    standard:
      'Length preference: Standard — provide a balanced, complete explanation (roughly 200–550 words as appropriate to task complexity).',
    detailed:
      'Length preference: Detailed — provide thorough step-by-step depth, edge cases, examples, and structured breakdowns.',
  };

  return `${toneMap[tone] ?? toneMap.balanced}\n${lengthMap[responseLength] ?? lengthMap.standard}`;
}
