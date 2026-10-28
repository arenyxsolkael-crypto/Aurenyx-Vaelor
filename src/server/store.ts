import crypto from 'node:crypto';
import type {
  Conversation,
  DocumentChunk,
  KnowledgeDocument,
  ProjectSummaryNote,
  ProjectTaskPlanItem,
  ProjectWorkspace,
  SavedMemory,
  StructuredTaskRun,
} from '../shared/types.ts';

export function chunkDocumentText(text: string, maxChunkSize = 900): DocumentChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: DocumentChunk[] = [];
  let buffer = '';

  const flush = () => {
    const trimmed = buffer.trim();
    if (!trimmed) return;
    chunks.push({
      id: `chk_${crypto.randomUUID().slice(0, 8)}`,
      index: chunks.length,
      text: trimmed,
    });
    buffer = '';
  };

  for (const para of paragraphs) {
    if ((buffer + '\n\n' + para).length <= maxChunkSize) {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    } else {
      flush();
      if (para.length <= maxChunkSize) {
        buffer = para;
      } else {
        for (let i = 0; i < para.length; i += maxChunkSize) {
          chunks.push({
            id: `chk_${crypto.randomUUID().slice(0, 8)}`,
            index: chunks.length,
            text: para.slice(i, i + maxChunkSize).trim(),
          });
        }
      }
    }
  }
  flush();
  return chunks;
}

const STARTER_ARCHITECTURE_DOC = `AURENYX VAELOR 0.3 — System Architecture & Security Reference

1. Mission & Design Boundaries
Aurenyx Vaelor ("Intelligence, Orchestrated.") is a modular multi-agent AI assistant workspace built for ₹0 free-tier operation. It coordinates specialist roles—Aurenyx Research, Vaelor Forge, Vaelor Analyst, Vaelor Knowledge, and Vaelor Sentinel—alongside Vaelor Core.

2. Bounded Orchestration Ceiling
Every incoming user request is validated with Zod schemas on the server, rate-limited per client IP and authenticated account, and executed under a hard maximum ceiling of 4 model calls per request. Agents cannot self-grant permissions or invoke unregistered tools.

3. Separated Memory & Per-User Isolation
Vaelor strictly separates three storage layers per authenticated account:
- Temporary Conversation Context: Bounded to the most recent messages in an active chat thread.
- Explicitly Saved User Memory: User-authored facts and preferences screened against credential patterns.
- Indexed Document Knowledge: Plain-text and markdown documents segmented into passage chunks for grounded citation retrieval.

4. Security Invariants
Provider API keys (GEMINI_API_KEY) remain strictly on the Node.js Express backend and are never exposed via VITE_ variables, client bundles, or authenticated account payloads. Service workers cache static frontend assets only and enforce NetworkOnly rules for all /api/* endpoints.`;

