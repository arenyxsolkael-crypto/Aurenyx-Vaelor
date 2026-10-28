import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_DEFINITIONS } from './src/server/agents.ts';
import {
  AuthVerificationError,
  createJwksFirebaseTokenVerifier,
  loadServerFirebaseConfig,
  type FirebaseTokenVerifier,
  type ServerFirebasePublicConfig,
  type VerifiedFirebaseUser,
} from './src/server/authVerify.ts';
import {
  buildFreeTierSvgBlueprint,
  GeminiModelGateway,
  ModelGatewayError,
  type ModelGateway,
} from './src/server/modelGateway.ts';
import { MAX_ORCHESTRATOR_MODEL_STEPS, VaelorOrchestrator } from './src/server/orchestrator.ts';
import { EphemeralSessionStore } from './src/server/store.ts';
import { executeToolWithPermissions, TOOL_REGISTRY } from './src/server/tools.ts';
import {
  ChatRequestSchema,
  ConversationPatchSchema,
  ConversationSyncSchema,
  detectSecretInText,
  DocumentIngestSchema,
  MemoryCreateSchema,
  ProjectCreateSchema,
  ProjectUpdateSchema,
  SlidingWindowRateLimiter,
  StudioVisualRequestSchema,
  TaskWorkflowExecuteSchema,
  TaskWorkflowPlanSchema,
  ToolDirectExecuteSchema,
} from './src/server/validation.ts';
import { EVALUATION_PROMPT_SUITE } from './src/shared/evaluationPrompts.ts';
import {
  auditAndroidProject,
  createAndroidSourceTarGzBuffer,
  readSafeAndroidSourceFile,
  sanitizeErrorMessageForClient,
} from './src/server/androidProjectService.ts';
import {
  OFFICIAL_ATTRIBUTION,
  type AIStreamEvent,
  type AuthConfigResponse,
  type AuthenticatedAccountSummary,
  type Conversation,
  type HealthResponse,
  type KnowledgeDocument,
  type ProjectWorkspace,
  type SavedMemory,
  type StructuredTaskRun,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppServerDependencies {
  gateway?: ModelGateway;
  store?: EphemeralSessionStore;
  rateLimitPerMinute?: number;
  requireAuth?: boolean;
  tokenVerifier?: FirebaseTokenVerifier;
  firebaseConfigOverride?: ServerFirebasePublicConfig;
}

const PUBLIC_STATELESS_TOOLS = new Set([
  'calculator',
  'datetime_utility',
  'text_summarizer',
  'text_transformer',
  'json_validator',
  'structured_formatter',
  'code_static_reviewer',
  'task_planner',
  'csv_analyzer',
  'research_framework',
  'chart_generator',
]);

export function createApiApp(deps: AppServerDependencies = {}) {
  const app = express();
  const gateway = deps.gateway ?? new GeminiModelGateway(process.env);
  const store = deps.store ?? new EphemeralSessionStore(true);
  const orchestrator = new VaelorOrchestrator(gateway);
  const requireAuth = deps.requireAuth ?? false;
  const firebasePublicConfig = deps.firebaseConfigOverride ?? loadServerFirebaseConfig();
  const tokenVerifier =
    deps.tokenVerifier ??
    createJwksFirebaseTokenVerifier({ projectId: firebasePublicConfig.projectId });

  const rateLimitMax = deps.rateLimitPerMinute ?? 20;
  const limiter = new SlidingWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: rateLimitMax,
  });

  const getOwnerSessionId = (req: Request): string => {
    const rawHeader = req.header('x-vaelor-session-token') || '';
    const cleaned = rawHeader.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    return cleaned || 'default-session';
  };

  /**
   * Optional bearer inspection for public endpoints (e.g. /api/health, /api/agents)
   * without failing when unauthenticated.
   */
  const tryResolveOptionalAuth = async (req: Request): Promise<VerifiedFirebaseUser | null> => {
    const authHeader = req.header('authorization');
    if (!authHeader || !/^Bearer\s+/i.test(authHeader.trim())) {
      return null;
    }
    try {
      return await tokenVerifier.verifyBearerHeader(authHeader);
    } catch {
      return null;
    }
  };

  /**
   * Strict server-side authentication check for protected project/chat/knowledge/task endpoints.
   * When requireAuth is true (production & live dev server), verified Firebase ID tokens are mandatory.
   */
  const resolveProtectedIdentity = async (
    req: Request,
    res: Response
  ): Promise<{
    verifiedUser: VerifiedFirebaseUser | null;
    resourceOwnerId: string;
    sessionOwnerId: string;
  } | null> => {
    const authHeader = req.header('authorization');
    if (requireAuth || (authHeader && /^Bearer\s+/i.test(authHeader.trim()))) {
      try {
        const verifiedUser = await tokenVerifier.verifyBearerHeader(authHeader);
        const uidKey = `uid:${verifiedUser.uid}`;
        return {
          verifiedUser,
          resourceOwnerId: uidKey,
          sessionOwnerId: uidKey,
        };
      } catch (err) {
        if (err instanceof AuthVerificationError) {
          res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
            retryable: err.code === 'SESSION_EXPIRED',
          });
          return null;
        }
        res.status(401).json({
          error: 'Authentication required to access private workspace data.',
          code: 'AUTH_REQUIRED',
          retryable: false,
        });
        return null;
      }
    }

    const legacySessionId = getOwnerSessionId(req);
    return {
      verifiedUser: null,
      resourceOwnerId: 'default-session',
      sessionOwnerId: legacySessionId,
    };
  };

  const sanitizeTaskRunForClient = (run: StructuredTaskRun): StructuredTaskRun => {
    const { ownerSessionId: _omit, ...safeRun } = run;
    return safeRun;
  };

  const sanitizeConversationForClient = (conv: Conversation): Conversation => {
    const { ownerSessionId: _omit, ...safeConv } = conv;
    return safeConv;
  };

  const sanitizeProjectForClient = (proj: ProjectWorkspace): ProjectWorkspace => {
    const { ownerSessionId: _omit, ...safeProj } = proj;
    return safeProj;
  };

  const sanitizeDocumentForClient = (doc: KnowledgeDocument): KnowledgeDocument => {
    const { ownerSessionId: _omit, ...safeDoc } = doc;
    return safeDoc;
  };

  const sanitizeMemoryForClient = (mem: SavedMemory): SavedMemory => {
    const { ownerSessionId: _omit, ...safeMem } = mem;
    return safeMem;
  };

  const effectiveStorageMode: HealthResponse['storageMode'] =
    requireAuth && firebasePublicConfig.configured
      ? 'firestore-plus-session'
      : 'in-memory-ephemeral';

  // Security headers & bounded JSON body size limit (2 MB for validated multimodal attachments)
  app.disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  // Handle oversized / malformed JSON payloads cleanly without stack traces
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err && typeof err === 'object' && 'type' in err) {
      const errType = (err as { type?: string }).type;
      if (errType === 'entity.too.large') {
        res.status(413).json({
          error: 'Request payload exceeds the 2 MB server safety limit. Reduce attachment size and retry.',
          code: 'PAYLOAD_TOO_LARGE',
        });
        return;
      }
      if (errType === 'entity.parse.failed') {
        res.status(400).json({
          error: 'Malformed JSON request body.',
          code: 'INVALID_JSON',
        });
        return;
      }
    }
    next(err);
  });

  const readLimiter = new SlidingWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: Math.max(rateLimitMax * 12, 240),
  });

  // Rate limit /api endpoints: strict budget on mutations/AI calls per IP + session/token tail
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const ipPart = req.ip || req.socket.remoteAddress || 'local';
    const bearerTail = (req.header('authorization') || '').slice(-24).replace(/[^a-zA-Z0-9_-]/g, '');
    const sessionPart = bearerTail || getOwnerSessionId(req);
    const key = `${ipPart}:${sessionPart}`;
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    const activeLimiter = isRead ? readLimiter : limiter;
    const activeMax = isRead ? Math.max(rateLimitMax * 12, 240) : rateLimitMax;
    const check = activeLimiter.check(key);

    res.setHeader('X-RateLimit-Limit', String(activeMax));
    res.setHeader('X-RateLimit-Remaining', String(check.remaining));
    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSeconds));
      res.status(429).json({
        error: `Rate limit reached (${activeMax} requests/minute). Wait ${check.retryAfterSeconds}s and retry.`,
        code: 'RATE_LIMITED',
        retryable: true,
      });
      return;
    }
    next();
  });

  // Prevent caching of any /api response in browsers or proxies
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
  });

  // 1. Health & Configuration Status (Public read; NEVER returns API keys or other users' counts)
  app.get('/api/health', async (req: Request, res: Response) => {
    const status = gateway.getStatus();
    const optionalUser = await tryResolveOptionalAuth(req);
    const maxConcurrentRequests =
      gateway instanceof GeminiModelGateway ? gateway.getMaxConcurrency() : 4;

    let counts = {
      conversations: 0,
      memories: 0,
      documents: 0,
      projects: 0,
      tasks: 0,
    };

    if (optionalUser) {
      const uidOwner = `uid:${optionalUser.uid}`;
      counts = {
        conversations: store.listConversationsForOwner(uidOwner).length,
        memories: store.listMemoriesForOwner(uidOwner).length,
        documents: store.listDocumentsForOwner(uidOwner).length,
        projects: store.listProjectsForOwner(uidOwner).length,
        tasks: store.listTasksForOwner(uidOwner).length,
      };
    } else if (!requireAuth) {
      const ownerSessionId = getOwnerSessionId(req);
      counts = {
        conversations: store.listConversationsForOwner(ownerSessionId).length,
        memories: store.listMemoriesForOwner('default-session').length,
        documents: store.listDocumentsForOwner('default-session').length,
        projects: store.listProjectsForOwner('default-session').length,
        tasks: store.listTasksForOwner(ownerSessionId).length,
      };
    }

    const payload: HealthResponse = {
      ok: true,
      version: OFFICIAL_ATTRIBUTION.version,
      configured: status.configured,
      provider: status.provider,
      primaryModel: status.configured ? status.primaryModel : undefined,
      fastModel: status.configured ? status.fastModel : undefined,
      paidModelsEnabled: status.paidModelsEnabled,
      liveSearchConfigured: Boolean(status.liveSearchConfigured),
      groundedSearchMode: status.groundedSearchMode,
      mockModeDefault: Boolean(status.mockModeDefault),
      maxStepsPerRequest: MAX_ORCHESTRATOR_MODEL_STEPS,
      maxConcurrentRequests,
      rateLimitPerMinute: rateLimitMax,
      rateLimitNote:
        'In-memory sliding-window rate limiter enforced per IP + verified account token; counters reset on server restart.',
      authRequired: requireAuth,
      firebaseProjectId: firebasePublicConfig.projectId || undefined,
      storageMode: effectiveStorageMode,
      storageNotice:
        effectiveStorageMode === 'firestore-plus-session'
          ? 'Firebase Authentication + Cloud Firestore security rules isolate verified account profiles, projects, and memories per UID (₹0 Spark Free Tier), while active server session state enforces Bearer token verification.'
          : 'Temporary in-memory session state is active (₹0 Free Tier). Optional local browser history persistence can be enabled in Settings.',
      attribution: {
        productName: OFFICIAL_ATTRIBUTION.productName,
        founderOrganization: OFFICIAL_ATTRIBUTION.founderOrganization,
        founderName: OFFICIAL_ATTRIBUTION.founderName,
        statement: OFFICIAL_ATTRIBUTION.statement,
      },
      counts,
    };
    res.json(payload);
  });

  // 1a. Public Authentication Readiness & Authorized Domain Metadata (Zero secrets exposed)
  app.get('/api/auth/config', (req: Request, res: Response) => {
    const hostHeader = (req.hostname || '').trim();
    const recommendedDomains = Array.from(
      new Set(
        [
          'localhost',
          firebasePublicConfig.authDomain,
          hostHeader,
          'ais-dev-m7wmxkzqqgbzkjzyfeea4s-887106166292.asia-southeast1.run.app',
          'ais-pre-m7wmxkzqqgbzkjzyfeea4s-887106166292.asia-southeast1.run.app',
        ].filter(Boolean)
      )
    );

    const payload: AuthConfigResponse = {
      ok: true,
      authRequiredOnProtectedApis: requireAuth,
      firebaseConfigured: firebasePublicConfig.configured,
      projectId: firebasePublicConfig.projectId,
      authDomain: firebasePublicConfig.authDomain,
      firestoreDatabaseId: firebasePublicConfig.firestoreDatabaseId,
      recommendedAuthorizedDomains: recommendedDomains,
      providers: [
        {
          id: 'google.com',
          label: 'Continue with Google',
          status: firebasePublicConfig.configured ? 'configured' : 'console_enable_required',
          note: 'Provisioned automatically with Firebase OAuth client for popup sign-in.',
        },
        {
          id: 'password',
          label: 'Email & Password (+ Reset & Verification)',
          status: 'console_enable_required',
          note: 'SDK flow implemented; toggle Email/Password ON in Firebase Console -> Authentication -> Sign-in method.',
        },
        {
          id: 'emailLink',
          label: 'Passwordless Email Magic Link',
          status: 'console_enable_required',
          note: 'SDK flow implemented; toggle Email link (passwordless sign-in) ON under Email/Password in Firebase Console.',
        },
        {
          id: 'apple.com',
          label: 'Sign in with Apple',
          status: 'planned_future',
          note: 'Planned future option (requires Apple Developer Program credentials; kept disabled under ₹0 budget).',
        },
        {
          id: 'github.com',
          label: 'GitHub & Enterprise OIDC SSO',
          status: 'planned_future',
          note: 'Planned future option; architecture supports linking additional Firebase Auth providers.',
        },
      ],
    };
    res.json(payload);
  });

  // 1b. Normalized Capabilities & Staged Integration Summary (Public read)
  app.get('/api/capabilities', async (_req: Request, res: Response) => {
    const status = gateway.getStatus();
    const capabilities = gateway.getCapabilities
      ? await gateway.getCapabilities()
      : {
          provider: status.provider,
          configured: status.configured,
          primaryModel: status.primaryModel,
          fastModel: status.fastModel,
          paidModelsEnabled: status.paidModelsEnabled,
          mockModeAvailable: true,
          supportsStreaming: Boolean(gateway.stream),
          supportsVision: true,
          supportsStructuredJson: true,
          supportsImageGeneration: status.paidModelsEnabled,
          supportsLiveWebSearch: Boolean(status.liveSearchConfigured),
          maxContextTurns: 8,
          maxStepsPerRequest: MAX_ORCHESTRATOR_MODEL_STEPS,
        };

    res.json({
      attribution: OFFICIAL_ATTRIBUTION,
      capabilities,
      tools: Object.values(TOOL_REGISTRY).map((tool) => ({
        name: tool.name,
        stage: tool.stage,
        availability: tool.availability,
        requiresConfirmation: tool.requiresConfirmation,
        description: tool.description,
        timeoutMs: tool.timeoutMs,
        maxCallsPerTask: tool.maxCallsPerTask,
        errorStrategy: tool.errorStrategy,
        outputSchemaSummary: tool.outputSchemaSummary,
        setupGuide: tool.setupGuide,
      })),
    });
  });

  // 2. Agents & Tools metadata (Public metadata; scopes run stats to verified caller if signed in)
  app.get('/api/agents', async (req: Request, res: Response) => {
    const optionalUser = await tryResolveOptionalAuth(req);
    const scopedTaskRuns = optionalUser
      ? store.listTasksForOwner(`uid:${optionalUser.uid}`)
      : requireAuth
        ? []
        : store.listTasksForOwner(getOwnerSessionId(req));

    const agentStats = Object.values(AGENT_DEFINITIONS).map((agent) => {
      const runs = scopedTaskRuns.filter((r) => r.selectedAgent === agent.id);
      const lastRun = runs[0];
      return {
        ...agent,
        totalRuns: runs.length,
        completedRuns: runs.filter((r) => r.status === 'completed').length,
        lastStatus: lastRun?.status ?? 'idle',
        lastActiveAt: lastRun?.createdAt ?? null,
      };
    });

    const tools = Object.values(TOOL_REGISTRY).map((tool) => ({
      name: tool.name,
      stage: tool.stage,
      availability: tool.availability,
      requiresConfirmation: tool.requiresConfirmation,
      description: tool.description,
      allowedAgents: tool.allowedAgents,
      timeoutMs: tool.timeoutMs,
      maxCallsPerTask: tool.maxCallsPerTask,
      errorStrategy: tool.errorStrategy,
      outputSchemaSummary: tool.outputSchemaSummary,
      resultFormat: tool.resultFormat,
      setupGuide: tool.setupGuide,
    }));

    res.json({ agents: agentStats, tools });
  });

  // 2b. Authenticated Account Inspection & Server-Side Data Deletion (Never exposes GEMINI_API_KEY)
  app.get('/api/account/me', async (req: Request, res: Response) => {
    let verified: VerifiedFirebaseUser;
    try {
      verified = await tokenVerifier.verifyBearerHeader(req.header('authorization'));
    } catch (err) {
      if (err instanceof AuthVerificationError) {
        res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
          retryable: err.code === 'SESSION_EXPIRED',
        });
        return;
      }
      res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
      return;
    }

    const uidKey = `uid:${verified.uid}`;
    const summary: AuthenticatedAccountSummary = {
      uid: verified.uid,
      email: verified.email,
      emailVerified: verified.emailVerified,
      name: verified.name,
      signInProvider: verified.signInProvider,
      geminiKeyExposedToUser: false,
      counts: {
        projects: store.listProjectsForOwner(uidKey).length,
        conversations: store.listConversationsForOwner(uidKey).length,
        documents: store.listDocumentsForOwner(uidKey).length,
        memories: store.listMemoriesForOwner(uidKey).length,
        tasks: store.listTasksForOwner(uidKey).length,
      },
    };
    res.json({ ok: true, account: summary });
  });

  app.delete('/api/account/data', async (req: Request, res: Response) => {
    let verified: VerifiedFirebaseUser;
    try {
      verified = await tokenVerifier.verifyBearerHeader(req.header('authorization'));
    } catch (err) {
      if (err instanceof AuthVerificationError) {
        res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
          retryable: err.code === 'SESSION_EXPIRED',
        });
        return;
      }
      res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
      return;
    }

    const uidKey = `uid:${verified.uid}`;
    store.purgeAllDataForOwner(uidKey);
    res.json({
      ok: true,
      deletedOwnerUid: verified.uid,
    });
  });

  // 3. Primary Multi-Agent Orchestrator Endpoint (Unary JSON — Protected)
  app.post('/api/chat', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Invalid chat request.';
      res.status(400).json({
        error: firstIssue,
        code: 'VALIDATION_ERROR',
        retryable: false,
      });
      return;
    }

    const {
      message,
      history,
      preferredAgent,
      useSentinel,
      researchMode,
      tone,
      responseLength,
      mockMode,
      bypassCache,
      requestedTools,
      attachments,
      projectId,
      conversationId,
    } = parsed.data;

    if (
      detectSecretInText(message) ||
      attachments.some((a) => a.textContent && detectSecretInText(a.textContent))
    ) {
      res.status(400).json({
        error:
          'Security guardrail: Your message or attachment appears to contain an API key or private credential. Never submit secrets into chat.',
        code: 'SECRET_DETECTED_IN_INPUT',
        retryable: false,
      });
      return;
    }

    let project: ProjectWorkspace | undefined;
    if (projectId) {
      const projLookup = store.getProjectForOwner(identity.resourceOwnerId, projectId);
      if (projLookup === 'forbidden') {
        res.status(403).json({
          error: 'Forbidden: You do not have permission to reference another user’s project.',
          code: 'FORBIDDEN_RESOURCE_ACCESS',
          retryable: false,
        });
        return;
      }
      if (projLookup !== 'not_found') {
        project = projLookup;
      }
    }

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const result = await orchestrator.executeTask({
        message,
        history,
        preferredAgent,
        useSentinel,
        researchMode,
        tone,
        responseLength,
        mockMode,
        bypassCache,
        ownerSessionId: identity.sessionOwnerId,
        signal: abortController.signal,
        requestedTools,
        attachments,
        project,
        documents: store.listDocumentsForOwner(identity.resourceOwnerId),
        memories: store.listMemoriesForOwner(identity.resourceOwnerId),
        conversationId,
      });

      store.recordTaskRun(result.taskRun);
      res.json({
        reply: result.reply,
        taskRun: sanitizeTaskRunForClient(result.taskRun),
        generatedSvgBlueprint: result.generatedSvgBlueprint,
      });
    } catch (err) {
      const attachedRun = (err as { taskRun?: StructuredTaskRun })?.taskRun;
      if (attachedRun) {
        store.recordTaskRun(attachedRun);
      }
      const safeAttachedRun = attachedRun ? sanitizeTaskRunForClient(attachedRun) : undefined;

      if (err instanceof ModelGatewayError) {
        if (!res.writableEnded) {
          res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
            retryable: err.retryable,
            taskRun: safeAttachedRun,
          });
        }
        return;
      }

      if (!res.writableEnded) {
        res.status(502).json({
          error: 'The orchestrator could not complete the request safely. Please try again.',
          code: 'ORCHESTRATOR_FAILURE',
          retryable: true,
          taskRun: safeAttachedRun,
        });
      }
    }
  });

  // 3b. Streaming Multi-Agent Orchestrator Endpoint (SSE — Protected)
  app.post('/api/chat/stream', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Invalid chat request.';
      res.status(400).json({
        error: firstIssue,
        code: 'VALIDATION_ERROR',
        retryable: false,
      });
      return;
    }

    const {
      message,
      history,
      preferredAgent,
      useSentinel,
      researchMode,
      tone,
      responseLength,
      mockMode,
      bypassCache,
      requestedTools,
      attachments,
      projectId,
      conversationId,
    } = parsed.data;

    if (
      detectSecretInText(message) ||
      attachments.some((a) => a.textContent && detectSecretInText(a.textContent))
    ) {
      res.status(400).json({
        error:
          'Security guardrail: Your message or attachment appears to contain an API key or private credential. Never submit secrets into chat.',
        code: 'SECRET_DETECTED_IN_INPUT',
        retryable: false,
      });
      return;
    }

    let project: ProjectWorkspace | undefined;
    if (projectId) {
      const projLookup = store.getProjectForOwner(identity.resourceOwnerId, projectId);
      if (projLookup === 'forbidden') {
        res.status(403).json({
          error: 'Forbidden: You do not have permission to reference another user’s project.',
          code: 'FORBIDDEN_RESOURCE_ACCESS',
          retryable: false,
        });
        return;
      }
      if (projLookup !== 'not_found') {
        project = projLookup;
      }
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const writeEvent = (event: AIStreamEvent) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    try {
      const result = await orchestrator.executeTask({
        message,
        history,
        preferredAgent,
        useSentinel,
        researchMode,
        tone,
        responseLength,
        mockMode,
        bypassCache,
        ownerSessionId: identity.sessionOwnerId,
        signal: abortController.signal,
        requestedTools,
        attachments,
        project,
        documents: store.listDocumentsForOwner(identity.resourceOwnerId),
        memories: store.listMemoriesForOwner(identity.resourceOwnerId),
        conversationId,
        onStreamEvent: writeEvent,
      });

      store.recordTaskRun(result.taskRun);
      writeEvent({
        type: 'complete',
        reply: result.reply,
        taskRun: sanitizeTaskRunForClient(result.taskRun),
        generatedSvgBlueprint: result.generatedSvgBlueprint,
      });
      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      const attachedRun = (err as { taskRun?: StructuredTaskRun })?.taskRun;
      if (attachedRun) {
        store.recordTaskRun(attachedRun);
      }
      const safeAttachedRun = attachedRun ? sanitizeTaskRunForClient(attachedRun) : undefined;
      const code = err instanceof ModelGatewayError ? err.code : 'ORCHESTRATOR_FAILURE';
      const errMessage =
        err instanceof ModelGatewayError
          ? err.message
          : 'The orchestrator could not complete the request safely. Please try again.';
      const retryable = err instanceof ModelGatewayError ? err.retryable : true;

      writeEvent({
        type: 'error',
        taskRun: safeAttachedRun,
        error: {
          code,
          message: errMessage,
          retryable,
        },
      });
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // 3c. Direct Deterministic Tool Execution Endpoint
  // Public stateless tools (calculator, csv_analyzer, chart_generator, etc.) work on the public landing page without login;
  // private document/web/connector tools require authentication when requireAuth is active.
  app.post('/api/tools/execute', async (req: Request, res: Response) => {
    const parsed = ToolDirectExecuteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid tool execution payload.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { tool, args, confirmedByUser } = parsed.data;
    const serializedArgs = JSON.stringify(args);
    if (detectSecretInText(serializedArgs)) {
      res.status(400).json({
        error: 'Security guardrail: Never pass API keys or secrets into tool arguments.',
        code: 'SECRET_DETECTED_IN_INPUT',
      });
      return;
    }

    let scopedDocs: KnowledgeDocument[] = [];
    let scopedMems: SavedMemory[] = [];

    if (!PUBLIC_STATELESS_TOOLS.has(tool)) {
      const identity = await resolveProtectedIdentity(req, res);
      if (!identity) return;
      scopedDocs = store.listDocumentsForOwner(identity.resourceOwnerId);
      scopedMems = store.listMemoriesForOwner(identity.resourceOwnerId);
    } else {
      const optionalUser = await tryResolveOptionalAuth(req);
      if (optionalUser) {
        const uidKey = `uid:${optionalUser.uid}`;
        scopedDocs = store.listDocumentsForOwner(uidKey);
        scopedMems = store.listMemoriesForOwner(uidKey);
      } else if (!requireAuth) {
        scopedDocs = store.listDocumentsForOwner('default-session');
        scopedMems = store.listMemoriesForOwner('default-session');
      }
    }

    const toolDef = TOOL_REGISTRY[tool];
    const authorizedAgent = toolDef.allowedAgents[0] ?? 'vaelor-core';

    const { record } = await executeToolWithPermissions({
      agentId: authorizedAgent,
      toolName: tool,
      rawArgs: args,
      context: {
        documents: scopedDocs,
        memories: scopedMems,
        confirmedByUser,
        gateway,
      },
    });

    if (record.status !== 'completed') {
      res.status(record.status === 'denied' ? 403 : 400).json({
        error: record.error || `Tool '${tool}' could not be executed.`,
        record,
      });
      return;
    }

    res.json({
      ok: true,
      record,
    });
  });

  // 4. Visual Studio / Image Aspect & Size Endpoint (Protected; honors ₹0 Free-Tier Guardrail + SVG Blueprint Fallback)
  app.post('/api/studio/visual', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = StudioVisualRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid visual specification.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { prompt, aspectRatio, imageSize, qualityTier, generateFreeBlueprintFallback } =
      parsed.data;

    try {
      const generated = await gateway.generateStudioImage({
        prompt,
        aspectRatio,
        imageSize,
        qualityTier,
      });
      res.json({
        mode: 'studio-image',
        imageDataUrl: generated.imageDataUrl,
        caption: generated.caption,
        modelUsed: generated.modelUsed,
        aspectRatio,
        imageSize,
      });
    } catch (err) {
      if (err instanceof ModelGatewayError && err.code === 'PAID_TIER_REQUIRED') {
        const svgBlueprint = generateFreeBlueprintFallback
          ? buildFreeTierSvgBlueprint({ prompt, aspectRatio, imageSize })
          : undefined;
        res.status(403).json({
          error: err.message,
          code: err.code,
          aspectRatio,
          imageSize,
          svgBlueprint,
        });
        return;
      }
      const status = err instanceof ModelGatewayError ? err.statusCode : 502;
      const message =
        err instanceof ModelGatewayError ? err.message : 'Visual generation request failed.';
      res.status(status).json({ error: message, code: 'VISUAL_ERROR' });
    }
  });

  // 5. Projects Endpoints (Protected & Per-User Isolated against IDOR)
  app.get('/api/projects', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    res.json({
      storageMode: effectiveStorageMode,
      projects: store
        .listProjectsForOwner(identity.resourceOwnerId)
        .map(sanitizeProjectForClient),
    });
  });

  app.post('/api/projects', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = ProjectCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid project data.' });
      return;
    }
    const serialized = JSON.stringify(parsed.data);
    if (detectSecretInText(serialized)) {
      res.status(400).json({
        error: 'Security guardrail: Never store API keys or private credentials in project fields.',
        code: 'SECRET_DETECTED_IN_INPUT',
      });
      return;
    }
    const project = store.addProjectForOwner(identity.resourceOwnerId, parsed.data);
    res.status(201).json({ project: sanitizeProjectForClient(project) });
  });

  app.patch('/api/projects/:id', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = ProjectUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid project update payload.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    if (detectSecretInText(JSON.stringify(parsed.data))) {
      res.status(400).json({
        error:
          'Security guardrail: Project brief, plans, and summaries cannot contain API keys or secrets.',
        code: 'SECRET_DETECTED_IN_INPUT',
      });
      return;
    }
    const updated = store.updateProjectForOwner(
      identity.resourceOwnerId,
      String(req.params.id),
      parsed.data
    );
    if (updated === 'not_found') {
      res.status(404).json({ error: 'Project not found.', code: 'NOT_FOUND' });
      return;
    }
    if (updated === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: You do not have access to another user’s project.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }
    if (updated === 'archived_locked') {
      res.status(409).json({
        error: 'Archived projects are locked against further modification.',
        code: 'PROJECT_ARCHIVED_LOCKED',
      });
      return;
    }
    res.json({ project: sanitizeProjectForClient(updated) });
  });

  app.get('/api/projects/:id/export', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const bundle = store.exportProjectBundleForOwner(
      identity.resourceOwnerId,
      String(req.params.id),
      identity.sessionOwnerId
    );
    if (bundle === 'not_found') {
      res.status(404).json({ error: 'Project not found.', code: 'NOT_FOUND' });
      return;
    }
    if (bundle === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: You do not have access to export another user’s project.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }
    res.json(bundle);
  });

  app.delete('/api/projects/:id', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const removed = store.deleteProjectForOwner(identity.resourceOwnerId, String(req.params.id));
    if (removed === 'not_found') {
      res.status(404).json({ error: 'Project not found.', code: 'NOT_FOUND' });
      return;
    }
    if (removed === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: You cannot delete another user’s project.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }
    res.json({ ok: true });
  });

  // 6. Knowledge Workspace Endpoints (Protected & Per-User Isolated)
  app.get('/api/knowledge', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    res.json({
      storageMode: effectiveStorageMode,
      documents: store
        .listDocumentsForOwner(identity.resourceOwnerId)
        .map(sanitizeDocumentForClient),
      memories: store
        .listMemoriesForOwner(identity.resourceOwnerId)
        .map(sanitizeMemoryForClient),
    });
  });

  app.post('/api/knowledge/documents', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = DocumentIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid document input.' });
      return;
    }
    if (detectSecretInText(parsed.data.content)) {
      res.status(400).json({
        error:
          'Security guardrail: Document contains text matching an API key or private key pattern. Redact secrets before indexing.',
      });
      return;
    }
    const document = store.addDocumentForOwner(identity.resourceOwnerId, parsed.data);
    res.status(201).json({ document: sanitizeDocumentForClient(document) });
  });

  app.delete('/api/knowledge/documents/:id', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const removed = store.deleteDocumentForOwner(identity.resourceOwnerId, String(req.params.id));
    if (removed === 'not_found') {
      res.status(404).json({ error: 'Document not found.', code: 'NOT_FOUND' });
      return;
    }
    if (removed === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: You cannot delete another user’s document.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/knowledge/memories', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = MemoryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid memory note.' });
      return;
    }
    if (detectSecretInText(parsed.data.content) || detectSecretInText(parsed.data.label)) {
      res.status(400).json({
        error: 'Security guardrail: Never store API keys, tokens, or secrets in saved user memory.',
      });
      return;
    }
    const memory = store.addMemoryForOwner(identity.resourceOwnerId, parsed.data);
    res.status(201).json({ memory: sanitizeMemoryForClient(memory) });
  });

  app.delete('/api/knowledge/memories/:id', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const removed = store.deleteMemoryForOwner(identity.resourceOwnerId, String(req.params.id));
    if (removed === 'not_found') {
      res.status(404).json({ error: 'Memory note not found.', code: 'NOT_FOUND' });
      return;
    }
    if (removed === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: You cannot delete another user’s saved memory.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }
    res.json({ ok: true });
  });

  // 7. Protected Per-User Task Execution History & Workflow Lifecycle
  app.get('/api/tasks', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    res.json({
      storageMode: effectiveStorageMode,
      tasks: store.listTasksForOwner(identity.sessionOwnerId).map(sanitizeTaskRunForClient),
      evaluationSuite: EVALUATION_PROMPT_SUITE,
    });
  });

  app.post('/api/tasks/plan', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = TaskWorkflowPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid task plan input.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    if (detectSecretInText(parsed.data.title) || detectSecretInText(parsed.data.objective)) {
      res.status(400).json({
        error: 'Security guardrail: Never submit API keys or secrets into task plans.',
        code: 'SECRET_DETECTED_IN_INPUT',
      });
      return;
    }

    if (parsed.data.projectId) {
      const projCheck = store.getProjectForOwner(identity.resourceOwnerId, parsed.data.projectId);
      if (projCheck === 'forbidden') {
        res.status(403).json({
          error: 'Forbidden: Cannot attach task plan to another user’s project.',
          code: 'FORBIDDEN_RESOURCE_ACCESS',
        });
        return;
      }
    }

    const plannedTask = orchestrator.createWorkflowPlan({
      ...parsed.data,
      ownerSessionId: identity.sessionOwnerId,
      hasDocuments: store.listDocumentsForOwner(identity.resourceOwnerId).length > 0,
      hasMemories: store.listMemoriesForOwner(identity.resourceOwnerId).length > 0,
    });
    store.upsertTaskRun(plannedTask);
    res.status(201).json({ task: sanitizeTaskRunForClient(plannedTask) });
  });

  app.post('/api/tasks/:id/execute', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = TaskWorkflowExecuteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid task execution options.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const existing = store.getTaskForOwner(identity.sessionOwnerId, String(req.params.id));
    if (existing === 'not_found') {
      res.status(404).json({ error: 'Task not found.', code: 'NOT_FOUND' });
      return;
    }
    if (existing === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: Task belongs to another private account or session.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }

    if (existing.requiresApproval && !parsed.data.confirmedByUser) {
      res.status(403).json({
        error:
          'User approval required: Confirm this task explicitly before executing its workflow stages.',
        code: 'APPROVAL_REQUIRED',
        task: sanitizeTaskRunForClient(existing),
      });
      return;
    }

    let project: ProjectWorkspace | undefined;
    if (existing.projectId) {
      const projCheck = store.getProjectForOwner(identity.resourceOwnerId, existing.projectId);
      if (projCheck !== 'not_found' && projCheck !== 'forbidden') {
        project = projCheck;
      }
    }

    try {
      const result = await orchestrator.executeTask({
        message: existing.objective || existing.userRequest,
        history: [],
        preferredAgent: existing.selectedAgent,
        useSentinel: parsed.data.useSentinel,
        researchMode: existing.researchMode,
        mockMode: parsed.data.mockMode,
        ownerSessionId: identity.sessionOwnerId,
        requestedTools: existing.taskPlan?.selectedTools,
        project,
        documents: store.listDocumentsForOwner(identity.resourceOwnerId),
        memories: store.listMemoriesForOwner(identity.resourceOwnerId),
      });

      const mergedRun: StructuredTaskRun = {
        ...result.taskRun,
        taskId: existing.taskId,
        title: existing.title,
        objective: existing.objective || existing.userRequest,
        requiresApproval: existing.requiresApproval,
        approvedByUser: Boolean(parsed.data.confirmedByUser),
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      store.upsertTaskRun(mergedRun);
      res.json({
        ok: true,
        reply: result.reply,
        task: sanitizeTaskRunForClient(mergedRun),
      });
    } catch (err) {
      const attachedRun = (err as { taskRun?: StructuredTaskRun })?.taskRun;
      const failedRun: StructuredTaskRun = {
        ...(attachedRun ?? existing),
        taskId: existing.taskId,
        title: existing.title,
        objective: existing.objective || existing.userRequest,
        requiresApproval: existing.requiresApproval,
        approvedByUser: Boolean(parsed.data.confirmedByUser),
        lifecycleStage: 'FAILED',
        status: 'failed',
        failedStage: attachedRun?.failedStage || 'EXECUTE_TOOLS',
        nextSafeStep:
          attachedRun?.nextSafeStep ||
          'Review the failure reason and retry in Local Mock Mode or after checking server configuration.',
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      store.upsertTaskRun(failedRun);
      const status = err instanceof ModelGatewayError ? err.statusCode : 502;
      const code = err instanceof ModelGatewayError ? err.code : 'ORCHESTRATOR_FAILURE';
      const message =
        err instanceof ModelGatewayError
          ? err.message
          : 'Task execution halted safely. Review recovery guidance.';
      res.status(status).json({
        error: message,
        code,
        retryable: err instanceof ModelGatewayError ? err.retryable : true,
        task: sanitizeTaskRunForClient(failedRun),
      });
    }
  });

  // 7b. Protected Per-User Conversation History Endpoints
  app.get('/api/conversations', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const conversations = store
      .listConversationsForOwner(identity.sessionOwnerId)
      .map(sanitizeConversationForClient);
    res.json({
      storageMode: effectiveStorageMode,
      conversations,
    });
  });

  app.post('/api/conversations', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = ConversationSyncSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid conversation payload.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const { id, title, projectId, archived, messages, createdAt, updatedAt } = parsed.data;
    if (
      detectSecretInText(title) ||
      messages.some((m) => detectSecretInText(m.content))
    ) {
      res.status(400).json({
        error: 'Security guardrail: Conversation contains a restricted secret pattern.',
        code: 'SECRET_DETECTED_IN_INPUT',
      });
      return;
    }

    if (projectId) {
      const projCheck = store.getProjectForOwner(identity.resourceOwnerId, projectId);
      if (projCheck === 'forbidden') {
        res.status(403).json({
          error: 'Forbidden: Cannot link conversation to another user’s project.',
          code: 'FORBIDDEN_RESOURCE_ACCESS',
        });
        return;
      }
    }

    const upserted = store.upsertConversationForOwner(identity.sessionOwnerId, {
      id,
      title,
      projectId,
      archived,
      messages,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: updatedAt || new Date().toISOString(),
    });
    if (upserted === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: Conversation belongs to another private account or session.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }
    res.status(201).json({ conversation: sanitizeConversationForClient(upserted) });
  });

  app.get('/api/conversations/:id', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const found = store.getConversationForOwner(identity.sessionOwnerId, String(req.params.id));
    if (found === 'not_found') {
      res.status(404).json({ error: 'Conversation not found.', code: 'NOT_FOUND' });
      return;
    }
    if (found === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: Conversation belongs to another private account or session.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }
    res.json({ conversation: sanitizeConversationForClient(found) });
  });

  app.patch('/api/conversations/:id', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const parsed = ConversationPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid conversation update.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    if (parsed.data.title && detectSecretInText(parsed.data.title)) {
      res.status(400).json({
        error: 'Security guardrail: Title contains a restricted secret pattern.',
        code: 'SECRET_DETECTED_IN_INPUT',
      });
      return;
    }

    const updated = store.patchConversationForOwner(
      identity.sessionOwnerId,
      String(req.params.id),
      parsed.data
    );
    if (updated === 'not_found') {
      res.status(404).json({ error: 'Conversation not found.', code: 'NOT_FOUND' });
      return;
    }
    if (updated === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: Conversation belongs to another private account or session.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }
    res.json({ conversation: sanitizeConversationForClient(updated) });
  });

  app.delete('/api/conversations/:id', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const result = store.deleteConversationForOwner(identity.sessionOwnerId, String(req.params.id));
    if (result === 'not_found') {
      res.status(404).json({ error: 'Conversation not found.', code: 'NOT_FOUND' });
      return;
    }
    if (result === 'forbidden') {
      res.status(403).json({
        error: 'Forbidden: Conversation belongs to another private account or session.',
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      });
      return;
    }
    res.json({ ok: true });
  });

  // 8. Privacy & Scoped Account Data Purge Controls
  app.post('/api/session/purge', async (req: Request, res: Response) => {
    const identity = await resolveProtectedIdentity(req, res);
    if (!identity) return;

    const scopeRaw = req.body?.scope;
    const validScopes = new Set(['conversations', 'memories', 'documents', 'tasks', 'all']);
    const scope = validScopes.has(scopeRaw) ? scopeRaw : 'all';

    if (identity.verifiedUser) {
      store.clearScope(scope, identity.resourceOwnerId);
    } else {
      const legacyOwner = req.header('x-vaelor-session-token')
        ? identity.sessionOwnerId
        : undefined;
      if (scope === 'conversations' || scope === 'tasks') {
        store.clearScope(scope, legacyOwner);
      } else {
        store.clearScope(scope, undefined);
      }
    }

    res.json({
      ok: true,
      clearedScope: scope,
    });
  });

  // 9. Public Native Android Project Security Audit, Safe File Inspector & Archive Bundle
  app.get('/api/android/status', (_req: Request, res: Response) => {
    const report = auditAndroidProject(__dirname);
    res.json(report);
  });

  app.get('/api/android/file', (req: Request, res: Response) => {
    const reqPath = typeof req.query.path === 'string' ? req.query.path : '';
    const fileResult = readSafeAndroidSourceFile(__dirname, reqPath);
    if (!fileResult) {
      res.status(404).json({
        error: 'Requested Android project file is unavailable or restricted.',
        code: 'FILE_NOT_FOUND',
        retryable: false,
      });
      return;
    }
    res.json(fileResult);
  });

  app.get('/api/android/source-bundle.tar.gz', async (_req: Request, res: Response) => {
    try {
      const archiveBuffer = await createAndroidSourceTarGzBuffer(__dirname);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="aurenyx-vaelor-android-project.tar.gz"'
      );
      res.send(archiveBuffer);
    } catch {
      res.status(503).json({
        error: 'Android source archive could not be generated.',
        code: 'ARCHIVE_UNAVAILABLE',
        retryable: true,
      });
    }
  });

  // 10. Unknown /api/* JSON 404 & Global Sanitized Error Boundary (never leaks stack traces or keys)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Requested API endpoint does not exist.',
      code: 'ENDPOINT_NOT_FOUND',
      retryable: false,
    });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const rawMsg =
      err instanceof ModelGatewayError
        ? sanitizeErrorMessageForClient(err.message)
        : 'An unexpected server error occurred. Internal details were redacted.';
    const status = err instanceof ModelGatewayError ? err.statusCode : 500;
    const code = err instanceof ModelGatewayError ? err.code : 'INTERNAL_SERVER_ERROR';
    const retryable = err instanceof ModelGatewayError ? err.retryable : true;
    res.status(status).json({
      error: rawMsg,
      code,
      retryable,
    });
  });

  return { app, store, orchestrator, gateway };
}

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const { app } = createApiApp({ requireAuth: true });
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: hmrDisabled ? false : { server: httpServer },
        watch: hmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Aurenyx Vaelor 0.3 server listening on http://0.0.0.0:${port}`);
  });
}

// Only start HTTP listener when executed directly (not when imported by node:test unit tests)
const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  startServer().catch((err) => {
    console.error(
      'Failed to start Aurenyx Vaelor server:',
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  });
}
