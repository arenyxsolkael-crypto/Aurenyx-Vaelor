import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import {
  deleteCloudMemoryFromFirestore,
  deleteCloudMissionFromFirestore,
  deleteCloudProjectFromFirestore,
  syncCloudMemoryToFirestore,
  syncCloudMissionToFirestore,
  syncCloudProjectToFirestore,
  syncVerifiedUserToFirestore,
} from '../lib/firebase';
import type {
  AgentId,
  AgentMetadata,
  AIStreamEvent,
  ChatAttachment,
  ChatMessage,
  CodingLabAssistResult,
  CodingLabFile,
  CodingLabMode,
  Conversation,
  CouncilRoleId,
  CouncilSessionResult,
  DeepResearchReport,
  EvaluationPromptCase,
  HealthResponse,
  ImageAspectRatio,
  ImageResolutionSize,
  KnowledgeDocument,
  MemoryInjectionSettings,
  MemoryItemType,
  MissionRun,
  ProjectWorkspace,
  ResponseLength,
  ResponseTone,
  RouterStatusSummary,
  SavedMemory,
  StructuredTaskRun,
  ToolAvailability,
  ToolName,
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
const SESSION_TOKEN_STORAGE_KEY = 'vaelor_session_token_v1';

function getConversationsStorageKey(uid?: string | null): string | null {
  if (!uid) return null;
  return `vaelor_saved_conversations_v2_${uid}`;
}

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
  routerStatus: RouterStatusSummary | null;
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
    description?: string;
    brief?: string;
    category: ProjectWorkspace['category'];
  }) => Promise<{ ok: boolean; error?: string }>;
  updateProject: (
    id: string,
    patch: {
      name?: string;
      objective?: string;
      description?: string;
      brief?: string;
      category?: ProjectWorkspace['category'];
      status?: ProjectWorkspace['status'];
      addTaskPlan?: {
        title: string;
        steps: string[];
        status?: 'planned' | 'in_progress' | 'completed';
      };
      updateTaskPlanStatus?: {
        planId: string;
        status: 'planned' | 'in_progress' | 'completed';
      };
      removeTaskPlanId?: string;
      addSummary?: {
        title: string;
        summary: string;
        sourceConversationId?: string;
        approvedByUser?: boolean;
      };
      removeSummaryId?: string;
    }
  ) => Promise<{ ok: boolean; project?: ProjectWorkspace; error?: string }>;
  exportProjectJson: (id: string) => Promise<{ ok: boolean; error?: string }>;
  removeProject: (id: string) => Promise<void>;

  planWorkflowTask: (data: {
    title: string;
    objective: string;
    preferredAgent?: AgentId;
    projectId?: string;
    researchMode?: boolean;
    requiresApproval?: boolean;
    requestedTools?: string[];
  }) => Promise<{ ok: boolean; task?: StructuredTaskRun; error?: string }>;
  executeWorkflowTask: (
    taskId: string,
    options?: {
      confirmedByUser?: boolean;
      mockMode?: boolean;
      useSentinel?: boolean;
    }
  ) => Promise<{ ok: boolean; reply?: string; task?: StructuredTaskRun; error?: string }>;

  documents: KnowledgeDocument[];
  memories: SavedMemory[];
  memorySettings: MemoryInjectionSettings;
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
    memoryType?: MemoryItemType;
    projectId?: string;
    referenceUrl?: string;
  }) => Promise<{ ok: boolean; memory?: SavedMemory; error?: string }>;
  updateMemory: (
    id: string,
    patch: {
      label?: string;
      content?: string;
      category?: SavedMemory['category'];
      memoryType?: MemoryItemType;
      projectId?: string;
      referenceUrl?: string;
    }
  ) => Promise<{ ok: boolean; memory?: SavedMemory; error?: string }>;
  updateMemorySettings: (settings: {
    globalEnabled: boolean;
    disabledProjectIds: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
  exportMemoriesJson: (projectId?: string) => Promise<{ ok: boolean; error?: string }>;
  removeMemory: (id: string) => Promise<void>;

  missions: MissionRun[];
  planMission: (data: {
    title: string;
    objective: string;
    projectId?: string;
    preferredAgent?: AgentId;
    requestedTools?: ToolName[];
    requireHumanApproval?: boolean;
    mockMode?: boolean;
    maxSteps?: number;
    maxRetries?: number;
    maxElapsedMs?: number;
    maxModelCalls?: number;
  }) => Promise<{ ok: boolean; mission?: MissionRun; error?: string }>;
  executeMission: (
    id: string,
    options?: { mockMode?: boolean }
  ) => Promise<{ ok: boolean; mission?: MissionRun; error?: string }>;
  controlMission: (
    id: string,
    command: {
      action: 'pause' | 'resume' | 'cancel' | 'retry_task' | 'approve_task';
      taskId?: string;
    }
  ) => Promise<{ ok: boolean; mission?: MissionRun; error?: string }>;
  removeMission: (id: string) => Promise<void>;

  deepResearchReports: DeepResearchReport[];
  runDeepResearch: (data: {
    query: string;
    projectId?: string;
    mockMode?: boolean;
  }) => Promise<{ ok: boolean; report?: DeepResearchReport; error?: string }>;

  councilSessions: CouncilSessionResult[];
  conveneCouncil: (data: {
    prompt: string;
    projectId?: string;
    selectedRoles?: CouncilRoleId[];
    maxCallBudget?: number;
    maxCharsPerRole?: number;
    mockMode?: boolean;
  }) => Promise<{ ok: boolean; session?: CouncilSessionResult; error?: string }>;

  runCodingLabAssist: (data: {
    mode: CodingLabMode;
    prompt: string;
    files: CodingLabFile[];
    mockMode?: boolean;
  }) => Promise<{ ok: boolean; result?: CodingLabAssistResult; error?: string }>;

  agents: AgentWithStats[];
  tools: ToolInfo[];
  tasks: StructuredTaskRun[];
  evaluationSuite: EvaluationPromptCase[];
  refreshWorkspaceData: () => Promise<void>;
  purgeSessionData: (
    scope: 'conversations' | 'memories' | 'documents' | 'tasks' | 'missions' | 'all'
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

function readStoredConversationsForUser(
  uid: string | null | undefined,
  fallback: Conversation
): Conversation[] {
  try {
    const storageKey = getConversationsStorageKey(uid);
    if (!storageKey || window.localStorage.getItem(PERSIST_PREF_KEY) !== 'true') {
      return [fallback];
    }
    const raw = window.localStorage.getItem(storageKey);
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
  const { user, authReady, getFreshIdToken, refreshAccountSummary } = useAuth();
  const [sessionToken] = useState<string>(() => readOrCreateSessionToken());
  const [theme, setThemeState] = useState<ThemeMode>(() => readInitialTheme());
  const [localPersistenceEnabled, setLocalPersistenceState] = useState<boolean>(() =>
    readPersistencePref()
  );
  const [streamingEnabled, setStreamingEnabled] = useState(true);

  const [gatewayState, setGatewayState] = useState<GatewayStatusState>('checking');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [routerStatus, setRouterStatus] = useState<RouterStatusSummary | null>(null);

  const initialConv = useMemo(() => makeEmptyConversation(undefined), []);
  const [conversations, setConversations] = useState<Conversation[]>(() => [initialConv]);
  const [activeConversationId, setActiveConversationId] = useState<string>(() => initialConv.id);

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
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(undefined);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [memories, setMemories] = useState<SavedMemory[]>([]);
  const [memorySettings, setMemorySettings] = useState<MemoryInjectionSettings>(() => ({
    globalEnabled: true,
    disabledProjectIds: [],
    updatedAt: new Date(0).toISOString(),
  }));
  const [missions, setMissions] = useState<MissionRun[]>([]);
  const [deepResearchReports, setDeepResearchReports] = useState<DeepResearchReport[]>([]);
  const [councilSessions, setCouncilSessions] = useState<CouncilSessionResult[]>([]);
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [tasks, setTasks] = useState<StructuredTaskRun[]>([]);
  const [evaluationSuite, setEvaluationSuite] = useState<EvaluationPromptCase[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Authenticated fetch wrapper that attaches verified Firebase ID tokens to protected API calls
   * and automatically retries once with a forced token refresh on HTTP 401 SESSION_EXPIRED.
   */
  const authFetch = useCallback(
    async (input: string, init: RequestInit = {}): Promise<Response> => {
      const buildHeaders = async (forceRefresh: boolean): Promise<Headers> => {
        const headers = new Headers(init.headers || {});
        headers.set('X-Vaelor-Session-Token', sessionToken);
        const token = await getFreshIdToken(forceRefresh);
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return headers;
      };

      const firstRes = await fetch(input, {
        ...init,
        headers: await buildHeaders(false),
      });

      if (firstRes.status === 401 && user) {
        const refreshedHeaders = await buildHeaders(true);
        if (refreshedHeaders.has('Authorization')) {
          return fetch(input, {
            ...init,
            headers: refreshedHeaders,
          });
        }
      }

      return firstRes;
    },
    [getFreshIdToken, sessionToken, user]
  );

  // Reset or hydrate user-namespaced conversations whenever the authenticated UID changes
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      const fresh = makeEmptyConversation(undefined);
      setConversations([fresh]);
      setActiveConversationId(fresh.id);
      setProjects([]);
      setActiveProjectId(undefined);
      setDocuments([]);
      setMemories([]);
      setMemorySettings({
        globalEnabled: true,
        disabledProjectIds: [],
        updatedAt: new Date(0).toISOString(),
      });
      setMissions([]);
      setDeepResearchReports([]);
      setCouncilSessions([]);
      setTasks([]);
      setComposerError(null);
      return;
    }

    const fallback = makeEmptyConversation(undefined);
    const localRestored = readStoredConversationsForUser(user.uid, fallback);
    setConversations(localRestored);
    setActiveConversationId(localRestored[0]?.id ?? fallback.id);
  }, [authReady, user?.uid]);

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
    if (user?.emailVerified) {
      void syncVerifiedUserToFirestore(user, theme).catch(() => {});
    }
  }, [theme, user]);

  useEffect(() => {
    try {
      const storageKey = getConversationsStorageKey(user?.uid);
      if (!storageKey) return;
      if (localPersistenceEnabled) {
        const sanitized = conversations.slice(0, 20).map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({ ...m, isStreaming: false })),
        }));
        window.localStorage.setItem(storageKey, JSON.stringify(sanitized));
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [conversations, localPersistenceEnabled, user?.uid]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setLocalPersistenceEnabled = useCallback(
    (enabled: boolean) => {
      setLocalPersistenceState(enabled);
      try {
        window.localStorage.setItem(PERSIST_PREF_KEY, enabled ? 'true' : 'false');
        const storageKey = getConversationsStorageKey(user?.uid);
        if (!enabled && storageKey) {
          window.localStorage.removeItem(storageKey);
        }
      } catch {
        // Ignore storage errors
      }
    },
    [user?.uid]
  );

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
      const [res, routerRes] = await Promise.all([
        authFetch('/api/health'),
        authFetch(`/api/router/status?mockMode=${mockMode ? 'true' : 'false'}`),
      ]);
      if (routerRes.ok) {
        const rData = (await routerRes.json()) as { router?: RouterStatusSummary };
        if (rData.router) {
          setRouterStatus(rData.router);
        }
      }
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
  }, [authFetch, mockMode]);

  const refreshWorkspaceData = useCallback(async () => {
    try {
      // Public agents & tools metadata is always safe to load
      const agentsRes = await authFetch('/api/agents');
      if (agentsRes.ok) {
        const d = (await agentsRes.json()) as { agents: AgentWithStats[]; tools: ToolInfo[] };
        setAgents(d.agents ?? []);
        setTools(d.tools ?? []);
      }

      if (!user) {
        return;
      }

      const [projRes, knowRes, tasksRes, convRes, missionsRes, researchRes, councilRes] =
        await Promise.all([
          authFetch('/api/projects'),
          authFetch('/api/knowledge'),
          authFetch('/api/tasks'),
          authFetch('/api/conversations'),
          authFetch('/api/missions'),
          authFetch('/api/research/reports'),
          authFetch('/api/council/sessions'),
        ]);

      if (projRes.ok) {
        const d = (await projRes.json()) as { projects: ProjectWorkspace[] };
        const loadedProjects = d.projects ?? [];
        setProjects(loadedProjects);
        setActiveProjectId((prev) => {
          if (prev && loadedProjects.some((p) => p.id === prev)) return prev;
          return loadedProjects[0]?.id;
        });
      }
      if (knowRes.ok) {
        const d = (await knowRes.json()) as {
          documents: KnowledgeDocument[];
          memories: SavedMemory[];
          memorySettings?: MemoryInjectionSettings;
        };
        setDocuments(d.documents ?? []);
        setMemories(d.memories ?? []);
        if (d.memorySettings) {
          setMemorySettings(d.memorySettings);
        }
      }
      if (tasksRes.ok) {
        const d = (await tasksRes.json()) as {
          tasks: StructuredTaskRun[];
          evaluationSuite: EvaluationPromptCase[];
        };
        setTasks(d.tasks ?? []);
        setEvaluationSuite(d.evaluationSuite ?? []);
      }
      if (missionsRes.ok) {
        const d = (await missionsRes.json()) as { missions: MissionRun[] };
        setMissions(d.missions ?? []);
      }
      if (researchRes.ok) {
        const d = (await researchRes.json()) as { reports: DeepResearchReport[] };
        setDeepResearchReports(d.reports ?? []);
      }
      if (councilRes.ok) {
        const d = (await councilRes.json()) as { sessions: CouncilSessionResult[] };
        setCouncilSessions(d.sessions ?? []);
      }
      if (convRes.ok) {
        const d = (await convRes.json()) as { conversations: Conversation[] };
        if (Array.isArray(d.conversations) && d.conversations.length > 0) {
          setConversations((prev) => {
            const hasActiveMessages = prev.some((c) => c.messages.length > 0);
            if (hasActiveMessages) return prev;
            setActiveConversationId(d.conversations[0].id);
            return d.conversations;
          });
        }
      }
      void refreshAccountSummary();
    } catch {
      // Handled gracefully by offline status
    }
  }, [authFetch, refreshAccountSummary, user]);

  useEffect(() => {
    if (!authReady) return;
    void refreshHealth();
    void refreshWorkspaceData();
  }, [authReady, user?.uid, refreshHealth, refreshWorkspaceData]);

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
      if (!user) return;
      try {
        await authFetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
    [authFetch, user]
  );

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const clean = title.trim().slice(0, 72);
      if (!clean) return;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c, title: clean, updatedAt: new Date().toISOString() };
          if (user) {
            void authFetch(`/api/conversations/${encodeURIComponent(id)}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ title: clean }),
            }).catch(() => {});
          }
          return next;
        })
      );
    },
    [authFetch, user]
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
            if (user) {
              void authFetch(`/api/conversations/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ archived }),
              }).catch(() => {});
            }
            return [fresh, ...updated];
          }
        }
        if (user) {
          void authFetch(`/api/conversations/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ archived }),
          }).catch(() => {});
        }
        return updated;
      });
    },
    [activeConversationId, activeProjectId, authFetch, user]
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
      if (user) {
        void authFetch(`/api/conversations/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
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
    [activeConversationId, activeProjectId, authFetch, user]
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
      if (!user) {
        setComposerError('Please sign in to send messages to your private Vaelor workspace.');
        return;
      }

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
          const sliced = truncateIdx >= 0 ? c.messages.slice(0, truncateIdx) : c.messages;
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
          const res = await authFetch('/api/chat/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
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
              const dataLine = rawBlock.split('\n').find((l) => l.startsWith('data: '));
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

        const res = await authFetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
      user,
      pendingAttachments,
      researchMode,
      activeConversation,
      activeProjectId,
      preferredAgent,
      useSentinel,
      tone,
      responseLength,
      mockMode,
      streamingEnabled,
      authFetch,
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
      if (!user) {
        setComposerError('Please sign in to generate visual studio blueprints.');
        return;
      }

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
        const res = await authFetch('/api/studio/visual', {
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
    [activeConversation.id, authFetch, isSending, user]
  );

  const createProject = useCallback(
    async (data: {
      name: string;
      objective: string;
      description?: string;
      brief?: string;
      category: ProjectWorkspace['category'];
    }) => {
      try {
        const res = await authFetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as { project?: ProjectWorkspace; error?: string };
        if (!res.ok || !json.project) {
          return { ok: false, error: json.error || 'Could not create project.' };
        }
        if (user?.emailVerified) {
          void syncCloudProjectToFirestore(user, json.project).catch(() => {});
        }
        await refreshWorkspaceData();
        await refreshHealth();
        setActiveProjectId(json.project.id);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error creating project.' };
      }
    },
    [authFetch, refreshWorkspaceData, refreshHealth, user]
  );

  const updateProject = useCallback(
    async (
      id: string,
      patch: {
        name?: string;
        objective?: string;
        description?: string;
        brief?: string;
        category?: ProjectWorkspace['category'];
        status?: ProjectWorkspace['status'];
        addTaskPlan?: {
          title: string;
          steps: string[];
          status?: 'planned' | 'in_progress' | 'completed';
        };
        updateTaskPlanStatus?: {
          planId: string;
          status: 'planned' | 'in_progress' | 'completed';
        };
        removeTaskPlanId?: string;
        addSummary?: {
          title: string;
          summary: string;
          sourceConversationId?: string;
          approvedByUser?: boolean;
        };
        removeSummaryId?: string;
      }
    ) => {
      try {
        const res = await authFetch(`/api/projects/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patch),
        });
        const json = (await res.json()) as { project?: ProjectWorkspace; error?: string };
        if (!res.ok || !json.project) {
          return { ok: false, error: json.error || 'Could not update project.' };
        }
        if (user?.emailVerified) {
          void syncCloudProjectToFirestore(user, json.project).catch(() => {});
        }
        await refreshWorkspaceData();
        await refreshHealth();
        return { ok: true, project: json.project };
      } catch {
        return { ok: false, error: 'Network error updating project.' };
      }
    },
    [authFetch, refreshWorkspaceData, refreshHealth, user]
  );

  const exportProjectJson = useCallback(
    async (id: string) => {
      try {
        const res = await authFetch(`/api/projects/${encodeURIComponent(id)}/export`);
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          return { ok: false, error: json.error || 'Could not export project JSON.' };
        }
        const blob = new Blob([JSON.stringify(json, null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `vaelor-project-${id}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error exporting project JSON.' };
      }
    },
    [authFetch]
  );

  const removeProject = useCallback(
    async (id: string) => {
      await authFetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (user?.emailVerified) {
        void deleteCloudProjectFromFirestore(user, id).catch(() => {});
      }
      if (activeProjectId === id) {
        setActiveProjectId(undefined);
      }
      await refreshWorkspaceData();
      await refreshHealth();
    },
    [activeProjectId, authFetch, refreshWorkspaceData, refreshHealth, user]
  );

  const planWorkflowTask = useCallback(
    async (data: {
      title: string;
      objective: string;
      preferredAgent?: AgentId;
      projectId?: string;
      researchMode?: boolean;
      requiresApproval?: boolean;
      requestedTools?: string[];
    }) => {
      try {
        const res = await authFetch('/api/tasks/plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as { task?: StructuredTaskRun; error?: string };
        if (!res.ok || !json.task) {
          return { ok: false, error: json.error || 'Could not create task plan.' };
        }
        await refreshWorkspaceData();
        await refreshHealth();
        return { ok: true, task: json.task };
      } catch {
        return { ok: false, error: 'Network error creating task plan.' };
      }
    },
    [authFetch, refreshWorkspaceData, refreshHealth]
  );

  const executeWorkflowTask = useCallback(
    async (
      taskId: string,
      options?: {
        confirmedByUser?: boolean;
        mockMode?: boolean;
        useSentinel?: boolean;
      }
    ) => {
      try {
        const res = await authFetch(`/api/tasks/${encodeURIComponent(taskId)}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            confirmedByUser: Boolean(options?.confirmedByUser),
            mockMode: options?.mockMode ?? mockMode,
            useSentinel: options?.useSentinel ?? useSentinel,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          reply?: string;
          task?: StructuredTaskRun;
          error?: string;
        };
        await refreshWorkspaceData();
        await refreshHealth();
        if (!res.ok || !json.task) {
          return {
            ok: false,
            task: json.task,
            error: json.error || 'Task workflow execution halted.',
          };
        }
        return { ok: true, reply: json.reply, task: json.task };
      } catch {
        return { ok: false, error: 'Network error executing task workflow.' };
      }
    },
    [authFetch, mockMode, refreshHealth, refreshWorkspaceData, useSentinel]
  );

  const ingestDocument = useCallback(
    async (data: {
      title: string;
      fileName?: string;
      sourceKind: 'upload' | 'paste';
      content: string;
    }) => {
      try {
        const res = await authFetch('/api/knowledge/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
    [authFetch, refreshWorkspaceData, refreshHealth]
  );

  const removeDocument = useCallback(
    async (id: string) => {
      await authFetch(`/api/knowledge/documents/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      await refreshWorkspaceData();
      await refreshHealth();
    },
    [authFetch, refreshWorkspaceData, refreshHealth]
  );

  const saveMemory = useCallback(
    async (data: {
      label: string;
      content: string;
      category: SavedMemory['category'];
      memoryType?: MemoryItemType;
      projectId?: string;
      referenceUrl?: string;
    }) => {
      try {
        const res = await authFetch('/api/knowledge/memories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as { memory?: SavedMemory; error?: string };
        if (!res.ok || !json.memory) {
          return { ok: false, error: json.error || 'Failed to save memory note.' };
        }
        if (user?.emailVerified) {
          void syncCloudMemoryToFirestore(user, json.memory).catch(() => {});
        }
        await refreshWorkspaceData();
        await refreshHealth();
        return { ok: true, memory: json.memory };
      } catch {
        return { ok: false, error: 'Network error saving memory note.' };
      }
    },
    [authFetch, refreshWorkspaceData, refreshHealth, user]
  );

  const updateMemory = useCallback(
    async (
      id: string,
      patch: {
        label?: string;
        content?: string;
        category?: SavedMemory['category'];
        memoryType?: MemoryItemType;
        projectId?: string;
        referenceUrl?: string;
      }
    ) => {
      try {
        const res = await authFetch(`/api/knowledge/memories/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patch),
        });
        const json = (await res.json()) as { memory?: SavedMemory; error?: string };
        if (!res.ok || !json.memory) {
          return { ok: false, error: json.error || 'Could not update memory note.' };
        }
        if (user?.emailVerified) {
          void syncCloudMemoryToFirestore(user, json.memory).catch(() => {});
        }
        await refreshWorkspaceData();
        return { ok: true, memory: json.memory };
      } catch {
        return { ok: false, error: 'Network error updating memory note.' };
      }
    },
    [authFetch, refreshWorkspaceData, user]
  );

  const updateMemorySettings = useCallback(
    async (settings: { globalEnabled: boolean; disabledProjectIds: string[] }) => {
      try {
        const res = await authFetch('/api/knowledge/memory-settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          memorySettings?: MemoryInjectionSettings;
          error?: string;
        };
        if (!res.ok || !json.memorySettings) {
          return { ok: false, error: json.error || 'Could not update memory injection settings.' };
        }
        setMemorySettings(json.memorySettings);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error updating memory injection settings.' };
      }
    },
    [authFetch]
  );

  const exportMemoriesJson = useCallback(
    async (projectId?: string) => {
      try {
        const qs =
          projectId && projectId !== '__all__'
            ? `?projectId=${encodeURIComponent(projectId)}`
            : '';
        const res = await authFetch(`/api/knowledge/memories/export${qs}`);
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          return { ok: false, error: json.error || 'Could not export memory bundle.' };
        }
        const blob = new Blob([JSON.stringify(json, null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `vaelor-memories-${projectId && projectId !== '__all__' ? projectId : 'all'}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error exporting memory bundle.' };
      }
    },
    [authFetch]
  );

  const removeMemory = useCallback(
    async (id: string) => {
      await authFetch(`/api/knowledge/memories/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (user?.emailVerified) {
        void deleteCloudMemoryFromFirestore(user, id).catch(() => {});
      }
      await refreshWorkspaceData();
      await refreshHealth();
    },
    [authFetch, refreshWorkspaceData, refreshHealth, user]
  );

  const planMission = useCallback(
    async (data: {
      title: string;
      objective: string;
      projectId?: string;
      preferredAgent?: AgentId;
      requestedTools?: ToolName[];
      requireHumanApproval?: boolean;
      mockMode?: boolean;
      maxSteps?: number;
      maxRetries?: number;
      maxElapsedMs?: number;
      maxModelCalls?: number;
    }) => {
      try {
        const res = await authFetch('/api/missions/plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            mockMode: data.mockMode ?? mockMode,
          }),
        });
        const json = (await res.json()) as { mission?: MissionRun; error?: string };
        if (!res.ok || !json.mission) {
          return { ok: false, error: json.error || 'Could not create mission plan.' };
        }
        if (user?.emailVerified) {
          void syncCloudMissionToFirestore(user, json.mission).catch(() => {});
        }
        await refreshWorkspaceData();
        await refreshHealth();
        return { ok: true, mission: json.mission };
      } catch {
        return { ok: false, error: 'Network error planning mission.' };
      }
    },
    [authFetch, mockMode, refreshHealth, refreshWorkspaceData, user]
  );

  const executeMission = useCallback(
    async (id: string, options?: { mockMode?: boolean }) => {
      try {
        const res = await authFetch(`/api/missions/${encodeURIComponent(id)}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mockMode: options?.mockMode ?? mockMode,
          }),
        });
        const json = (await res.json()) as { mission?: MissionRun; error?: string };
        if (!res.ok || !json.mission) {
          return { ok: false, error: json.error || 'Mission execution step failed.' };
        }
        if (user?.emailVerified) {
          void syncCloudMissionToFirestore(user, json.mission).catch(() => {});
        }
        await refreshWorkspaceData();
        await refreshHealth();
        return { ok: true, mission: json.mission };
      } catch {
        return { ok: false, error: 'Network error executing mission.' };
      }
    },
    [authFetch, mockMode, refreshHealth, refreshWorkspaceData, user]
  );

  const controlMission = useCallback(
    async (
      id: string,
      command: {
        action: 'pause' | 'resume' | 'cancel' | 'retry_task' | 'approve_task';
        taskId?: string;
      }
    ) => {
      try {
        const res = await authFetch(`/api/missions/${encodeURIComponent(id)}/control`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(command),
        });
        const json = (await res.json()) as { mission?: MissionRun; error?: string };
        if (!res.ok || !json.mission) {
          return { ok: false, error: json.error || 'Mission control action failed.' };
        }
        if (user?.emailVerified) {
          void syncCloudMissionToFirestore(user, json.mission).catch(() => {});
        }
        await refreshWorkspaceData();
        return { ok: true, mission: json.mission };
      } catch {
        return { ok: false, error: 'Network error updating mission control state.' };
      }
    },
    [authFetch, refreshWorkspaceData, user]
  );

  const removeMission = useCallback(
    async (id: string) => {
      await authFetch(`/api/missions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (user?.emailVerified) {
        void deleteCloudMissionFromFirestore(user, id).catch(() => {});
      }
      await refreshWorkspaceData();
      await refreshHealth();
    },
    [authFetch, refreshHealth, refreshWorkspaceData, user]
  );

  const runDeepResearch = useCallback(
    async (data: { query: string; projectId?: string; mockMode?: boolean }) => {
      try {
        const res = await authFetch('/api/research/deep', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            mockMode: data.mockMode ?? mockMode,
          }),
        });
        const json = (await res.json()) as { report?: DeepResearchReport; error?: string };
        if (!res.ok || !json.report) {
          return { ok: false, error: json.error || 'Deep research pipeline failed.' };
        }
        await refreshWorkspaceData();
        return { ok: true, report: json.report };
      } catch {
        return { ok: false, error: 'Network error running Deep Research.' };
      }
    },
    [authFetch, mockMode, refreshWorkspaceData]
  );

  const conveneCouncil = useCallback(
    async (data: {
      prompt: string;
      projectId?: string;
      selectedRoles?: CouncilRoleId[];
      maxCallBudget?: number;
      maxCharsPerRole?: number;
      mockMode?: boolean;
    }) => {
      try {
        const res = await authFetch('/api/council/convene', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            mockMode: data.mockMode ?? mockMode,
          }),
        });
        const json = (await res.json()) as { session?: CouncilSessionResult; error?: string };
        if (!res.ok || !json.session) {
          return { ok: false, error: json.error || 'Vanguard Council deliberation failed.' };
        }
        await refreshWorkspaceData();
        return { ok: true, session: json.session };
      } catch {
        return { ok: false, error: 'Network error convening Vanguard Council.' };
      }
    },
    [authFetch, mockMode, refreshWorkspaceData]
  );

  const runCodingLabAssist = useCallback(
    async (data: {
      mode: CodingLabMode;
      prompt: string;
      files: CodingLabFile[];
      mockMode?: boolean;
    }) => {
      try {
        const res = await authFetch('/api/coding-lab/assist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            mockMode: data.mockMode ?? mockMode,
          }),
        });
        const json = (await res.json()) as { result?: CodingLabAssistResult; error?: string };
        if (!res.ok || !json.result) {
          return { ok: false, error: json.error || 'Coding Lab review failed.' };
        }
        return { ok: true, result: json.result };
      } catch {
        return { ok: false, error: 'Network error calling Coding Lab.' };
      }
    },
    [authFetch, mockMode]
  );

  const purgeSessionData = useCallback(
    async (
      scope: 'conversations' | 'memories' | 'documents' | 'tasks' | 'missions' | 'all'
    ) => {
      await authFetch('/api/session/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope }),
      });
      if (scope === 'conversations' || scope === 'all') {
        const fresh = makeEmptyConversation(undefined);
        setConversations([fresh]);
        setActiveConversationId(fresh.id);
        try {
          const storageKey = getConversationsStorageKey(user?.uid);
          if (storageKey) {
            window.localStorage.removeItem(storageKey);
          }
        } catch {
          // Ignore storage error
        }
      }
      if (scope === 'all') {
        setActiveProjectId(undefined);
        setDeepResearchReports([]);
        setCouncilSessions([]);
      }
      await refreshWorkspaceData();
      await refreshHealth();
    },
    [authFetch, refreshWorkspaceData, refreshHealth, user?.uid]
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
    routerStatus,
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
    updateProject,
    exportProjectJson,
    removeProject,
    planWorkflowTask,
    executeWorkflowTask,
    documents,
    memories,
    memorySettings,
    ingestDocument,
    removeDocument,
    saveMemory,
    updateMemory,
    updateMemorySettings,
    exportMemoriesJson,
    removeMemory,
    missions,
    planMission,
    executeMission,
    controlMission,
    removeMission,
    deepResearchReports,
    runDeepResearch,
    councilSessions,
    conveneCouncil,
    runCodingLabAssist,
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
