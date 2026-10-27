import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_DEFINITIONS } from './src/server/agents.ts';
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
  detectSecretInText,
  DocumentIngestSchema,
  MemoryCreateSchema,
  ProjectCreateSchema,
  SlidingWindowRateLimiter,
  StudioVisualRequestSchema,
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
  type HealthResponse,
  type StructuredTaskRun,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppServerDependencies {
  gateway?: ModelGateway;
  store?: EphemeralSessionStore;
  rateLimitPerMinute?: number;
}

export function createApiApp(deps: AppServerDependencies = {}) {
  const app = express();
  const gateway = deps.gateway ?? new GeminiModelGateway(process.env);
  const store = deps.store ?? new EphemeralSessionStore(true);
  const orchestrator = new VaelorOrchestrator(gateway);
  const rateLimitMax = deps.rateLimitPerMinute ?? 20;
  const limiter = new SlidingWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: rateLimitMax,
  });

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

  // Rate limit /api endpoints: strict budget on mutations/AI calls, high-headroom guard on GET hydration
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'local';
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

  // 1. Health & Configuration Status (never returns API keys!)
  app.get('/api/health', (_req: Request, res: Response) => {
    const status = gateway.getStatus();
    const payload: HealthResponse = {
      ok: true,
      configured: status.configured,
      provider: status.provider,
      primaryModel: status.configured ? status.primaryModel : undefined,
      fastModel: status.configured ? status.fastModel : undefined,
      paidModelsEnabled: status.paidModelsEnabled,
      liveSearchConfigured: Boolean(status.liveSearchConfigured),
      maxStepsPerRequest: MAX_ORCHESTRATOR_MODEL_STEPS,
      rateLimitPerMinute: rateLimitMax,
      storageMode: 'in-memory-ephemeral',
      storageNotice:
        'Temporary in-memory session state is active (₹0 Free Tier). Optional local browser history persistence can be enabled in Settings.',
      attribution: {
        productName: OFFICIAL_ATTRIBUTION.productName,
        founderOrganization: OFFICIAL_ATTRIBUTION.founderOrganization,
        founderName: OFFICIAL_ATTRIBUTION.founderName,
        statement: OFFICIAL_ATTRIBUTION.statement,
      },
      counts: {
        conversations: store.conversations.length,
        memories: store.memories.length,
        documents: store.documents.length,
        projects: store.projects.length,
        tasks: store.taskRuns.length,
      },
    };
    res.json(payload);
  });

  // 1b. Normalized Capabilities & Staged Integration Summary
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
        setupGuide: tool.setupGuide,
      })),
    });
  });

  // 2. Agents & Tools metadata
  app.get('/api/agents', (_req: Request, res: Response) => {
    const agentStats = Object.values(AGENT_DEFINITIONS).map((agent) => {
      const runs = store.taskRuns.filter((r) => r.selectedAgent === agent.id);
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
      resultFormat: tool.resultFormat,
      setupGuide: tool.setupGuide,
    }));

    res.json({ agents: agentStats, tools });
  });

  // 3. Primary Multi-Agent Orchestrator Endpoint (Unary JSON)
  app.post('/api/chat', async (req: Request, res: Response) => {
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

    const project = projectId ? store.projects.find((p) => p.id === projectId) : undefined;

    try {
      const result = await orchestrator.executeTask({
        message,
        history,
        preferredAgent,
        useSentinel,
        researchMode,
        requestedTools,
        attachments,
        project,
        documents: store.documents,
        memories: store.memories,
        conversationId,
      });

      store.recordTaskRun(result.taskRun);
      res.json({
        reply: result.reply,
        taskRun: result.taskRun,
        generatedSvgBlueprint: result.generatedSvgBlueprint,
      });
    } catch (err) {
      const attachedRun = (err as { taskRun?: StructuredTaskRun })?.taskRun;
      if (attachedRun) {
        store.recordTaskRun(attachedRun);
      }

      if (err instanceof ModelGatewayError) {
        res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
          retryable: err.retryable,
          taskRun: attachedRun,
        });
        return;
      }

      res.status(502).json({
        error: 'The orchestrator could not complete the request safely. Please try again.',
        code: 'ORCHESTRATOR_FAILURE',
        retryable: true,
        taskRun: attachedRun,
      });
    }
  });

  // 3b. Streaming Multi-Agent Orchestrator Endpoint (SSE)
  app.post('/api/chat/stream', async (req: Request, res: Response) => {
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

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (event: AIStreamEvent) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    const project = projectId ? store.projects.find((p) => p.id === projectId) : undefined;

    try {
      const result = await orchestrator.executeTask({
        message,
        history,
        preferredAgent,
        useSentinel,
        researchMode,
        requestedTools,
        attachments,
        project,
        documents: store.documents,
        memories: store.memories,
        conversationId,
        onStreamEvent: writeEvent,
      });

      store.recordTaskRun(result.taskRun);
      writeEvent({
        type: 'complete',
        reply: result.reply,
        taskRun: result.taskRun,
        generatedSvgBlueprint: result.generatedSvgBlueprint,
      });
      res.end();
    } catch (err) {
      const attachedRun = (err as { taskRun?: StructuredTaskRun })?.taskRun;
      if (attachedRun) {
        store.recordTaskRun(attachedRun);
      }
      const code = err instanceof ModelGatewayError ? err.code : 'ORCHESTRATOR_FAILURE';
      const errMessage =
        err instanceof ModelGatewayError
          ? err.message
          : 'The orchestrator could not complete the request safely. Please try again.';
      const retryable = err instanceof ModelGatewayError ? err.retryable : true;

      writeEvent({
        type: 'error',
        taskRun: attachedRun,
        error: {
          code,
          message: errMessage,
          retryable,
        },
      });
      res.end();
    }
  });

  // 3c. Direct Deterministic Tool Execution Endpoint (used by Interactive Landing Demo & Data Utilities)
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

    const toolDef = TOOL_REGISTRY[tool];
    const authorizedAgent = toolDef.allowedAgents[0] ?? 'vaelor-core';

    const { record } = await executeToolWithPermissions({
      agentId: authorizedAgent,
      toolName: tool,
      rawArgs: args,
      context: {
        documents: store.documents,
        memories: store.memories,
        confirmedByUser,
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

  // 4. Visual Studio / Image Aspect & Size Endpoint (honors ₹0 Free-Tier Guardrail + SVG Blueprint Fallback)
  app.post('/api/studio/visual', async (req: Request, res: Response) => {
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

  // 5. Projects Endpoints
  app.get('/api/projects', (_req: Request, res: Response) => {
    res.json({
      storageMode: 'in-memory-ephemeral',
      projects: store.projects,
    });
  });

  app.post('/api/projects', (req: Request, res: Response) => {
    const parsed = ProjectCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid project data.' });
      return;
    }
    const project = store.addProject(parsed.data);
    res.status(201).json({ project });
  });

  app.delete('/api/projects/:id', (req: Request, res: Response) => {
    const removed = store.deleteProject(String(req.params.id));
    if (!removed) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // 6. Knowledge Workspace Endpoints (Indexed Documents + Explicitly Saved Memories kept separate!)
  app.get('/api/knowledge', (_req: Request, res: Response) => {
    res.json({
      storageMode: 'in-memory-ephemeral',
      documents: store.documents,
      memories: store.memories,
    });
  });

  app.post('/api/knowledge/documents', (req: Request, res: Response) => {
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
    const document = store.addDocument(parsed.data);
    res.status(201).json({ document });
  });

  app.delete('/api/knowledge/documents/:id', (req: Request, res: Response) => {
    const removed = store.deleteDocument(String(req.params.id));
    if (!removed) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/knowledge/memories', (req: Request, res: Response) => {
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
    const memory = store.addMemory(parsed.data);
    res.status(201).json({ memory });
  });

  app.delete('/api/knowledge/memories/:id', (req: Request, res: Response) => {
    const removed = store.deleteMemory(String(req.params.id));
    if (!removed) {
      res.status(404).json({ error: 'Memory note not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // 7. Task Execution History & Evaluation Suite
  app.get('/api/tasks', (_req: Request, res: Response) => {
    res.json({
      storageMode: 'in-memory-ephemeral',
      tasks: store.taskRuns,
      evaluationSuite: EVALUATION_PROMPT_SUITE,
    });
  });

  // 8. Privacy & Session Data Purge Controls
  app.post('/api/session/purge', (req: Request, res: Response) => {
    const scopeRaw = req.body?.scope;
    const validScopes = new Set(['conversations', 'memories', 'documents', 'tasks', 'all']);
    const scope = validScopes.has(scopeRaw) ? scopeRaw : 'all';
    store.clearScope(scope);
    res.json({
      ok: true,
      clearedScope: scope,
    });
  });

  // 9. Native Android Project Security Audit, Safe File Inspector & Archive Bundle
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
  const { app } = createApiApp();
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
    console.log(`Aurenyx Vaelor 0.1 server listening on http://0.0.0.0:${port}`);
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
