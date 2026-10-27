import { GoogleGenAI, Type, type Part } from '@google/genai';
import type {
  AIRequest,
  AIResponse,
  ChatAttachment,
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
}

export interface TextGenerationResponse {
  text: string;
  modelUsed: string;
}

export interface SentinelJsonReviewRequest {
  systemInstruction: string;
  prompt: string;
  timeoutMs?: number;
}

export interface SentinelJsonReviewResponse {
  approved: boolean;
  flags: string[];
  summary: string;
  revisedAnswer: string;
  modelUsed: string;
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
}

export interface ModelGateway {
  getStatus(): GatewayConfigurationStatus;
  getCapabilities?(): Promise<ModelCapabilities>;
  generate?(input: AIRequest): Promise<AIResponse>;
  stream?(input: AIRequest): AsyncIterable<{ delta: string; modelUsed: string }>;
  generateText(req: TextGenerationRequest): Promise<TextGenerationResponse>;
  generateSentinelReview(req: SentinelJsonReviewRequest): Promise<SentinelJsonReviewResponse>;
  generateStudioImage(req: StudioImageGenerationRequest): Promise<StudioImageGenerationResponse>;
}

const DEFAULT_PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_FAST_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_TIMEOUT_MS = 28_000;
const DEFAULT_MAX_OUTPUT_CHARS = 14_000;

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

export class GeminiModelGateway implements ModelGateway {
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

  public getStatus(): GatewayConfigurationStatus {
    const apiKey = this.getApiKey();
    const primaryModel = (this.envSource.GEMINI_MODEL || DEFAULT_PRIMARY_MODEL).trim();
    const fastModel = (this.envSource.GEMINI_FAST_MODEL || DEFAULT_FAST_MODEL).trim();
    const paidModelsEnabled = this.envSource.ENABLE_PAID_MODELS === 'true';
    const liveSearchConfigured = Boolean(this.envSource.SEARCH_API_KEY?.trim());

    return {
      configured: Boolean(apiKey),
      provider: 'Gemini API (@google/genai)',
      primaryModel,
      fastModel,
      paidModelsEnabled,
      liveSearchConfigured,
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
          'Model setup required: GEMINI_API_KEY is not configured on the server. Configure it in server-side Secrets or .env (never in frontend code).',
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

  public async generate(input: AIRequest): Promise<AIResponse> {
    const res = await this.generateText({
      systemInstruction: input.systemInstruction,
      turns: input.messages,
      attachments: input.attachments,
      tier: input.tier,
      timeoutMs: input.timeoutMs,
      maxOutputChars: input.maxOutputChars,
    });
    const inputChars = input.messages.reduce((sum, m) => sum + m.text.length, 0);
    return {
      text: res.text,
      modelUsed: res.modelUsed,
      provider: 'Gemini API (@google/genai)',
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
    const ai = this.createClient();
    const status = this.getStatus();
    const targetModel = input.tier === 'fast' ? status.fastModel : status.primaryModel;
    const maxChars = input.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
    const contents = buildContentsWithAttachments(input.messages, input.attachments);

    try {
      const responseStream = await withGatewayTimeout(
        ai.models.generateContentStream({
          model: targetModel,
          contents,
          config: {
            systemInstruction: input.systemInstruction,
            temperature: input.temperature ?? 0.4,
          },
        }),
        input.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );

      let emittedChars = 0;
      for await (const chunk of responseStream) {
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
    const ai = this.createClient();
    const status = this.getStatus();
    const requestedModel = req.tier === 'fast' ? status.fastModel : status.primaryModel;
    const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxChars = req.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;

    const contents = buildContentsWithAttachments(req.turns, req.attachments);

    const invokeModel = async (targetModel: string, callTimeoutMs: number) => {
      const response = await withGatewayTimeout(
        ai.models.generateContent({
          model: targetModel,
          contents,
          config: {
            systemInstruction: req.systemInstruction,
            temperature: 0.4,
          },
        }),
        callTimeoutMs
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
      return await invokeModel(requestedModel, timeoutMs);
    } catch (error) {
      const normalized = normalizeProviderError(error);
      if (
        requestedModel !== status.fastModel &&
        (normalized.code === 'MODEL_UNAVAILABLE' || normalized.code === 'TIMEOUT')
      ) {
        try {
          return await invokeModel(status.fastModel, Math.min(timeoutMs, 18_000));
        } catch (fallbackErr) {
          throw normalizeProviderError(fallbackErr);
        }
      }
      throw normalized;
    }
  }

  public async generateSentinelReview(
    req: SentinelJsonReviewRequest
  ): Promise<SentinelJsonReviewResponse> {
    const ai = this.createClient();
    const status = this.getStatus();
    const model = status.fastModel || status.primaryModel;
    const timeoutMs = req.timeoutMs ?? 24_000;

    try {
      const response = await withGatewayTimeout(
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
        timeoutMs
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

async function withGatewayTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
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
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function normalizeProviderError(error: unknown): ModelGatewayError {
  if (error instanceof ModelGatewayError) {
    return error;
  }

  const rawMsg = error instanceof Error ? error.message : String(error ?? '');
  const lower = rawMsg.toLowerCase();

  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit')
  ) {
    return new ModelGatewayError({
      code: 'QUOTA_EXCEEDED',
      message: 'Provider free-tier quota or rate limit reached. Wait a moment and retry.',
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
        'The model provider rejected the server API key or model access. Verify GEMINI_API_KEY and GEMINI_MODEL on the backend.',
      statusCode: 502,
      retryable: false,
    });
  }

  if (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('not supported') ||
    lower.includes('503') ||
    lower.includes('unavailable')
  ) {
    return new ModelGatewayError({
      code: 'MODEL_UNAVAILABLE',
      message:
        'The configured Gemini model is temporarily unavailable or unsupported on this tier. Check GEMINI_MODEL in server configuration.',
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
