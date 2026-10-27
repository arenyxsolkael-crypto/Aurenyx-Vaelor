import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AgentId,
  AgentMetadata,
  AIStreamEvent,
  ChatAttachment,
  ChatMessage,
  Conversation,
  EvaluationPromptCase,
  HealthResponse,
  ImageAspectRatio,
  ImageResolutionSize,
  KnowledgeDocument,
  ProjectWorkspace,
  ResponseLength,
  ResponseTone,
  SavedMemory,
  StructuredTaskRun,
  ToolAvailability,
  ToolStage,
} from '../shared/types';

export interface AgentWithStats extends AgentMetadata {
  totalRuns: number;
  completedRuns: number;
  lastStatus: string;
  lastActiveAt: string | null;
}

export interface ToolInfo {
  name: string;
  stage?: ToolStage;
  availability?: ToolAvailability;
  requiresConfirmation?: boolean;
  description: string;
  allowedAgents: AgentId[];
  timeoutMs: number;
  maxCallsPerTask?: number;
  errorStrategy?: string;
  outputSchemaSummary?: string;
  resultFormat: string;
  setupGuide?: string;
}

export type GatewayStatusState = 'checking' | 'ready' | 'setup' | 'offline';
export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'vaelor_theme_mode';
const PERSIST_PREF_KEY = 'vaelor_local_persist_enabled';
const CONVERSATIONS_STORAGE_KEY = 'vaelor_saved_conversations_v1';
const SESSION_TOKEN_STORAGE_KEY = 'vaelor_session_token_v1';

