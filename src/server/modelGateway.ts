import crypto from 'node:crypto';
import { GoogleGenAI, Type, type Part } from '@google/genai';
import type {
  AIRequest,
  AIResponse,
  ChatAttachment,
  CitationItem,
  ImageAspectRatio,
  ImageResolutionSize,
  ModelCapabilities,
} from '../shared/types.ts';

export type GatewayErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_UNAVAILABLE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'INVALID_OUTPUT'
  | 'PAID_TIER_REQUIRED'
  | 'PROVIDER_ERROR';

export class ModelGatewayError extends Error {
  public readonly code: GatewayErrorCode;
  public readonly statusCode: number;
  public readonly retryable: boolean;

  constructor(options: {
    code: GatewayErrorCode;
    message: string;
    statusCode: number;
    retryable: boolean;
  }) {
    super(options.message);
    this.name = 'ModelGatewayError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable;
  }
}

export interface GatewayTurn {
  role: 'user' | 'model';
  text: string;
}

export interface TextGenerationRequest {
  systemInstruction: string;
  turns: GatewayTurn[];
  attachments?: ChatAttachment[];
  tier?: 'primary' | 'fast';
  timeoutMs?: number;
  maxOutputChars?: number;
  mockMode?: boolean;
  bypassCache?: boolean;
  cacheScope?: string;
  signal?: AbortSignal;
}

export interface TextGenerationResponse {
  text: string;
  modelUsed: string;
  isMockResponse?: boolean;
  cached?: boolean;
}

export interface SentinelJsonReviewRequest {
  systemInstruction: string;
  prompt: string;
  timeoutMs?: number;
  mockMode?: boolean;
  signal?: AbortSignal;
}

export interface SentinelJsonReviewResponse {
  approved: boolean;
  flags: string[];
  summary: string;
  revisedAnswer: string;
  modelUsed: string;
}

export interface GroundedWebSearchResult {
  status: 'ok' | 'no_sources' | 'unavailable';
  query: string;
  summaryText: string;
  citations: CitationItem[];
  note: string;
}

export interface StudioImageGenerationRequest {
  prompt: string;
  aspectRatio: ImageAspectRatio;
  imageSize: ImageResolutionSize;
  qualityTier: 'general' | 'studio';
  timeoutMs?: number;
}

export interface StudioImageGenerationResponse {
  imageDataUrl?: string;
  caption?: string;
  modelUsed: string;
}

export interface GatewayConfigurationStatus {
  configured: boolean;
  provider: string;
  primaryModel: string;
  fastModel: string;
  paidModelsEnabled: boolean;
  liveSearchConfigured?: boolean;
  groundedSearchMode?: 'gemini-google-search' | 'external-search-key' | 'unavailable';
  mockModeDefault?: boolean;
}

/**
 * Clean Provider Adapter & Model Gateway Interface (VAELOR CORE v0.2).
 * Supports generateResponse(), streamResponse(), checkProviderAvailability(),
 * grounded search, Sentinel JSON critique, and backward-compatible v0.1 methods.
 */