export interface ProjectPatchInput {
  name?: string;
  objective?: string;
  description?: string;
  brief?: string;
  category?: ProjectWorkspace['category'];
  status?: ProjectWorkspace['status'];
  addTaskPlan?: {
    title: string;
    steps: string[];
    status?: ProjectTaskPlanItem['status'];
  };
  updateTaskPlanStatus?: {
    planId: string;
    status: ProjectTaskPlanItem['status'];
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

export class EphemeralSessionStore {
  public conversations: Conversation[] = [];
  public memories: SavedMemory[] = [];
  public documents: KnowledgeDocument[] = [];
  public projects: ProjectWorkspace[] = [];
  public taskRuns: StructuredTaskRun[] = [];

  private readonly seedStarterEnabled: boolean;
  private readonly seededOwners = new Set<string>();
  private readonly purgedOwners = new Set<string>();

  constructor(seedStarterData = true) {
    this.seedStarterEnabled = seedStarterData;
    if (seedStarterData) {
      this.seedDefaults();
    }
  }

  private seedDefaults(): void {
    this.seededOwners.add('default-session');
    const nowIso = new Date().toISOString();
    this.projects.push({
      id: 'proj_vaelor_01',
      name: 'Aurenyx Vaelor 0.3 Core',
      objective:
        'Validate bounded multi-agent orchestration, schema-validated tool execution, server-side Gemini gateway security, and Android-installable PWA readiness on a ₹0 budget.',
      description:
        'Primary engineering workspace for AURENYX VAELOR v0.3 ("The Autonomous Intelligence Upgrade").',
      brief:
        'Keep GEMINI_API_KEY server-only, verify external evidence via Vaelor Sentinel, and maintain honest session-ephemeral storage disclosures.',
      category: 'software',
      status: 'active',
      ownerSessionId: 'default-session',
      taskPlans: [
        {
          id: 'plan_seed_01',
          title: 'Phase 0–10 Autonomous Intelligence Verification',
          steps: [
            'Enforce server-only Gemini gateway & ₹0 paid-model blocklist',
            'Verify citation URLs & tool outputs via Vaelor Sentinel',
            'Run deterministic node:test acceptance suite',
          ],
          status: 'in_progress',
          createdAt: nowIso,
        },
      ],
      summaries: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const chunks = chunkDocumentText(STARTER_ARCHITECTURE_DOC);
    this.documents.push({
      id: 'doc_vaelor_arch',
      title: 'Aurenyx Vaelor 0.1 Architecture & Security Brief',
      fileName: 'vaelor-architecture-0.2.md',
      sourceKind: 'starter',
      charCount: STARTER_ARCHITECTURE_DOC.length,
      wordCount: STARTER_ARCHITECTURE_DOC.split(/\s+/).filter(Boolean).length,
      chunks,
      ownerSessionId: 'default-session',
      createdAt: nowIso,
    });
  }

  /**
   * Ensures each newly signed-in user receives their own isolated starter project and architecture doc
   * unless they explicitly purged or deleted their account data.
   */
  public ensureStarterWorkspaceForOwner(ownerSessionId: string): void {
    if (!this.seedStarterEnabled) return;
    if (this.seededOwners.has(ownerSessionId) || this.purgedOwners.has(ownerSessionId)) return;
    this.seededOwners.add(ownerSessionId);

    if (ownerSessionId === 'default-session') return;

    const hash = crypto.createHash('sha256').update(ownerSessionId).digest('hex').slice(0, 10);
    const nowIso = new Date().toISOString();

    this.projects.push({
      id: `proj_starter_${hash}`,
      name: 'Aurenyx Vaelor 0.3 Core',
      objective:
        'Validate bounded multi-agent orchestration, schema-validated tool execution, Firebase Authentication isolation, and Android-installable PWA readiness on a ₹0 budget.',
      description:
        'Private starter project workspace isolated to your authenticated AURENYX VAELOR account.',
      brief:
        'Keep GEMINI_API_KEY server-only, verify external evidence via Vaelor Sentinel, and isolate user workspaces per verified UID.',
      category: 'software',
      status: 'active',
      ownerSessionId,
      taskPlans: [
        {
          id: `plan_starter_${hash}`,
          title: 'Account Workspace Readiness Checklist',
          steps: [
            'Verify server-side Firebase ID token isolation',
            'Attach project-specific brief or indexed text notes',
            'Export JSON backup anytime for offline portability',
          ],
          status: 'in_progress',
          createdAt: nowIso,
        },
      ],
      summaries: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const chunks = chunkDocumentText(STARTER_ARCHITECTURE_DOC);
    this.documents.push({
      id: `doc_starter_${hash}`,
      title: 'Aurenyx Vaelor 0.3 Architecture & Security Brief',
      fileName: 'vaelor-architecture-0.3.md',
      sourceKind: 'starter',
      charCount: STARTER_ARCHITECTURE_DOC.length,
      wordCount: STARTER_ARCHITECTURE_DOC.split(/\s+/).filter(Boolean).length,
      chunks,
      ownerSessionId,
      createdAt: nowIso,
    });
  }

  /**
   * Session / UID-isolated conversation storage (prevents cross-user access across accounts or session tokens).
   */
  public listConversationsForOwner(ownerSessionId: string): Conversation[] {
    return this.conversations.filter((c) => c.ownerSessionId === ownerSessionId);
  }

  public getConversationForOwner(
    ownerSessionId: string,
    conversationId: string
  ): 'not_found' | 'forbidden' | Conversation {
    const found = this.conversations.find((c) => c.id === conversationId);
    if (!found) return 'not_found';
    if (found.ownerSessionId && found.ownerSessionId !== ownerSessionId) {
      return 'forbidden';
    }
    return found;
  }

  public upsertConversationForOwner(
    ownerSessionId: string,
    convInput: Omit<Conversation, 'ownerSessionId'>
  ): 'forbidden' | Conversation {
    const existingIdx = this.conversations.findIndex((c) => c.id === convInput.id);
    if (existingIdx >= 0) {
      const existing = this.conversations[existingIdx];
      if (existing.ownerSessionId && existing.ownerSessionId !== ownerSessionId) {
        return 'forbidden';
      }
      const updated: Conversation = {
        ...existing,
        ...convInput,
        ownerSessionId,
        updatedAt: convInput.updatedAt || new Date().toISOString(),
      };
      this.conversations[existingIdx] = updated;
      return updated;
    }

    const nowIso = new Date().toISOString();
    const created: Conversation = {
      ...convInput,
      ownerSessionId,
      createdAt: convInput.createdAt || nowIso,
      updatedAt: convInput.updatedAt || nowIso,
    };
    this.conversations.unshift(created);
    if (this.conversations.length > 400) {
      this.conversations = this.conversations.slice(0, 400);
    }
    return created;
  }

  public patchConversationForOwner(
    ownerSessionId: string,
    conversationId: string,
    patch: { title?: string; archived?: boolean }
  ): 'not_found' | 'forbidden' | Conversation {
    const existingIdx = this.conversations.findIndex((c) => c.id === conversationId);
    if (existingIdx < 0) return 'not_found';
    const existing = this.conversations[existingIdx];
    if (existing.ownerSessionId && existing.ownerSessionId !== ownerSessionId) {
      return 'forbidden';
    }
    const updated: Conversation = {
      ...existing,
      title: patch.title !== undefined ? patch.title : existing.title,
      archived: patch.archived !== undefined ? patch.archived : existing.archived,
      updatedAt: new Date().toISOString(),
    };
    this.conversations[existingIdx] = updated;
    return updated;
  }

  public deleteConversationForOwner(
    ownerSessionId: string,
    conversationId: string
  ): 'not_found' | 'forbidden' | 'deleted' {
    const existing = this.conversations.find((c) => c.id === conversationId);
    if (!existing) return 'not_found';
    if (existing.ownerSessionId && existing.ownerSessionId !== ownerSessionId) {
      return 'forbidden';
    }
    this.conversations = this.conversations.filter((c) => c.id !== conversationId);
    return 'deleted';
  }

  /**
   * Per-owner Project Workspace isolation (prevents IDOR across users).
   */
  public listProjectsForOwner(ownerSessionId: string): ProjectWorkspace[] {
    this.ensureStarterWorkspaceForOwner(ownerSessionId);
    return this.projects.filter(
      (p) => (p.ownerSessionId || 'default-session') === ownerSessionId
    );
  }

  public getProjectForOwner(
    ownerSessionId: string,
    projectId: string
  ): 'not_found' | 'forbidden' | ProjectWorkspace {
    this.ensureStarterWorkspaceForOwner(ownerSessionId);
    const found = this.projects.find((p) => p.id === projectId);
    if (!found) return 'not_found';
    if ((found.ownerSessionId || 'default-session') !== ownerSessionId) {
      return 'forbidden';
    }
    return found;
  }

  public addProjectForOwner(
    ownerSessionId: string,
    input: Pick<ProjectWorkspace, 'name' | 'objective' | 'category'> & {
      description?: string;
      brief?: string;
    }
  ): ProjectWorkspace {
    this.ensureStarterWorkspaceForOwner(ownerSessionId);
    const nowIso = new Date().toISOString();
    const project: ProjectWorkspace = {
      id: `proj_${crypto.randomUUID().slice(0, 8)}`,
      name: input.name,
      objective: input.objective,
      description: input.description,
      brief: input.brief,
      category: input.category,
      status: 'active',
      ownerSessionId,
      taskPlans: [],
      summaries: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.projects.unshift(project);
    return project;
  }

  public addProject(
    input: Pick<ProjectWorkspace, 'name' | 'objective' | 'category'> & {
      description?: string;
      brief?: string;
    }
  ): ProjectWorkspace {
    return this.addProjectForOwner('default-session', input);
  }

  public updateProjectForOwner(
    ownerSessionId: string,
    id: string,
    patch: ProjectPatchInput
  ): 'not_found' | 'forbidden' | 'archived_locked' | ProjectWorkspace {
    this.ensureStarterWorkspaceForOwner(ownerSessionId);
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx < 0) return 'not_found';
    const current = this.projects[idx];
    if ((current.ownerSessionId || 'default-session') !== ownerSessionId) {
      return 'forbidden';
    }
    if (current.status === 'archived') {
      return 'archived_locked';
    }
    const nowIso = new Date().toISOString();

    let nextPlans = [...(current.taskPlans ?? [])];
    if (patch.addTaskPlan) {
      nextPlans.unshift({
        id: `plan_${crypto.randomUUID().slice(0, 8)}`,
        title: patch.addTaskPlan.title,
        steps: patch.addTaskPlan.steps.slice(0, 8),
        status: patch.addTaskPlan.status ?? 'planned',
        createdAt: nowIso,
      });
      nextPlans = nextPlans.slice(0, 30);
    }
    if (patch.updateTaskPlanStatus) {
      nextPlans = nextPlans.map((pl) =>
        pl.id === patch.updateTaskPlanStatus!.planId
          ? { ...pl, status: patch.updateTaskPlanStatus!.status }
          : pl
      );
    }
    if (patch.removeTaskPlanId) {
      nextPlans = nextPlans.filter((pl) => pl.id !== patch.removeTaskPlanId);
    }

    let nextSummaries = [...(current.summaries ?? [])];
    if (patch.addSummary && patch.addSummary.approvedByUser !== false) {
      nextSummaries.unshift({
        id: `sum_${crypto.randomUUID().slice(0, 8)}`,
        title: patch.addSummary.title,
        summary: patch.addSummary.summary,
        sourceConversationId: patch.addSummary.sourceConversationId,
        approvedByUser: true,
        createdAt: nowIso,
      });
      nextSummaries = nextSummaries.slice(0, 40);
    }
    if (patch.removeSummaryId) {
      nextSummaries = nextSummaries.filter((s) => s.id !== patch.removeSummaryId);
    }

    const updated: ProjectWorkspace = {
      ...current,
      name: patch.name !== undefined ? patch.name : current.name,
      objective: patch.objective !== undefined ? patch.objective : current.objective,
      description: patch.description !== undefined ? patch.description : current.description,
      brief: patch.brief !== undefined ? patch.brief : current.brief,
      category: patch.category !== undefined ? patch.category : current.category,
      status: patch.status !== undefined ? patch.status : current.status,
      taskPlans: nextPlans,
      summaries: nextSummaries,
      updatedAt: nowIso,
    };
    this.projects[idx] = updated;
    return updated;
  }

  public updateProject(id: string, patch: ProjectPatchInput): ProjectWorkspace | null {
    const res = this.updateProjectForOwner('default-session', id, patch);
    if (res === 'not_found' || res === 'forbidden' || res === 'archived_locked') {
      return null;
    }
    return res;
  }

  public exportProjectBundleForOwner(
    resourceOwnerId: string,
    id: string,
    conversationAndTaskOwnerId = resourceOwnerId
  ):
    | 'not_found'
    | 'forbidden'
    | {
        schemaVersion: 'vaelor-project-export-v0.3';
        exportedAt: string;
        storageLimitationNotice: string;
        project: Omit<ProjectWorkspace, 'ownerSessionId'>;
        linkedConversations: Omit<Conversation, 'ownerSessionId'>[];
        linkedTasks: Omit<StructuredTaskRun, 'ownerSessionId'>[];
      } {
    this.ensureStarterWorkspaceForOwner(resourceOwnerId);
    const project = this.projects.find((p) => p.id === id);
    if (!project) return 'not_found';
    if ((project.ownerSessionId || 'default-session') !== resourceOwnerId) {
      return 'forbidden';
    }
    const { ownerSessionId: _projectOwner, ...safeProject } = project;
    const linkedConversations = this.listConversationsForOwner(conversationAndTaskOwnerId)
      .filter((c) => c.projectId === id)
      .map(({ ownerSessionId: _o, ...rest }) => rest);
    const linkedTasks = this.listTasksForOwner(conversationAndTaskOwnerId)
      .filter((t) => t.projectId === id)
      .map(({ ownerSessionId: _o, ...rest }) => rest);

    return {
      schemaVersion: 'vaelor-project-export-v0.3',
      exportedAt: new Date().toISOString(),
      storageLimitationNotice:
        'Exported from AURENYX VAELOR v0.3 private account workspace (₹0 Free Tier). Keep this JSON file if you want long-term offline backup.',
      project: safeProject,
      linkedConversations,
      linkedTasks,
    };
  }

  public exportProjectBundle(id: string, ownerSessionId: string) {
    const res = this.exportProjectBundleForOwner('default-session', id, ownerSessionId);
    if (res === 'not_found' || res === 'forbidden') return null;
    return res;
  }

  public deleteProjectForOwner(
    ownerSessionId: string,
    id: string
  ): 'not_found' | 'forbidden' | 'deleted' {
    this.ensureStarterWorkspaceForOwner(ownerSessionId);
    const existing = this.projects.find((p) => p.id === id);
    if (!existing) return 'not_found';
    if ((existing.ownerSessionId || 'default-session') !== ownerSessionId) {
      return 'forbidden';
    }
    this.projects = this.projects.filter((p) => p.id !== id);
    return 'deleted';
  }

  public deleteProject(id: string): boolean {
    return this.deleteProjectForOwner('default-session', id) === 'deleted';
  }

  /**
   * Per-owner Memory isolation.
   */
  public listMemoriesForOwner(ownerSessionId: string): SavedMemory[] {
    return this.memories.filter(
      (m) => (m.ownerSessionId || 'default-session') === ownerSessionId
    );
  }

  public addMemoryForOwner(
    ownerSessionId: string,
    input: Omit<SavedMemory, 'id' | 'createdAt' | 'ownerSessionId'>
  ): SavedMemory {
    const memory: SavedMemory = {
      id: `mem_${crypto.randomUUID().slice(0, 8)}`,
      label: input.label,
      content: input.content,
      category: input.category,
      ownerSessionId,
      createdAt: new Date().toISOString(),
    };
    this.memories.unshift(memory);
    return memory;
  }

  public addMemory(input: Omit<SavedMemory, 'id' | 'createdAt' | 'ownerSessionId'>): SavedMemory {
    return this.addMemoryForOwner('default-session', input);
  }

  public deleteMemoryForOwner(
    ownerSessionId: string,
    id: string
  ): 'not_found' | 'forbidden' | 'deleted' {
    const existing = this.memories.find((m) => m.id === id);
    if (!existing) return 'not_found';
    if ((existing.ownerSessionId || 'default-session') !== ownerSessionId) {
      return 'forbidden';
    }
    this.memories = this.memories.filter((m) => m.id !== id);
    return 'deleted';
  }

  public deleteMemory(id: string): boolean {
    return this.deleteMemoryForOwner('default-session', id) === 'deleted';
  }

  /**
   * Per-owner Document isolation.
   */
  public listDocumentsForOwner(ownerSessionId: string): KnowledgeDocument[] {
    this.ensureStarterWorkspaceForOwner(ownerSessionId);
    return this.documents.filter(
      (d) => (d.ownerSessionId || 'default-session') === ownerSessionId
    );
  }

  public addDocumentForOwner(
    ownerSessionId: string,
    input: {
      title: string;
      fileName?: string;
      sourceKind: 'upload' | 'paste';
      content: string;
    }
  ): KnowledgeDocument {
    this.ensureStarterWorkspaceForOwner(ownerSessionId);
    const chunks = chunkDocumentText(input.content);
    const doc: KnowledgeDocument = {
      id: `doc_${crypto.randomUUID().slice(0, 8)}`,
      title: input.title,
      fileName: input.fileName,
      sourceKind: input.sourceKind,
      charCount: input.content.length,
      wordCount: input.content.split(/\s+/).filter(Boolean).length,
      chunks,
      ownerSessionId,
      createdAt: new Date().toISOString(),
    };
    this.documents.unshift(doc);
    return doc;
  }

  public addDocument(input: {
    title: string;
    fileName?: string;
    sourceKind: 'upload' | 'paste';
    content: string;
  }): KnowledgeDocument {
    return this.addDocumentForOwner('default-session', input);
  }

  public deleteDocumentForOwner(
    ownerSessionId: string,
    id: string
  ): 'not_found' | 'forbidden' | 'deleted' {
    this.ensureStarterWorkspaceForOwner(ownerSessionId);
    const existing = this.documents.find((d) => d.id === id);
    if (!existing) return 'not_found';
    if ((existing.ownerSessionId || 'default-session') !== ownerSessionId) {
      return 'forbidden';
    }
    this.documents = this.documents.filter((d) => d.id !== id);
    return 'deleted';
  }

  public deleteDocument(id: string): boolean {
    return this.deleteDocumentForOwner('default-session', id) === 'deleted';
  }

  public listTasksForOwner(ownerSessionId: string): StructuredTaskRun[] {
    return this.taskRuns
      .filter((t) => (t.ownerSessionId || 'default-session') === ownerSessionId)
      .slice(0, 50);
  }

  public getTaskForOwner(
    ownerSessionId: string,
    taskId: string
  ): 'not_found' | 'forbidden' | StructuredTaskRun {
    const found = this.taskRuns.find((t) => t.taskId === taskId);
    if (!found) return 'not_found';
    if ((found.ownerSessionId || 'default-session') !== ownerSessionId) {
      return 'forbidden';
    }
    return found;
  }

  public upsertTaskRun(run: StructuredTaskRun): void {
    const idx = this.taskRuns.findIndex((t) => t.taskId === run.taskId);
    if (idx >= 0) {
      this.taskRuns[idx] = run;
      return;
    }
    this.recordTaskRun(run);
  }

  public recordTaskRun(run: StructuredTaskRun): void {
    this.taskRuns.unshift(run);
    if (this.taskRuns.length > 400) {
      this.taskRuns = this.taskRuns.slice(0, 400);
    }
  }

  public clearScope(
    scope: 'conversations' | 'memories' | 'documents' | 'tasks' | 'all',
    ownerSessionId?: string
  ): void {
    if (scope === 'conversations' || scope === 'all') {
      if (ownerSessionId) {
        this.conversations = this.conversations.filter(
          (c) => (c.ownerSessionId || 'default-session') !== ownerSessionId
        );
      } else {
        this.conversations = [];
      }
    }
    if (scope === 'memories' || scope === 'all') {
      if (ownerSessionId) {
        this.memories = this.memories.filter(
          (m) => (m.ownerSessionId || 'default-session') !== ownerSessionId
        );
      } else {
        this.memories = [];
      }
    }
    if (scope === 'documents' || scope === 'all') {
      if (ownerSessionId) {
        this.documents = this.documents.filter(
          (d) => (d.ownerSessionId || 'default-session') !== ownerSessionId
        );
      } else {
        this.documents = [];
      }
    }
    if (scope === 'tasks' || scope === 'all') {
      if (ownerSessionId) {
        this.taskRuns = this.taskRuns.filter(
          (t) => (t.ownerSessionId || 'default-session') !== ownerSessionId
        );
      } else {
        this.taskRuns = [];
      }
    }
    if (scope === 'all') {
      if (ownerSessionId) {
        this.purgedOwners.add(ownerSessionId);
        this.projects = this.projects.filter(
          (p) => (p.ownerSessionId || 'default-session') !== ownerSessionId
        );
      } else {
        this.projects = [];
      }
    }
  }

  /**
   * Permanently deletes 100% of server-side data belonging to an authenticated account (`uid:<uid>`)
   * without touching any other user's projects, chats, documents, memories, or tasks.
   */
  public purgeAllDataForOwner(ownerSessionId: string): void {
    this.clearScope('all', ownerSessionId);
  }
}
