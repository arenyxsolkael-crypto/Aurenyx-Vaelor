import type {
  ModelRouteCapability,
  ModelRouteDecision,
  RouterOperatingMode,
  RouterStatusSummary,
} from '../shared/types.ts';

export const DEFAULT_FREE_TIER_MODEL = 'gemini-3.1-flash-lite';
export const DEFAULT_ROUTER_TIMEOUT_MS = 22_000;
export const DEFAULT_FAST_TIMEOUT_MS = 14_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_MAX_CONTEXT_TURNS = 8;
export const DEFAULT_MAX_CONTEXT_CHARS = 48_000;

export const PAID_ONLY_MODEL_SET = new Set([
  'gemini-4-argon',
  'gemini-3-pro-image',
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-lite-image',
  'gemini-omni-1.1-flash',
  'lyria-3-clip-preview',
  'lyria-3-pro-preview',
]);

export const DEPRECATED_PROHIBITED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
]);

export interface RouteSelectionInput {
  capability: ModelRouteCapability;
  requestedTier?: 'primary' | 'fast';
  estimatedInputChars?: number;
  hasVisionAttachment?: boolean;
  mockMode?: boolean;
  timeoutOverrideMs?: number;
}

/**
 * Centralized Adaptive Model Router (AURENYX VAELOR v0.4 — Module G).
 * Routes requests across configured and available server-side models based on
 * capability requirements, context window limits, availability, and ₹0 cost guardrails.
 * Never silently switches to paid APIs and discloses single-model mode honestly.
 */
export class AdaptiveModelRouter {
  private readonly envSource: Record<string, string | undefined>;

  constructor(envSource: Record<string, string | undefined> = process.env) {
    this.envSource = envSource;
  }

  private getApiKey(): string | undefined {
    const raw = this.envSource.GEMINI_API_KEY?.trim();
    if (!raw || raw === 'MY_GEMINI_API_KEY' || raw === 'YOUR_GEMINI_API_KEY_HERE') {
      return undefined;
    }
    return raw;
  }

  private normalizeConfiguredModel(rawModel: string | undefined, fallback: string): string {
    const candidate = (rawModel || fallback).trim();
    if (!candidate) return fallback;
    if (DEPRECATED_PROHIBITED_MODELS.has(candidate.toLowerCase())) {
      return fallback;
    }
    return candidate;
  }

  public isPaidModel(modelId: string): boolean {
    return PAID_ONLY_MODEL_SET.has(modelId.trim().toLowerCase());
  }

  public getStatusSummary(mockMode = false): RouterStatusSummary {
    const apiKey = this.getApiKey();
    const configured = Boolean(apiKey);
    const paidModelsEnabled = this.envSource.ENABLE_PAID_MODELS === 'true';

    const primaryModel = this.normalizeConfiguredModel(
      this.envSource.VAELOR_DEFAULT_MODEL || this.envSource.GEMINI_MODEL,
      DEFAULT_FREE_TIER_MODEL
    );
    const fastModel = this.normalizeConfiguredModel(
      this.envSource.VAELOR_FAST_MODEL || this.envSource.GEMINI_FAST_MODEL,
      DEFAULT_FREE_TIER_MODEL
    );
    const reasoningModel = this.normalizeConfiguredModel(
      this.envSource.VAELOR_REASONING_MODEL,
      primaryModel
    );

    const distinctModels = new Set([primaryModel, fastModel, reasoningModel]);
    const distinctModelsConfigured = distinctModels.size > 1;
    const hasExternalSearchKey = Boolean(this.envSource.SEARCH_API_KEY?.trim());

    let operatingMode: RouterOperatingMode;
    if (mockMode) {
      operatingMode = 'mock';
    } else if (!configured) {
      operatingMode = 'unconfigured';
    } else if (distinctModelsConfigured) {
      operatingMode = 'multi-model';
    } else {
      operatingMode = 'single-model';
    }

    let disclosureNote: string;
    if (operatingMode === 'mock') {
      disclosureNote =
        'Local Mock Mode is active: requests use deterministic local simulation (0 live API calls).';
    } else if (operatingMode === 'unconfigured') {
      disclosureNote =
        'GEMINI_API_KEY is not configured on the server; live model calls are unavailable until configured in server Secrets.';
    } else if (operatingMode === 'single-model') {
      disclosureNote = `Single-model mode active (${primaryModel}): primary, fast, and specialist passes share one free-tier Gemini model to uphold ₹0 cost guardrails.`;
    } else {
      disclosureNote = `Multi-model routing active across ${Array.from(distinctModels).join(', ')} with server-side fallback.`;
    }

    return {
      provider: 'Gemini API (@google/genai)',
      configured,
      operatingMode,
      primaryModel,
      fastModel,
      reasoningModel,
      distinctModelsConfigured,
      paidModelsEnabled,
      liveSearchAvailable: Boolean(configured || hasExternalSearchKey),
      maxContextTurns: DEFAULT_MAX_CONTEXT_TURNS,
      maxContextChars: DEFAULT_MAX_CONTEXT_CHARS,
      defaultTimeoutMs: DEFAULT_ROUTER_TIMEOUT_MS,
      maxRetries: DEFAULT_MAX_RETRIES,
      disclosureNote,
    };
  }