export interface ModelGateway {
  getStatus(): GatewayConfigurationStatus;
  checkProviderAvailability?(): Promise<{
    available: boolean;
    provider: string;
    configured: boolean;
    primaryModel: string;
    reason?: string;
  }>;
  getCapabilities?(): Promise<ModelCapabilities>;
  generateResponse?(input: AIRequest): Promise<AIResponse>;
  streamResponse?(input: AIRequest): AsyncIterable<{ delta: string; modelUsed: string }>;
  generate?(input: AIRequest): Promise<AIResponse>;
  stream?(input: AIRequest): AsyncIterable<{ delta: string; modelUsed: string }>;
  generateText(req: TextGenerationRequest): Promise<TextGenerationResponse>;
  generateSentinelReview(req: SentinelJsonReviewRequest): Promise<SentinelJsonReviewResponse>;
  searchGroundedWeb?(query: string, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<GroundedWebSearchResult>;
  generateStudioImage(req: StudioImageGenerationRequest): Promise<StudioImageGenerationResponse>;
}

const DEFAULT_PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_FAST_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_TIMEOUT_MS = 22_000;
const DEFAULT_MAX_OUTPUT_CHARS = 14_000;
const MAX_CACHE_ENTRIES = 32;

function buildContentsWithAttachments(
  turns: GatewayTurn[],
  attachments?: ChatAttachment[]
): { role: 'user' | 'model'; parts: Part[] }[] {
  const imageAttachments = (attachments ?? []).filter(
    (a) => a.kind === 'image' && Boolean(a.base64Data)
  );

  return turns.map((turn, idx) => {
    const isFinalUserTurn = idx === turns.length - 1 && turn.role === 'user';
    if (!isFinalUserTurn || imageAttachments.length === 0) {
      return {
        role: turn.role,
        parts: [{ text: turn.text }],
      };
    }

    const parts: Part[] = imageAttachments.map((img) => ({
      inlineData: {
        mimeType: img.mimeType || 'image/png',
        data: img.base64Data!,
      },
    }));
    parts.push({ text: turn.text });
    return {
      role: 'user',
      parts,
    };
  });
}

/**
 * Generates an explicitly labeled simulated response ONLY when Local Mock Mode is enabled.
 * Never claims to be real AI model inference.
 */
export function buildExplicitLocalMockText(turns: GatewayTurn[]): string {
  const latestUserText = turns[turns.length - 1]?.text ?? '';
  const lower = latestUserText.toLowerCase();

  const header =
    '> **[LOCAL MOCK MODE — Simulated UI Test Response]**\n> *This output was generated locally for ₹0 interface verification and is NOT real AI model inference.*\n\n';

  // Surface any deterministic local calculator output attached by the orchestrator
  const calcMatch = latestUserText.match(
    /Approved Tool Output \(calculator\):\s*\{[\s\S]*?"expression"\s*:\s*"([^"]+)"[\s\S]*?"value"\s*:\s*([0-9.eE+-]+)/
  );
  const calcLine = calcMatch
    ? `\n- **Verified Calculator Tool Output:** \`${calcMatch[1]} = ${calcMatch[2]}\``
    : '';

  if (/\b(quadratic|equation|calculus|math|formula|integral|sqrt|calculate)\b/.test(lower)) {
    return (
      header +
      '### Mathematical & Quantitative Breakdown (Simulated)\n\n' +
      'For a standard quadratic equation $ax^2 + bx + c = 0$ with $a \\neq 0$, the roots are given by:\n\n' +
      '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n' +
      '- **Inline check:** Energy-mass equivalence is expressed as $E = mc^2$.' +
      calcLine +
      '\n- **Deterministic verification:** Any approved `calculator` tool output attached to this run is cross-checked by Vaelor Sentinel.'
    );
  }

  if (/\b(code|typescript|javascript|python|function|test|debug)\b/.test(lower)) {
    return (
      header +
      '### Modular TypeScript Implementation (Simulated)\n\n' +
      '```typescript\n' +
      'export function clampRetryDelay(attempt: number, baseMs = 250, maxMs = 4000): number {\n' +
      '  const safeAttempt = Math.max(0, Math.min(attempt, 6));\n' +
      '  return Math.min(maxMs, baseMs * Math.pow(2, safeAttempt));\n' +
      '}\n' +
      '```\n\n' +
      '| Input Attempt | Computed Backoff (ms) | Bounded |\n' +
      '| --- | --- | --- |\n' +
      '| 0 | 250 | Yes |\n' +
      '| 2 | 1000 | Yes |\n' +
      '| 5 | 4000 | Capped |' +
      calcLine
    );
  }