interface WorkspaceContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;

  localPersistenceEnabled: boolean;
  setLocalPersistenceEnabled: (enabled: boolean) => void;
  streamingEnabled: boolean;
  setStreamingEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  gatewayState: GatewayStatusState;
  health: HealthResponse | null;
  refreshHealth: () => Promise<void>;

  conversations: Conversation[];
  activeConversation: Conversation;
  selectConversation: (id: string) => void;
  startNewConversation: (initialDraft?: string) => void;
  renameConversation: (id: string, title: string) => void;
  archiveConversation: (id: string, archived: boolean) => void;
  clearActiveConversation: () => void;
  deleteConversation: (id: string) => void;

  draftInput: string;
  setDraftInput: React.Dispatch<React.SetStateAction<string>>;
  preferredAgent: AgentId | 'auto';
  setPreferredAgent: React.Dispatch<React.SetStateAction<AgentId | 'auto'>>;
  useSentinel: boolean;
  setUseSentinel: React.Dispatch<React.SetStateAction<boolean>>;
  researchMode: boolean;
  setResearchMode: React.Dispatch<React.SetStateAction<boolean>>;
  tone: ResponseTone;
  setTone: React.Dispatch<React.SetStateAction<ResponseTone>>;
  responseLength: ResponseLength;
  setResponseLength: React.Dispatch<React.SetStateAction<ResponseLength>>;
  mockMode: boolean;
  setMockMode: React.Dispatch<React.SetStateAction<boolean>>;

  pendingAttachments: ChatAttachment[];
  addAttachment: (att: ChatAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  isSending: boolean;
  activeStage: string;
  composerError: string | null;
  dismissComposerError: () => void;
  sendMessage: (
    overrideMessage?: string,
    options?: {
      researchModeOverride?: boolean;
      bypassCache?: boolean;
      truncateFromMessageId?: string;
      isEditedPrompt?: boolean;
    }
  ) => Promise<void>;
  stopWaiting: () => void;
  retryFailedMessage: (failedPrompt: string) => Promise<void>;
  editUserMessage: (messageId: string, newContent: string) => Promise<void>;
  regenerateResponse: (assistantMessageId: string) => Promise<void>;
  generateVisualBlueprint: (params: {
    prompt: string;
    aspectRatio: ImageAspectRatio;
    imageSize: ImageResolutionSize;
  }) => Promise<void>;

  projects: ProjectWorkspace[];
  activeProjectId: string | undefined;
  setActiveProjectId: React.Dispatch<React.SetStateAction<string | undefined>>;
  createProject: (data: {
    name: string;
    objective: string;
    category: ProjectWorkspace['category'];
  }) => Promise<{ ok: boolean; error?: string }>;
  removeProject: (id: string) => Promise<void>;

  documents: KnowledgeDocument[];
  memories: SavedMemory[];
  ingestDocument: (data: {
    title: string;
    fileName?: string;
    sourceKind: 'upload' | 'paste';
    content: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  removeDocument: (id: string) => Promise<void>;
  saveMemory: (data: {
    label: string;
    content: string;
    category: SavedMemory['category'];
  }) => Promise<{ ok: boolean; error?: string }>;
  removeMemory: (id: string) => Promise<void>;

  agents: AgentWithStats[];
  tools: ToolInfo[];
  tasks: StructuredTaskRun[];
  evaluationSuite: EvaluationPromptCase[];
  refreshWorkspaceData: () => Promise<void>;
  purgeSessionData: (
    scope: 'conversations' | 'memories' | 'documents' | 'tasks' | 'all'
  ) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function makeEmptyConversation(projectId?: string): Conversation {
  const now = new Date().toISOString();
  return {
    id: `conv_${crypto.randomUUID().slice(0, 8)}`,
    title: 'Untitled session',
    projectId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function readInitialTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function readPersistencePref(): boolean {
  try {
    return window.localStorage.getItem(PERSIST_PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

function readStoredConversations(fallback: Conversation): Conversation[] {
  try {
    if (window.localStorage.getItem(PERSIST_PREF_KEY) !== 'true') {
      return [fallback];
    }
    const raw = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) return [fallback];
    const parsed = JSON.parse(raw) as Conversation[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Ignore malformed storage
  }
  return [fallback];
}

function readOrCreateSessionToken(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) {
      return existing;
    }
    const created = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
    window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, created);
    return created;
  } catch {
    return `sess_${crypto.randomUUID().replace(/-/g, '')}`;
  }
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionToken] = useState<string>(() => readOrCreateSessionToken());
  const [theme, setThemeState] = useState<ThemeMode>(() => readInitialTheme());
  const [localPersistenceEnabled, setLocalPersistenceState] = useState<boolean>(() =>
    readPersistencePref()
  );
  const [streamingEnabled, setStreamingEnabled] = useState(true);

  const [gatewayState, setGatewayState] = useState<GatewayStatusState>('checking');
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const initialConv = useMemo(() => makeEmptyConversation('proj_vaelor_01'), []);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    readStoredConversations(initialConv)
  );
  const [activeConversationId, setActiveConversationId] = useState<string>(
    () => conversations[0]?.id ?? initialConv.id
  );

  const [draftInput, setDraftInput] = useState('');
  const [preferredAgent, setPreferredAgent] = useState<AgentId | 'auto'>('auto');
  const [useSentinel, setUseSentinel] = useState(true);
  const [researchMode, setResearchMode] = useState(false);
  const [tone, setTone] = useState<ResponseTone>('balanced');
  const [responseLength, setResponseLength] = useState<ResponseLength>('standard');
  const [mockMode, setMockMode] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);

  const [isSending, setIsSending] = useState(false);
  const [activeStage, setActiveStage] = useState('Idle · Ready for task');
  const [composerError, setComposerError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>('proj_vaelor_01');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [memories, setMemories] = useState<SavedMemory[]>([]);
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [tasks, setTasks] = useState<StructuredTaskRun[]>([]);
  const [evaluationSuite, setEvaluationSuite] = useState<EvaluationPromptCase[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage error
    }
  }, [theme]);

  useEffect(() => {
    try {
      if (localPersistenceEnabled) {
        const sanitized = conversations.slice(0, 20).map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({ ...m, isStreaming: false })),
        }));
        window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(sanitized));
      } else {
        window.localStorage.removeItem(CONVERSATIONS_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [conversations, localPersistenceEnabled]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setLocalPersistenceEnabled = useCallback((enabled: boolean) => {
    setLocalPersistenceState(enabled);
    try {
      window.localStorage.setItem(PERSIST_PREF_KEY, enabled ? 'true' : 'false');
      if (!enabled) {
        window.localStorage.removeItem(CONVERSATIONS_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const addAttachment = useCallback((att: ChatAttachment) => {
    setPendingAttachments((prev) => [...prev.slice(-1), att]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setPendingAttachments([]);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.status === 429) {
        return;
      }
      if (!res.ok) {
        setGatewayState('offline');
        return;
      }
      const data = (await res.json()) as HealthResponse;
      setHealth(data);
      setGatewayState(data.configured ? 'ready' : 'setup');
    } catch {
      setGatewayState('offline');
    }
  }, []);

  const refreshWorkspaceData = useCallback(async () => {
    try {
      const [projRes, knowRes, agentsRes, tasksRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/knowledge'),
        fetch('/api/agents'),
        fetch('/api/tasks'),
      ]);

      if (projRes.ok) {
        const d = (await projRes.json()) as { projects: ProjectWorkspace[] };
        setProjects(d.projects ?? []);
      }
      if (knowRes.ok) {
        const d = (await knowRes.json()) as {
          documents: KnowledgeDocument[];
          memories: SavedMemory[];
        };
        setDocuments(d.documents ?? []);
        setMemories(d.memories ?? []);
      }
      if (agentsRes.ok) {
        const d = (await agentsRes.json()) as { agents: AgentWithStats[]; tools: ToolInfo[] };
        setAgents(d.agents ?? []);
        setTools(d.tools ?? []);
      }
      if (tasksRes.ok) {
        const d = (await tasksRes.json()) as {
          tasks: StructuredTaskRun[];
          evaluationSuite: EvaluationPromptCase[];
        };
        setTasks(d.tasks ?? []);
        setEvaluationSuite(d.evaluationSuite ?? []);
      }
    } catch {
      // Handled gracefully by offline status
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    void refreshWorkspaceData();
  }, [refreshHealth, refreshWorkspaceData]);

  const activeConversation = useMemo(() => {
    return (
      conversations.find((c) => c.id === activeConversationId) ?? conversations[0] ?? initialConv
    );
  }, [conversations, activeConversationId, initialConv]);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setComposerError(null);
  }, []);

  const startNewConversation = useCallback(
    (initialDraft?: string) => {
      const fresh = makeEmptyConversation(activeProjectId);
      setConversations((prev) => [fresh, ...prev]);
      setActiveConversationId(fresh.id);
      setComposerError(null);
      setActiveStage('Idle · Ready for task');
      if (typeof initialDraft === 'string') {
        setDraftInput(initialDraft);
      }
    },
    [activeProjectId]
  );

  const syncConversationToServer = useCallback(
    async (conv: Conversation) => {
      try {
        await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vaelor-Session-Token': sessionToken,
          },
          body: JSON.stringify({
            id: conv.id,
            title: conv.title,
            projectId: conv.projectId,
            archived: Boolean(conv.archived),
            messages: conv.messages
              .filter((m) => !m.isStreaming)
              .slice(-60)
              .map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content.slice(0, 19500),
                createdAt: m.createdAt,
                editedAt: m.editedAt,
                agentId: m.agentId,
                agentName: m.agentName,
                isMockResponse: m.isMockResponse,
              })),
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
          }),
        });
      } catch {
        // Offline / ephemeral fallback
      }
    },
    [sessionToken]
  );

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const clean = title.trim().slice(0, 72);
      if (!clean) return;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c, title: clean, updatedAt: new Date().toISOString() };
          void fetch(`/api/conversations/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-Vaelor-Session-Token': sessionToken,
            },
            body: JSON.stringify({ title: clean }),
          }).catch(() => {});
          return next;
        })
      );
    },
    [sessionToken]
  );

  const archiveConversation = useCallback(
    (id: string, archived: boolean) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === id ? { ...c, archived, updatedAt: new Date().toISOString() } : c
        );
        if (archived && id === activeConversationId) {
          const nextActive = updated.find((c) => !c.archived && c.id !== id);
          if (nextActive) {
            setActiveConversationId(nextActive.id);
          } else {
            const fresh = makeEmptyConversation(activeProjectId);
            setActiveConversationId(fresh.id);
            void fetch(`/api/conversations/${encodeURIComponent(id)}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-Vaelor-Session-Token': sessionToken,
              },
              body: JSON.stringify({ archived }),
            }).catch(() => {});
            return [fresh, ...updated];
          }
        }
        void fetch(`/api/conversations/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Vaelor-Session-Token': sessionToken,
          },
          body: JSON.stringify({ archived }),
        }).catch(() => {});
        return updated;
      });
    },
    [activeConversationId, activeProjectId, sessionToken]
  );

  const clearActiveConversation = useCallback(() => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              title: 'Untitled session',
              messages: [],
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );
    setComposerError(null);
    setActiveStage('Idle · Conversation cleared');
  }, [activeConversation.id]);

  const deleteConversation = useCallback(
    (id: string) => {
      void fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'X-Vaelor-Session-Token': sessionToken },
      }).catch(() => {});
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (remaining.length === 0) {
          const fresh = makeEmptyConversation(activeProjectId);
          setActiveConversationId(fresh.id);
          return [fresh];
        }
        if (id === activeConversationId) {
          const preferred = remaining.find((c) => !c.archived) ?? remaining[0];
          setActiveConversationId(preferred.id);
        }
        return remaining;
      });
    },
    [activeConversationId, activeProjectId, sessionToken]
  );

  const stopWaiting = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSending(false);
    setActiveStage('Stopped by user');
  }, []);

  const sendMessage = useCallback(
    async (
      overrideMessage?: string,
      options?: {
        researchModeOverride?: boolean;
        bypassCache?: boolean;
        truncateFromMessageId?: string;
        isEditedPrompt?: boolean;
      }
    ) => {
      const text = (overrideMessage ?? draftInput).trim();
      if (!text || isSending) return;

      const attachmentsToSend = [...pendingAttachments];
      const effectiveResearchMode = options?.researchModeOverride ?? researchMode;

      setComposerError(null);
      if (!overrideMessage) {
        setDraftInput('');
        setPendingAttachments([]);
      }

      const convId = activeConversation.id;
      const truncateIdx = options?.truncateFromMessageId
        ? activeConversation.messages.findIndex((m) => m.id === options.truncateFromMessageId)
        : -1;
      const baseMessages =
        truncateIdx >= 0
          ? activeConversation.messages.slice(0, truncateIdx)
          : activeConversation.messages;
      const priorMessages = baseMessages.filter((m) => !m.error && !m.isStreaming);
      const nowIso = new Date().toISOString();

      const userMsg: ChatMessage = {
        id: `msg_${crypto.randomUUID().slice(0, 8)}`,
        role: 'user',
        content: text,
        createdAt: nowIso,
        editedAt: options?.isEditedPrompt ? nowIso : undefined,
        attachments:
          attachmentsToSend.length > 0
            ? attachmentsToSend.map((a) => ({
                id: a.id,
                name: a.name,
                mimeType: a.mimeType,
                kind: a.kind,
                sizeBytes: a.sizeBytes,
              }))
            : undefined,
      };

      const streamingMsgId = `msg_${crypto.randomUUID().slice(0, 8)}`;

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const sliced =
            truncateIdx >= 0 ? c.messages.slice(0, truncateIdx) : c.messages;
          const nextTitle =
            sliced.length === 0 && c.title === 'Untitled session'
              ? text.slice(0, 44) + (text.length > 44 ? '…' : '')
              : c.title;
          return {
            ...c,
            title: nextTitle,
            messages: [...sliced, userMsg],
            updatedAt: nowIso,
          };
        })
      );

      setIsSending(true);
      setActiveStage('Validating & classifying task…');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestBody = {
        message: text,
        conversationId: convId,
        projectId: activeProjectId,
        preferredAgent: preferredAgent === 'auto' ? undefined : preferredAgent,
        useSentinel,
        researchMode: effectiveResearchMode,
        tone,
        responseLength,
        mockMode,
        bypassCache: Boolean(options?.bypassCache),
        attachments: attachmentsToSend,
        history: priorMessages.slice(-24).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      try {
        if (streamingEnabled) {
          const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Vaelor-Session-Token': sessionToken,
            },
            signal: controller.signal,
            body: JSON.stringify(requestBody),
          });

          const contentType = res.headers.get('content-type') || '';
          if (!res.ok || !contentType.includes('text/event-stream') || !res.body) {
            const errData = (await res.json().catch(() => ({}))) as {
              error?: string;
              code?: string;
              retryable?: boolean;
              taskRun?: StructuredTaskRun;
            };
            const errMessage = errData.error || 'The request failed safely. Please retry.';
            setComposerError(errMessage);
            setActiveStage('Execution halted — see error');

            const errAssistantMsg: ChatMessage = {
              id: streamingMsgId,
              role: 'assistant',
              content: errMessage,
              createdAt: new Date().toISOString(),
              agentName: 'Vaelor Gateway',
              failedPrompt: text,
              taskRun: errData.taskRun,
              error: {
                code: errData.code || 'REQUEST_FAILED',
                message: errMessage,
                retryable: errData.retryable ?? true,
              },
            };
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      messages: [...c.messages, errAssistantMsg],
                      updatedAt: new Date().toISOString(),
                    }
                  : c
              )
            );
            await refreshWorkspaceData();
            await refreshHealth();
            return;
          }

          // Insert placeholder streaming assistant message
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: [
                      ...c.messages,
                      {
                        id: streamingMsgId,
                        role: 'assistant',
                        content: '',
                        createdAt: new Date().toISOString(),
                        agentName: 'Vaelor Orchestrator',
                        isStreaming: true,
                      },
                    ],
                    updatedAt: new Date().toISOString(),
                  }
                : c
            )
          );

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let accumulated = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const events = buffer.split('\n\n');
            buffer = events.pop() ?? '';

            for (const rawBlock of events) {
              const dataLine = rawBlock
                .split('\n')
                .find((l) => l.startsWith('data: '));
              if (!dataLine) continue;

              let evt: AIStreamEvent;
              try {
                evt = JSON.parse(dataLine.slice(6)) as AIStreamEvent;
              } catch {
                continue;
              }

              if (evt.type === 'stage' && evt.stage) {
                setActiveStage(evt.stage);
              } else if (evt.type === 'delta' && evt.delta) {
                accumulated += evt.delta;
                const snapshot = accumulated;
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === streamingMsgId ? { ...m, content: snapshot } : m
                          ),
                        }
                      : c
                  )
                );
              } else if (evt.type === 'complete') {
                const finalReply = evt.reply ?? accumulated;
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== convId) return c;
                    const updatedConv: Conversation = {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === streamingMsgId
                          ? {
                              ...m,
                              content: finalReply,
                              agentId: evt.taskRun?.selectedAgent,
                              agentName: evt.taskRun?.agentName || 'Vaelor Core',
                              taskRun: evt.taskRun,
                              generatedSvgBlueprint: evt.generatedSvgBlueprint,
                              isStreaming: false,
                              isMockResponse: Boolean(evt.taskRun?.isMockResponse),
                            }
                          : m
                      ),
                      updatedAt: new Date().toISOString(),
                    };
                    void syncConversationToServer(updatedConv);
                    return updatedConv;
                  })
                );
                setActiveStage(
                  `Completed via ${evt.taskRun?.agentName || 'Vaelor Core'} (${
                    evt.taskRun?.stepCount ?? 1
                  }/${evt.taskRun?.maxSteps ?? 4} steps)`
                );
              } else if (evt.type === 'error' && evt.error) {
                setComposerError(evt.error.message);
                setActiveStage('Execution halted — see error');
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === streamingMsgId
                              ? {
                                  ...m,
                                  content: evt.error!.message,
                                  agentName: 'Vaelor Gateway',
                                  failedPrompt: text,
                                  taskRun: evt.taskRun,
                                  error: evt.error,
                                  isStreaming: false,
                                }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }
            }
          }

          await refreshWorkspaceData();
          await refreshHealth();
          return;
        }

        // Unary fallback path when streaming toggle is off
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vaelor-Session-Token': sessionToken,
          },
          signal: controller.signal,
          body: JSON.stringify(requestBody),
        });

        const data = (await res.json().catch(() => ({}))) as {
          reply?: string;
          error?: string;
          code?: string;
          retryable?: boolean;
          taskRun?: StructuredTaskRun;
          generatedSvgBlueprint?: string;
        };

        if (!res.ok || !data.reply) {
          const errMessage = data.error || 'The request failed safely. Please retry.';
          setComposerError(errMessage);
          setActiveStage('Execution halted — see error');

          const errAssistantMsg: ChatMessage = {
            id: streamingMsgId,
            role: 'assistant',
            content: errMessage,
            createdAt: new Date().toISOString(),
            agentName: 'Vaelor Gateway',
            failedPrompt: text,
            taskRun: data.taskRun,
            error: {
              code: data.code || 'REQUEST_FAILED',
              message: errMessage,
              retryable: data.retryable ?? true,
            },
          };

          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: [...c.messages, errAssistantMsg],
                    updatedAt: new Date().toISOString(),
                  }
                : c
            )
          );
          await refreshWorkspaceData();
          await refreshHealth();
          return;
        }

        const assistantMsg: ChatMessage = {
          id: streamingMsgId,
          role: 'assistant',
          content: data.reply,
          createdAt: new Date().toISOString(),
          agentId: data.taskRun?.selectedAgent,
          agentName: data.taskRun?.agentName || 'Vaelor Core',
          taskRun: data.taskRun,
          generatedSvgBlueprint: data.generatedSvgBlueprint,
          isMockResponse: Boolean(data.taskRun?.isMockResponse),
        };

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            const updatedConv: Conversation = {
              ...c,
              messages: [...c.messages, assistantMsg],
              updatedAt: new Date().toISOString(),
            };
            void syncConversationToServer(updatedConv);
            return updatedConv;
          })
        );

        setActiveStage(
          `Completed via ${data.taskRun?.agentName || 'Vaelor Core'} (${
            data.taskRun?.stepCount ?? 1
          }/${data.taskRun?.maxSteps ?? 4} steps)`
        );
        await refreshWorkspaceData();
        await refreshHealth();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setActiveStage('Request cancelled by user');
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === streamingMsgId ? { ...m, isStreaming: false } : m
                    ),
                  }
                : c
            )
          );
          return;
        }
        const fallbackMsg =
          err instanceof Error
            ? err.message
            : 'Network disconnection: unable to reach the Vaelor backend.';
        setComposerError(fallbackMsg);
        setActiveStage('Network or backend error');
      } finally {
        abortControllerRef.current = null;
        setIsSending(false);
      }
    },
    [
      draftInput,
      isSending,
      pendingAttachments,
      researchMode,
      activeConversation,
      activeProjectId,
      preferredAgent,
      useSentinel,
      tone,
      responseLength,
      mockMode,
      sessionToken,
      streamingEnabled,
      syncConversationToServer,
      refreshWorkspaceData,
      refreshHealth,
    ]
  );

  const retryFailedMessage = useCallback(
    async (failedPrompt: string) => {
      await sendMessage(failedPrompt, { bypassCache: true });
    },
    [sendMessage]
  );

  const editUserMessage = useCallback(
    async (messageId: string, newContent: string) => {
      const trimmed = newContent.trim();
      if (!trimmed || isSending) return;
      await sendMessage(trimmed, {
        bypassCache: true,
        truncateFromMessageId: messageId,
        isEditedPrompt: true,
      });
    },
    [isSending, sendMessage]
  );

  const regenerateResponse = useCallback(
    async (assistantMessageId: string) => {
      if (isSending) return;
      const msgs = activeConversation.messages;
      const assistantIdx = msgs.findIndex((m) => m.id === assistantMessageId);
      if (assistantIdx < 0) return;
      let userMsgToReplay: ChatMessage | undefined;
      for (let idx = assistantIdx - 1; idx >= 0; idx -= 1) {
        if (msgs[idx].role === 'user') {
          userMsgToReplay = msgs[idx];
          break;
        }
      }
      if (!userMsgToReplay) return;
      await sendMessage(userMsgToReplay.content, {
        bypassCache: true,
        truncateFromMessageId: userMsgToReplay.id,
      });
    },
    [activeConversation.messages, isSending, sendMessage]
  );

  const generateVisualBlueprint = useCallback(
    async (params: {
      prompt: string;
      aspectRatio: ImageAspectRatio;
      imageSize: ImageResolutionSize;
    }) => {
      if (isSending) return;
      const trimmed = params.prompt.trim();
      if (!trimmed) return;

      setIsSending(true);
      setComposerError(null);
      setActiveStage(`Checking Visual Studio policy (${params.aspectRatio} · ${params.imageSize})…`);

      const convId = activeConversation.id;
      const userMsg: ChatMessage = {
        id: `msg_${crypto.randomUUID().slice(0, 8)}`,
        role: 'user',
        content: `[Visual Studio Request · Aspect ${params.aspectRatio} · Size ${params.imageSize}] ${trimmed}`,
        createdAt: new Date().toISOString(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                title: c.messages.length === 0 ? `Visual: ${trimmed.slice(0, 34)}` : c.title,
                messages: [...c.messages, userMsg],
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );

      try {
        const res = await fetch('/api/studio/visual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: trimmed,
            aspectRatio: params.aspectRatio,
            imageSize: params.imageSize,
            qualityTier: 'studio',
            generateFreeBlueprintFallback: true,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          svgBlueprint?: string;
          imageDataUrl?: string;
          caption?: string;
        };

        const replyContent = res.ok
          ? data.caption || `Generated Studio Image (${params.aspectRatio}, ${params.imageSize}).`
          : `**₹0 Free-Tier Notice:** ${
              data.error ||
              'Studio raster image generation requires a paid API key and is disabled.'
            }\n\nGenerated a zero-cost **SVG Architectural Frame Blueprint** matching your exact **${
              params.aspectRatio
            }** aspect ratio and **${params.imageSize}** target specification below:`;

        const assistantMsg: ChatMessage = {
          id: `msg_${crypto.randomUUID().slice(0, 8)}`,
          role: 'assistant',
          content: replyContent,
          createdAt: new Date().toISOString(),
          agentId: 'vaelor-forge',
          agentName: 'Vaelor Forge · Visual Spec',
          generatedSvgBlueprint: data.svgBlueprint,
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: [...c.messages, assistantMsg],
                  updatedAt: new Date().toISOString(),
                }
              : c
          )
        );
        setActiveStage('Visual frame blueprint generated (₹0 Free Tier)');
      } catch {
        setComposerError('Unable to reach Visual Studio endpoint.');
      } finally {
        setIsSending(false);
      }
    },
    [activeConversation.id, isSending]
  );

  const createProject = useCallback(
    async (data: {
      name: string;
      objective: string;
      category: ProjectWorkspace['category'];
    }) => {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as { project?: ProjectWorkspace; error?: string };
        if (!res.ok || !json.project) {
          return { ok: false, error: json.error || 'Could not create project.' };
        }
        await refreshWorkspaceData();
        await refreshHealth();
        setActiveProjectId(json.project.id);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error creating project.' };
      }
    },
    [refreshWorkspaceData, refreshHealth]
  );

  const removeProject = useCallback(
    async (id: string) => {
      await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (activeProjectId === id) {
        setActiveProjectId(undefined);
      }
      await refreshWorkspaceData();
      await refreshHealth();
    },
    [activeProjectId, refreshWorkspaceData, refreshHealth]
  );

  const ingestDocument = useCallback(
    async (data: {
      title: string;
      fileName?: string;
      sourceKind: 'upload' | 'paste';
      content: string;
    }) => {
      try {
        const res = await fetch('/api/knowledge/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as { document?: KnowledgeDocument; error?: string };
        if (!res.ok || !json.document) {
          return { ok: false, error: json.error || 'Failed to ingest document.' };
        }
        await refreshWorkspaceData();
        await refreshHealth();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error uploading document text.' };
      }
    },
    [refreshWorkspaceData, refreshHealth]
  );

  const removeDocument = useCallback(
    async (id: string) => {
      await fetch(`/api/knowledge/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshWorkspaceData();
      await refreshHealth();
    },
    [refreshWorkspaceData, refreshHealth]
  );

  const saveMemory = useCallback(
    async (data: {
      label: string;
      content: string;
      category: SavedMemory['category'];
    }) => {
      try {
        const res = await fetch('/api/knowledge/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as { memory?: SavedMemory; error?: string };
        if (!res.ok || !json.memory) {
          return { ok: false, error: json.error || 'Failed to save memory note.' };
        }
        await refreshWorkspaceData();
        await refreshHealth();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error saving memory note.' };
      }
    },
    [refreshWorkspaceData, refreshHealth]
  );

  const removeMemory = useCallback(
    async (id: string) => {
      await fetch(`/api/knowledge/memories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshWorkspaceData();
      await refreshHealth();
    },
    [refreshWorkspaceData, refreshHealth]
  );

  const purgeSessionData = useCallback(
    async (scope: 'conversations' | 'memories' | 'documents' | 'tasks' | 'all') => {
      await fetch('/api/session/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vaelor-Session-Token': sessionToken,
        },
        body: JSON.stringify({ scope }),
      });
      if (scope === 'conversations' || scope === 'all') {
        const fresh = makeEmptyConversation(undefined);
        setConversations([fresh]);
        setActiveConversationId(fresh.id);
        try {
          window.localStorage.removeItem(CONVERSATIONS_STORAGE_KEY);
        } catch {
          // Ignore storage error
        }
      }
      if (scope === 'all') {
        setActiveProjectId(undefined);
      }
      await refreshWorkspaceData();
      await refreshHealth();
    },
    [refreshWorkspaceData, refreshHealth, sessionToken]
  );

  const value: WorkspaceContextValue = {
    theme,
    toggleTheme,
    setTheme,
    localPersistenceEnabled,
    setLocalPersistenceEnabled,
    streamingEnabled,
    setStreamingEnabled,
    gatewayState,
    health,
    refreshHealth,
    conversations,
    activeConversation,
    selectConversation,
    startNewConversation,
    renameConversation,
    archiveConversation,
    clearActiveConversation,
    deleteConversation,
    draftInput,
    setDraftInput,
    preferredAgent,
    setPreferredAgent,
    useSentinel,
    setUseSentinel,
    researchMode,
    setResearchMode,
    tone,
    setTone,
    responseLength,
    setResponseLength,
    mockMode,
    setMockMode,
    pendingAttachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    isSending,
    activeStage,
    composerError,
    dismissComposerError: () => setComposerError(null),
    sendMessage,
    stopWaiting,
    retryFailedMessage,
    editUserMessage,
    regenerateResponse,
    generateVisualBlueprint,
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject,
    removeProject,
    documents,
    memories,
    ingestDocument,
    removeDocument,
    saveMemory,
    removeMemory,
    agents,
    tools,
    tasks,
    evaluationSuite,
    refreshWorkspaceData,
    purgeSessionData,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }
  return ctx;
}