  public selectRoute(input: RouteSelectionInput): ModelRouteDecision {
    const summary = this.getStatusSummary(Boolean(input.mockMode));
    const estimatedInputChars = Math.max(0, Math.floor(input.estimatedInputChars ?? 0));
    const contextTrimmed = estimatedInputChars > summary.maxContextChars;
    const requestedTier = input.requestedTier ?? (input.capability === 'fast_critic' ? 'fast' : 'primary');

    if (input.mockMode) {
      return {
        selectedModel: 'local-mock-simulator',
        requestedTier,
        capability: input.capability,
        operatingMode: 'mock',
        reason: 'Local Mock Mode explicitly enabled; routed to zero-cost deterministic simulator.',
        timeoutMs: 4_000,
        maxRetries: 0,
        estimatedInputChars,
        contextLimitChars: summary.maxContextChars,
        contextTrimmed,
        paidGuardrailActive: !summary.paidModelsEnabled,
      };
    }

    let candidateModel = summary.primaryModel;
    let reason = `Selected primary model (${summary.primaryModel}) for ${input.capability}.`;

    if (requestedTier === 'fast' || input.capability === 'fast_critic') {
      candidateModel = summary.fastModel;
      reason =
        summary.fastModel === summary.primaryModel
          ? `Single-model mode: fast tier shares ${summary.fastModel} with reduced timeout budget.`
          : `Selected fast model (${summary.fastModel}) for low-latency verification/classification.`;
    } else if (
      (input.capability === 'deep_reasoning' || input.capability === 'coding') &&
      summary.reasoningModel !== summary.primaryModel
    ) {
      if (!this.isPaidModel(summary.reasoningModel) || summary.paidModelsEnabled) {
        candidateModel = summary.reasoningModel;
        reason = `Selected configured reasoning model (${summary.reasoningModel}) for ${input.capability}.`;
      } else {
        candidateModel = summary.primaryModel;
        reason = `Kept free-tier model (${summary.primaryModel}) because reasoning model (${summary.reasoningModel}) requires paid billing (₹0 guardrail).`;
      }
    } else if (input.hasVisionAttachment || input.capability === 'vision') {
      candidateModel = summary.primaryModel;
      reason = `Selected multimodal-capable model (${summary.primaryModel}) for image/document inspection.`;
    }

    const baseTimeout =
      requestedTier === 'fast' ? DEFAULT_FAST_TIMEOUT_MS : DEFAULT_ROUTER_TIMEOUT_MS;
    const rawTimeout = input.timeoutOverrideMs ?? baseTimeout;
    const timeoutMs = Math.max(3_000, Math.min(30_000, Math.floor(rawTimeout)));

    const fallbackCandidate =
      candidateModel !== summary.fastModel &&
      (!this.isPaidModel(summary.fastModel) || summary.paidModelsEnabled)
        ? summary.fastModel
        : undefined;

    return {
      selectedModel: candidateModel,
      fallbackModel: fallbackCandidate,
      requestedTier,
      capability: input.capability,
      operatingMode: summary.operatingMode,
      reason,
      timeoutMs,
      maxRetries: summary.configured ? DEFAULT_MAX_RETRIES : 0,
      estimatedInputChars,
      contextLimitChars: summary.maxContextChars,
      contextTrimmed,
      paidGuardrailActive: !summary.paidModelsEnabled,
    };
  }
}