  return (
    header +
    '### Structured Mock Synthesis\n\n' +
    '1. **Direct Summary:** Your prompt was classified, validated against server schemas, and routed through the AURENYX VAELOR v0.2 pipeline.\n' +
    '2. **Key Structure:** Markdown formatting, tables, syntax-highlighted code blocks, and mathematical notation ($\\sum_{i=1}^{n} x_i$) are active.\n' +
    '3. **Switch to Live AI:** Disable **Mock Mode** in the chat toolbar to send requests to the configured server-side Gemini gateway.' +
    calcLine
  );
}

export class GeminiModelGateway implements ModelGateway {
  private readonly envSource: Record<string, string | undefined>;
  private readonly responseCache = new Map<string, { text: string; modelUsed: string; expiresAt: number }>();

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

  public getStatus(): GatewayConfigurationStatus {
    const apiKey = this.getApiKey();
    const primaryModel = (
      this.envSource.VAELOR_DEFAULT_MODEL ||
      this.envSource.GEMINI_MODEL ||
      DEFAULT_PRIMARY_MODEL
    ).trim();
    const fastModel = (
      this.envSource.VAELOR_FAST_MODEL ||
      this.envSource.GEMINI_FAST_MODEL ||
      DEFAULT_FAST_MODEL
    ).trim();
    const paidModelsEnabled = this.envSource.ENABLE_PAID_MODELS === 'true';
    const hasExternalSearchKey = Boolean(this.envSource.SEARCH_API_KEY?.trim());
    const groundedSearchMode: GatewayConfigurationStatus['groundedSearchMode'] = hasExternalSearchKey
      ? 'external-search-key'
      : apiKey
        ? 'gemini-google-search'
        : 'unavailable';

    return {
      configured: Boolean(apiKey),
      provider: 'Gemini API (@google/genai)',
      primaryModel,
      fastModel,
      paidModelsEnabled,
      liveSearchConfigured: Boolean(apiKey || hasExternalSearchKey),
      groundedSearchMode,
      mockModeDefault: this.envSource.VAELOR_MOCK_MODE === 'true',
    };
  }

  public async checkProviderAvailability() {
    const status = this.getStatus();
    return {
      available: status.configured,
      provider: status.provider,
      configured: status.configured,
      primaryModel: status.primaryModel,
      reason: status.configured
        ? 'Server-side GEMINI_API_KEY is configured.'
        : 'GEMINI_API_KEY is missing on the server; configure it in Secrets/.env or use labeled Local Mock Mode for UI testing.',
    };
  }

  public async getCapabilities(): Promise<ModelCapabilities> {
    const status = this.getStatus();
    return {
      provider: status.provider,
      configured: status.configured,
      primaryModel: status.primaryModel,
      fastModel: status.fastModel,
      paidModelsEnabled: status.paidModelsEnabled,
      mockModeAvailable: true,
      supportsStreaming: true,
      supportsVision: true,
      supportsStructuredJson: true,
      supportsImageGeneration: status.paidModelsEnabled,
      supportsLiveWebSearch: Boolean(status.liveSearchConfigured),
      maxContextTurns: 8,
      maxStepsPerRequest: 4,
    };
  }

