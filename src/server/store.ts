import crypto from 'node:crypto';
import type {
  Conversation,
  DocumentChunk,
  KnowledgeDocument,
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

const STARTER_ARCHITECTURE_DOC = `AURENYX VAELOR 0.1 — System Architecture & Security Reference

1. Mission & Design Boundaries
Aurenyx Vaelor ("Intelligence, Orchestrated.") is a modular multi-agent AI assistant workspace built for ₹0 free-tier operation. It coordinates four specialist roles—Aurenyx Research, Vaelor Forge, Vaelor Knowledge, and Vaelor Sentinel—alongside Vaelor Core.

2. Bounded Orchestration Ceiling
Every incoming user request is validated with Zod schemas on the server, rate-limited per client IP, and executed under a hard maximum ceiling of 4 model calls per request. Agents cannot self-grant permissions or invoke unregistered tools.

3. Separated Memory Architecture
Vaelor strictly separates three storage layers:
- Temporary Conversation Context: Bounded to the most recent messages in an active chat thread.
- Explicitly Saved User Memory: User-authored facts and preferences screened against credential patterns.
- Indexed Document Knowledge: Plain-text and markdown documents segmented into passage chunks for grounded citation retrieval.

4. Security Invariants
Provider API keys (GEMINI_API_KEY) remain strictly on the Node.js Express backend and are never exposed via VITE_ variables or client bundles. Service workers cache static frontend assets only and enforce NetworkOnly rules for all /api/* endpoints.`;

export class EphemeralSessionStore {
  public conversations: Conversation[] = [];
  public memories: SavedMemory[] = [];
  public documents: KnowledgeDocument[] = [];
  public projects: ProjectWorkspace[] = [];
  public taskRuns: StructuredTaskRun[] = [];

  constructor(seedStarterData = true) {
    if (seedStarterData) {
      this.seedDefaults();
    }
  }

  private seedDefaults(): void {
    const nowIso = new Date().toISOString();
    this.projects.push({
      id: 'proj_vaelor_01',
      name: 'Aurenyx Vaelor 0.1 Core',
      objective:
        'Validate bounded multi-agent orchestration, server-side Gemini gateway security, and Android-installable PWA readiness on a ₹0 budget.',
      category: 'software',
      status: 'active',
      createdAt: nowIso,
    });

    const chunks = chunkDocumentText(STARTER_ARCHITECTURE_DOC);
    this.documents.push({
      id: 'doc_vaelor_arch',
      title: 'Aurenyx Vaelor 0.1 Architecture & Security Brief',
      fileName: 'vaelor-architecture-0.1.md',
      sourceKind: 'starter',
      charCount: STARTER_ARCHITECTURE_DOC.length,
      wordCount: STARTER_ARCHITECTURE_DOC.split(/\s+/).filter(Boolean).length,
      chunks,
      createdAt: nowIso,
    });
  }

  public addProject(input: Omit<ProjectWorkspace, 'id' | 'createdAt' | 'status'>): ProjectWorkspace {
    const project: ProjectWorkspace = {
      id: `proj_${crypto.randomUUID().slice(0, 8)}`,
      name: input.name,
      objective: input.objective,
      category: input.category,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.projects.unshift(project);
    return project;
  }

  public deleteProject(id: string): boolean {
    const before = this.projects.length;
    this.projects = this.projects.filter((p) => p.id !== id);
    return this.projects.length < before;
  }

  public addMemory(input: Omit<SavedMemory, 'id' | 'createdAt'>): SavedMemory {
    const memory: SavedMemory = {
      id: `mem_${crypto.randomUUID().slice(0, 8)}`,
      label: input.label,
      content: input.content,
      category: input.category,
      createdAt: new Date().toISOString(),
    };
    this.memories.unshift(memory);
    return memory;
  }

  public deleteMemory(id: string): boolean {
    const before = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    return this.memories.length < before;
  }

  public addDocument(input: {
    title: string;
    fileName?: string;
    sourceKind: 'upload' | 'paste';
    content: string;
  }): KnowledgeDocument {
    const chunks = chunkDocumentText(input.content);
    const doc: KnowledgeDocument = {
      id: `doc_${crypto.randomUUID().slice(0, 8)}`,
      title: input.title,
      fileName: input.fileName,
      sourceKind: input.sourceKind,
      charCount: input.content.length,
      wordCount: input.content.split(/\s+/).filter(Boolean).length,
      chunks,
      createdAt: new Date().toISOString(),
    };
    this.documents.unshift(doc);
    return doc;
  }

  public deleteDocument(id: string): boolean {
    const before = this.documents.length;
    this.documents = this.documents.filter((d) => d.id !== id);
    return this.documents.length < before;
  }

  public recordTaskRun(run: StructuredTaskRun): void {
    this.taskRuns.unshift(run);
    if (this.taskRuns.length > 50) {
      this.taskRuns = this.taskRuns.slice(0, 50);
    }
  }

  public clearScope(scope: 'conversations' | 'memories' | 'documents' | 'tasks' | 'all'): void {
    if (scope === 'conversations' || scope === 'all') {
      this.conversations = [];
    }
    if (scope === 'memories' || scope === 'all') {
      this.memories = [];
    }
    if (scope === 'documents' || scope === 'all') {
      this.documents = [];
    }
    if (scope === 'tasks' || scope === 'all') {
      this.taskRuns = [];
    }
    if (scope === 'all') {
      this.projects = [];
    }
  }
}