  private createClient(): GoogleGenAI {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ModelGatewayError({
        code: 'MISSING_API_KEY',
        message:
          'Model setup required: GEMINI_API_KEY is not configured on the server. Configure it in server-side Secrets or .env (never in frontend code), or toggle Local Mock Mode for UI testing.',
        statusCode: 503,
        retryable: false,
      });
    }

    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  private computeCacheKey(scope: string, model: string, systemInstruction: string, turns: GatewayTurn[]): string {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ scope, model, systemInstruction, turns }))
      .digest('hex');
    return hash;
  }

  public async generateResponse(input: AIRequest): Promise<AIResponse> {
    return this.generate(input);
  }

  public streamResponse(input: AIRequest): AsyncIterable<{ delta: string; modelUsed: string }> {
    return this.stream(input);
  }

  public async generate(input: AIRequest): Promise<AIResponse> {
    const res = await this.generateText({
      systemInstruction: input.systemInstruction,
      turns: input.messages,
      attachments: input.attachments,
      tier: input.tier,
      timeoutMs: input.timeoutMs,
      maxOutputChars: input.maxOutputChars,
      mockMode: input.mockMode,
      bypassCache: input.bypassCache,
      cacheScope: input.cacheScope,
      signal: input.signal,
    });
    const inputChars = input.messages.reduce((sum, m) => sum + m.text.length, 0);
    return {
      text: res.text,
      modelUsed: res.modelUsed,
      provider: res.isMockResponse ? 'Local Mock Simulator (UI Test)' : 'Gemini API (@google/genai)',
      isMockResponse: res.isMockResponse,
      cached: res.cached,
      usage: {
        inputChars,
        outputChars: res.text.length,
        attachmentCount: input.attachments?.length ?? 0,
      },
    };
  }

  public async *stream(
    input: AIRequest
  ): AsyncIterable<{ delta: string; modelUsed: string }> {
    throwIfAborted(input.signal);

    if (input.mockMode) {
      const mockText = buildExplicitLocalMockText(input.messages);
      const chunks = mockText.match(/.{1,36}(\s|$)/gs) ?? [mockText];
      for (const piece of chunks) {
        throwIfAborted(input.signal);
        yield { delta: piece, modelUsed: 'local-mock-simulator' };
      }
      return;
    }

    const ai = this.createClient();
    const status = this.getStatus();
    const targetModel = input.tier === 'fast' ? status.fastModel : status.primaryModel;
    const maxChars = input.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
    const contents = buildContentsWithAttachments(input.messages, input.attachments);

    try {
      const responseStream = await withRetryAndTimeout(
        () =>
          ai.models.generateContentStream({
            model: targetModel,
            contents,
            config: {
              systemInstruction: input.systemInstruction,
              temperature: input.temperature ?? 0.4,
            },
          }),
        input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        input.signal
      );

      let emittedChars = 0;
      for await (const chunk of responseStream) {
        throwIfAborted(input.signal);
        const piece = chunk.text ?? '';
        if (!piece) continue;
        if (emittedChars + piece.length > maxChars) {
          const remaining = Math.max(0, maxChars - emittedChars);
          if (remaining > 0) {
            yield { delta: piece.slice(0, remaining), modelUsed: targetModel };
          }
          yield {
            delta: `\n\n*[Output truncated at safe ${maxChars.toLocaleString()}-character boundary]*`,
            modelUsed: targetModel,
          };
          break;
        }
        emittedChars += piece.length;
        yield { delta: piece, modelUsed: targetModel };
      }
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }

  public async generateText(req: TextGenerationRequest): Promise<TextGenerationResponse> {
    throwIfAborted(req.signal);

    if (req.mockMode) {
      return {
        text: buildExplicitLocalMockText(req.turns),
        modelUsed: 'local-mock-simulator',
        isMockResponse: true,
      };
    }

    const ai = this.createClient();
    const status = this.getStatus();
    const requestedModel = req.tier === 'fast' ? status.fastModel : status.primaryModel;
    const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxChars = req.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;

    const canCache =
      !req.bypassCache &&
      (!req.attachments || req.attachments.length === 0) &&
      Boolean(req.cacheScope);
    const cacheKey = canCache
      ? this.computeCacheKey(req.cacheScope!, requestedModel, req.systemInstruction, req.turns)
      : '';

    if (canCache && cacheKey) {
      const hit = this.responseCache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        return {
          text: hit.text,
          modelUsed: hit.modelUsed,
          cached: true,
        };
      }
    }

    const contents = buildContentsWithAttachments(req.turns, req.attachments);

    const invokeModel = async (targetModel: string, callTimeoutMs: number) => {
      const response = await withRetryAndTimeout(
        () =>
          ai.models.generateContent({
            model: targetModel,
            contents,
            config: {
              systemInstruction: req.systemInstruction,
              temperature: 0.4,
            },
          }),
        callTimeoutMs,
        req.signal
      );

      const rawText = response.text?.trim() ?? '';
      if (!rawText) {
        throw new ModelGatewayError({
          code: 'INVALID_OUTPUT',
          message: 'The model returned an empty response. Please retry your request.',
          statusCode: 502,
          retryable: true,
        });
      }

      const boundedText =
        rawText.length > maxChars
          ? `${rawText.slice(0, maxChars)}\n\n*[Output truncated at safe ${maxChars.toLocaleString()}-character boundary]*`
          : rawText;

      return {
        text: boundedText,
        modelUsed: targetModel,
      };
    };

    try {
      const out = await invokeModel(requestedModel, timeoutMs);
      if (canCache && cacheKey) {
        if (this.responseCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = this.responseCache.keys().next().value;
          if (oldestKey) this.responseCache.delete(oldestKey);
        }
        this.responseCache.set(cacheKey, {
          text: out.text,
          modelUsed: out.modelUsed,
          expiresAt: Date.now() + 5 * 60_000,
        });
      }
      return out;
    } catch (error) {
      const normalized = normalizeProviderError(error);
      if (
        normalized.code !== 'CANCELLED' &&
        requestedModel !== status.fastModel &&
        (normalized.code === 'MODEL_UNAVAILABLE' || normalized.code === 'TIMEOUT')
      ) {
        try {
          return await invokeModel(status.fastModel, Math.min(timeoutMs, 16_000));
        } catch (fallbackErr) {
          throw normalizeProviderError(fallbackErr);
        }
      }
      throw normalized;
    }
  }

  /**
   * Grounded Web Search via server-side Gemini Google Search Grounding (`tools: [{ googleSearch: {} }]`).
   * Extracts real groundingChunks (title + URI) without ever fabricating citations.
   */
  public async searchGroundedWeb(
    query: string,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<GroundedWebSearchResult> {
    throwIfAborted(options?.signal);
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        status: 'unavailable',
        query,
        summaryText: '',
        citations: [],
        note: 'Grounded web search is unavailable because GEMINI_API_KEY is not configured on the server.',
      };
    }

    const ai = this.createClient();
    const status = this.getStatus();
    const timeoutMs = options?.timeoutMs ?? 12_000;

    try {
      const response = await withGatewayTimeout(
        ai.models.generateContent({
          model: status.primaryModel,
          contents: `Retrieve factual, up-to-date grounded information for the following research query and summarize key verifiable facts concisely:\n\n${query}`,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.1,
          },
        }),
        timeoutMs,
        options?.signal
      );

      const summaryText = (response.text ?? '').trim();
      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUrls = new Set<string>();
      const citations: CitationItem[] = [];

      for (let i = 0; i < rawChunks.length; i += 1) {
        const web = rawChunks[i]?.web;
        const uri = web?.uri?.trim();
        if (!uri || !/^https?:\/\//i.test(uri) || seenUrls.has(uri)) continue;
        seenUrls.add(uri);
        citations.push({
          id: `cit-web-${i + 1}`,
          sourceTitle: web?.title?.trim() || new URL(uri).hostname,
          sourceType: 'web',
          url: uri,
          excerpt: summaryText
            ? `${summaryText.slice(0, 200)}${summaryText.length > 200 ? '…' : ''} (${uri})`
            : uri,
        });
        if (citations.length >= 6) break;
      }

      if (citations.length === 0) {
        return {
          status: 'no_sources',
          query,
          summaryText,
          citations: [],
          note: 'Search grounding completed, but no verifiable external web source URLs were returned for this query.',
        };
      }

      return {
        status: 'ok',
        query,
        summaryText,
        citations,
        note: `Retrieved ${citations.length} grounded web source(s) via Gemini Google Search.`,
      };
    } catch (error) {
      const normalized = normalizeProviderError(error);
      if (normalized.code === 'CANCELLED') throw normalized;
      return {
        status: 'unavailable',
        query,
        summaryText: '',
        citations: [],
        note: `Live web search grounding could not be completed (${normalized.code}): ${normalized.message}`,
      };
    }
  }

  public async generateSentinelReview(
    req: SentinelJsonReviewRequest
  ): Promise<SentinelJsonReviewResponse> {
    throwIfAborted(req.signal);

    if (req.mockMode) {
      return {
        approved: true,
        flags: [],
        summary: 'Local Mock Mode: Deterministic Sentinel safety checks passed (LLM critic skipped in mock mode).',
        revisedAnswer: '',
        modelUsed: 'local-mock-simulator',
      };
    }

    const ai = this.createClient();
    const status = this.getStatus();
    const model = status.fastModel || status.primaryModel;
    const timeoutMs = req.timeoutMs ?? 18_000;

    try {
      const response = await withRetryAndTimeout(
        () =>
          ai.models.generateContent({
            model,
            contents: req.prompt,
            config: {
              systemInstruction: req.systemInstruction,
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  approved: {
                    type: Type.BOOLEAN,
                    description:
                      'True if the draft fulfills the request without unsupported claims or policy breaches.',
                  },
                  flags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Specific issues or cautions identified during verification.',
                  },
                  summary: {
                    type: Type.STRING,
                    description: 'Concise 1-sentence verification summary.',
                  },
                  revisedAnswer: {
                    type: Type.STRING,
                    description:
                      'Improved final response with any overstatements or unsupported claims corrected. Keep faithful to original if approved.',
                  },
                },
                required: ['approved', 'flags', 'summary', 'revisedAnswer'],
              },
            },
          }),
        timeoutMs,
        req.signal
      );

      const jsonText = response.text?.trim() ?? '';
      if (!jsonText) {
        throw new ModelGatewayError({
          code: 'INVALID_OUTPUT',
          message: 'Sentinel critic returned empty structured output.',
          statusCode: 502,
          retryable: true,
        });
      }

      let parsed: Partial<SentinelJsonReviewResponse>;
      try {
        parsed = JSON.parse(jsonText) as Partial<SentinelJsonReviewResponse>;
      } catch {
        throw new ModelGatewayError({
          code: 'INVALID_OUTPUT',
          message: 'Sentinel critic returned malformed JSON output.',
          statusCode: 502,
          retryable: true,
        });
      }

      if (typeof parsed.revisedAnswer !== 'string' || !parsed.revisedAnswer.trim()) {
        throw new ModelGatewayError({
          code: 'INVALID_OUTPUT',
          message: 'Sentinel critic omitted revisedAnswer.',
          statusCode: 502,
          retryable: true,
        });
      }

      return {
        approved: Boolean(parsed.approved),
        flags: Array.isArray(parsed.flags)
          ? parsed.flags.filter((f): f is string => typeof f === 'string')
          : [],
        summary:
          typeof parsed.summary === 'string' && parsed.summary.trim()
            ? parsed.summary.trim()
            : 'Sentinel verification pass completed.',
        revisedAnswer: parsed.revisedAnswer.trim(),
        modelUsed: model,
      };
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }

  public async generateStudioImage(
    req: StudioImageGenerationRequest
  ): Promise<StudioImageGenerationResponse> {
    const status = this.getStatus();

    // Enforce non-negotiable ₹0 free-tier guardrail unless paid models are explicitly enabled on server
    if (!status.paidModelsEnabled) {
      throw new ModelGatewayError({
        code: 'PAID_TIER_REQUIRED',
        message:
          '₹0 Free-Tier Guardrail Active: Studio raster image generation (gemini-3-pro-image / gemini-nano-banana-2.1) requires a billing-enabled API key, which was declined. Use Vaelor Forge SVG Blueprint fallback instead without activating paid services.',
        statusCode: 403,
        retryable: false,
      });
    }

    const ai = this.createClient();
    const model =
      req.qualityTier === 'studio' ? 'gemini-3-pro-image' : 'gemini-nano-banana-2.1';
    const supportedRatio = mapSupportedAspectRatio(req.aspectRatio);

    try {
      const response = await withGatewayTimeout(
        ai.models.generateContent({
          model,
          contents: {
            parts: [{ text: req.prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: supportedRatio,
              imageSize: req.imageSize,
            },
          },
        }),
        req.timeoutMs ?? 45_000
      );

      let imageDataUrl: string | undefined;
      let caption = '';

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          caption += part.text;
        }
      }

      if (!imageDataUrl) {
        throw new ModelGatewayError({
          code: 'INVALID_OUTPUT',
          message: 'Image model completed without returning image bytes.',
          statusCode: 502,
          retryable: true,
        });
      }

      return {
        imageDataUrl,
        caption: caption.trim() || undefined,
        modelUsed: model,
      };
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}

function mapSupportedAspectRatio(ratio: ImageAspectRatio): string {
  const nativeSupported = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
  if (nativeSupported.has(ratio)) return ratio;
  if (ratio === '2:3') return '3:4';
  if (ratio === '3:2') return '4:3';
  if (ratio === '21:9') return '16:9';
  return '1:1';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ModelGatewayError({
      code: 'CANCELLED',
      message: 'Generation stopped by user.',
      statusCode: 499,
      retryable: false,
    });
  }
}

async function withRetryAndTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
  maxRetries = 1
): Promise<T> {
  let attempt = 0;
  while (true) {
    throwIfAborted(signal);
    try {
      return await withGatewayTimeout(operation(), timeoutMs, signal);
    } catch (err) {
      const normalized = normalizeProviderError(err);
      if (
        attempt >= maxRetries ||
        normalized.code === 'CANCELLED' ||
        normalized.code === 'MISSING_API_KEY' ||
        normalized.code === 'INVALID_API_KEY' ||
        normalized.code === 'QUOTA_EXCEEDED' ||
        normalized.code === 'PAID_TIER_REQUIRED'
      ) {
        throw normalized;
      }
      attempt += 1;
      const delayMs = Math.min(1200, 280 * Math.pow(2, attempt - 1));
      await sleepWithAbort(delayMs, signal);
    }
  }
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new ModelGatewayError({
          code: 'CANCELLED',
          message: 'Generation stopped by user.',
          statusCode: 499,
          retryable: false,
        })
      );
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(
        new ModelGatewayError({
          code: 'CANCELLED',
          message: 'Generation stopped by user.',
          statusCode: 499,
          retryable: false,
        })
      );
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function withGatewayTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  const raceGuards = new Promise<never>((_resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new ModelGatewayError({
          code: 'CANCELLED',
          message: 'Generation stopped by user.',
          statusCode: 499,
          retryable: false,
        })
      );
      return;
    }

    onAbort = () => {
      reject(
        new ModelGatewayError({
          code: 'CANCELLED',
          message: 'Generation stopped by user.',
          statusCode: 499,
          retryable: false,
        })
      );
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    timer = setTimeout(() => {
      reject(
        new ModelGatewayError({
          code: 'TIMEOUT',
          message: `The model gateway timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
          statusCode: 504,
          retryable: true,
        })
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, raceGuards]);
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort && signal) signal.removeEventListener('abort', onAbort);
  }
}

export function normalizeProviderError(error: unknown): ModelGatewayError {
  if (error instanceof ModelGatewayError) {
    return error;
  }

  const rawMsg = error instanceof Error ? error.message : String(error ?? '');
  const lower = rawMsg.toLowerCase();

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ModelGatewayError({
      code: 'CANCELLED',
      message: 'Generation stopped by user.',
      statusCode: 499,
      retryable: false,
    });
  }

  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit')
  ) {
    return new ModelGatewayError({
      code: 'QUOTA_EXCEEDED',
      message:
        'Provider free-tier quota or rate limit reached (HTTP 429). Wait a moment and retry, or enable Local Mock Mode for UI testing.',
      statusCode: 429,
      retryable: true,
    });
  }

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated')
  ) {
    return new ModelGatewayError({
      code: 'INVALID_API_KEY',
      message:
        'The model provider rejected the server API key or model access. Verify GEMINI_API_KEY and VAELOR_DEFAULT_MODEL in Settings > Secrets.',
      statusCode: 502,
      retryable: false,
    });
  }

  if (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('not supported') ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded')
  ) {
    return new ModelGatewayError({
      code: 'MODEL_UNAVAILABLE',
      message:
        'The configured Gemini model is temporarily overloaded or unavailable on this free tier (HTTP 503). Retry shortly or use Local Mock Mode for UI testing.',
      statusCode: 503,
      retryable: true,
    });
  }

  if (lower.includes('abort') || lower.includes('timed out') || lower.includes('timeout')) {
    return new ModelGatewayError({
      code: 'TIMEOUT',
      message: 'The model request timed out. Please retry with a shorter prompt.',
      statusCode: 504,
      retryable: true,
    });
  }

  return new ModelGatewayError({
    code: 'PROVIDER_ERROR',
    message:
      'The model provider encountered an unexpected error. No sensitive details were exposed; please retry.',
    statusCode: 502,
    retryable: true,
  });
}

/**
 * Generates a clean, zero-cost deterministic SVG visual blueprint framing
 * when paid raster image generation is disabled under ₹0 Free-Tier mode.
 */
export function buildFreeTierSvgBlueprint(params: {
  prompt: string;
  aspectRatio: ImageAspectRatio;
  imageSize: ImageResolutionSize;
}): string {
  const dims: Record<ImageAspectRatio, [number, number]> = {
    '1:1': [640, 640],
    '2:3': [560, 840],
    '3:2': [840, 560],
    '3:4': [600, 800],
    '4:3': [800, 600],
    '9:16': [480, 854],
    '16:9': [896, 504],
    '21:9': [966, 414],
  };
  const [w, h] = dims[params.aspectRatio] ?? [800, 450];
  const safeTitle = escapeXml(params.prompt.slice(0, 68));
  const safeSub = escapeXml(
    params.prompt.length > 68
      ? `${params.prompt.slice(68, 140)}…`
      : 'Free-Tier Architectural Frame Spec'
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#171326"/>
      <stop offset="55%" stop-color="#0e0c16"/>
      <stop offset="100%" stop-color="#1e1733"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#8b6ff7" stroke-opacity="0.12" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#grid)"/>
  <rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="16" fill="none" stroke="#8b6ff7" stroke-opacity="0.4" stroke-width="1.5"/>
  <circle cx="${Math.round(w / 2)}" cy="${Math.round(h / 2 - 26)}" r="${Math.round(Math.min(w, h) * 0.16)}" fill="none" stroke="#c8b8ff" stroke-opacity="0.55" stroke-width="1.5"/>
  <polygon points="${Math.round(w / 2)},${Math.round(h / 2 - 74)} ${Math.round(w / 2 + 48)},${Math.round(h / 2 - 26)} ${Math.round(w / 2)},${Math.round(h / 2 + 22)} ${Math.round(w / 2 - 48)},${Math.round(h / 2 - 26)}" fill="#8b6ff7" fill-opacity="0.16" stroke="#a68efa" stroke-width="1.5"/>
  <text x="${Math.round(w / 2)}" y="${Math.round(h / 2 + 64)}" text-anchor="middle" fill="#f1eef9" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="600">${safeTitle}</text>
  <text x="${Math.round(w / 2)}" y="${Math.round(h / 2 + 90)}" text-anchor="middle" fill="#a29ab8" font-family="Plus Jakarta Sans, sans-serif" font-size="13">${safeSub}</text>
  <text x="42" y="${h - 42}" fill="#8b6ff7" font-family="JetBrains Mono, monospace" font-size="12">ASPECT ${params.aspectRatio} · SPEC ${params.imageSize} · ₹0 FREE-TIER SVG BLUEPRINT</text>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
