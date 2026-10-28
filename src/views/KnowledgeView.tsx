import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus2,
  MessageSquare,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { OfficialFooter } from '../components/OfficialFooter';
import type { MemoryItemType, SavedMemory } from '../shared/types';

export const KnowledgeView: React.FC = () => {
  const { user } = useAuth();
  const {
    documents,
    memories,
    memorySettings,
    projects,
    activeProjectId,
    ingestDocument,
    removeDocument,
    saveMemory,
    updateMemory,
    updateMemorySettings,
    exportMemoriesJson,
    removeMemory,
    setPreferredAgent,
    startNewConversation,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'memories' | 'documents'>('memories');

  // Document form state
  const [docTitle, setDocTitle] = useState('');
  const [docFileName, setDocFileName] = useState<string | undefined>(undefined);
  const [docSourceKind, setDocSourceKind] = useState<'paste' | 'upload'>('paste');
  const [docContent, setDocContent] = useState('');
  const [docError, setDocError] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  // Memory form & filter state
  const [scopeFilter, setScopeFilter] = useState<string>('__all__');
  const [memLabel, setMemLabel] = useState('');
  const [memCategory, setMemCategory] = useState<SavedMemory['category']>('project-fact');
  const [memType, setMemType] = useState<MemoryItemType>('decision');
  const [memProjectId, setMemProjectId] = useState<string>(() => activeProjectId || '');
  const [memRefUrl, setMemRefUrl] = useState('');
  const [memContent, setMemContent] = useState('');
  const [memError, setMemError] = useState<string | null>(null);
  const [memBusy, setMemBusy] = useState(false);

  // Inline Edit Memory state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState<MemoryItemType>('note');
  const [editContent, setEditContent] = useState('');
  const [editRefUrl, setEditRefUrl] = useState('');

  const navigate = useNavigate();

  const filteredMemories = useMemo(() => {
    if (scopeFilter === '__all__') return memories;
    if (scopeFilter === '__global__') return memories.filter((m) => !m.projectId);
    return memories.filter((m) => m.projectId === scopeFilter);
  }, [memories, scopeFilter]);

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 250_000) {
      setDocError('File exceeds 250 KB prototype limit. Extract key sections or split the file.');
      return;
    }

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setDocError(
        'Binary PDF OCR is not enabled in ₹0 prototype mode. Copy/paste text from your PDF reader below or upload a .txt / .md / .csv / .json file.'
      );
      return;
    }

    try {
      const text = await file.text();
      setDocTitle((prev) => prev.trim() || file.name.replace(/\.[^.]+$/, ''));
      setDocFileName(file.name);
      setDocSourceKind('upload');
      setDocContent(text.slice(0, 60000));
    } catch {
      setDocError('Could not read text from the selected file.');
    }
  };

  const handleIngestDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocError(null);
    if (docTitle.trim().length < 2) {
      setDocError('Enter a document title of at least 2 characters.');
      return;
    }
    if (docContent.trim().length < 10) {
      setDocError('Paste or upload at least 10 characters of document text.');
      return;
    }

    setDocBusy(true);
    const res = await ingestDocument({
      title: docTitle.trim(),
      fileName: docFileName,
      sourceKind: docSourceKind,
      content: docContent.trim(),
    });
    setDocBusy(false);

    if (!res.ok) {
      setDocError(res.error || 'Could not index document.');
      return;
    }

    setDocTitle('');
    setDocFileName(undefined);
    setDocSourceKind('paste');
    setDocContent('');
  };

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemError(null);
    if (memLabel.trim().length < 2 || memContent.trim().length < 2) {
      setMemError('Provide both a short label and memory note content.');
      return;
    }

    setMemBusy(true);
    const res = await saveMemory({
      label: memLabel.trim(),
      category: memCategory,
      memoryType: memType,
      projectId: memProjectId || undefined,
      referenceUrl: memRefUrl.trim() || undefined,
      content: memContent.trim(),
    });
    setMemBusy(false);

    if (!res.ok) {
      setMemError(res.error || 'Could not save memory note.');
      return;
    }

    setMemLabel('');
    setMemRefUrl('');
    setMemContent('');
  };

  const startEditingMemory = (mem: SavedMemory) => {
    setEditingId(mem.id);
    setEditLabel(mem.label);
    setEditType(mem.memoryType || 'note');
    setEditContent(mem.content);
    setEditRefUrl(mem.referenceUrl || '');
    setMemError(null);
  };

  const handleCommitEdit = async (id: string) => {
    setMemError(null);
    if (editLabel.trim().length < 2 || editContent.trim().length < 2) {
      setMemError('Edited memory requires both a label and content.');
      return;
    }
    setMemBusy(true);
    const res = await updateMemory(id, {
      label: editLabel.trim(),
      memoryType: editType,
      content: editContent.trim(),
      referenceUrl: editRefUrl.trim(),
    });
    setMemBusy(false);
    if (!res.ok) {
      setMemError(res.error || 'Could not update memory item.');
      return;
    }
    setEditingId(null);
  };

  const handleToggleGlobalInjection = async () => {
    await updateMemorySettings({
      globalEnabled: !memorySettings.globalEnabled,
      disabledProjectIds: memorySettings.disabledProjectIds,
    });
  };

  const handleToggleProjectInjection = async (projId: string) => {
    const currentlyDisabled = memorySettings.disabledProjectIds.includes(projId);
    const nextDisabled = currentlyDisabled
      ? memorySettings.disabledProjectIds.filter((id) => id !== projId)
      : [...memorySettings.disabledProjectIds, projId];
    await updateMemorySettings({
      globalEnabled: memorySettings.globalEnabled,
      disabledProjectIds: nextDisabled,
    });
  };

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <header className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#a59ec0]">
            <span>Project-Scoped Memory Isolation</span>
            <span aria-hidden="true">·</span>
            <span>Zero Cross-Project Leakage</span>
            <span aria-hidden="true">·</span>
            <span>
              {user?.emailVerified
                ? 'Cloud Firestore + Session Sync'
                : 'Session Memory Fallback (Verify email for Cloud Sync)'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
            Project Memory &amp; Knowledge Index
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
            Store user-approved notes, decisions, goals, summaries, and references isolated per
            project, control prompt injection globally or per project, and index text passages for
            grounded citations.
          </p>
        </header>

        {/* Interactive Segmented Tab Control */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-white/10 bg-[#13111d] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('memories')}
              className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'memories'
                  ? 'bg-[#251e3d] text-[#f5f3fc]'
                  : 'text-[#9e97b0] hover:text-white'
              }`}
            >
              Project Memory ({memories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'bg-[#251e3d] text-[#f5f3fc]'
                  : 'text-[#9e97b0] hover:text-white'
              }`}
            >
              Indexed Documents ({documents.length})
            </button>
          </div>

          {activeTab === 'memories' && (
            <button
              type="button"
              onClick={() =>
                void exportMemoriesJson(
                  scopeFilter === '__all__' || scopeFilter === '__global__'
                    ? undefined
                    : scopeFilter
                )
              }
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/12 bg-[#13111d] px-3.5 py-1.5 text-xs font-medium text-[#e4dff2] hover:border-white/25 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-[#a58ff8]" />
              <span>Export Memory JSON</span>
            </button>
          )}
        </div>

        {activeTab === 'memories' ? (
          <div className="space-y-6">
            {/* Memory Injection Governance Controls */}
            <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#f5f3fc]">
                    Memory Context Injection Controls
                  </h2>
                  <p className="text-xs text-[#958ea8]">
                    Control whether saved memories are injected into Chat, Mission Control, Deep
                    Research, and Vanguard Council prompts. Memories scoped to Project A never leak
                    into Project B.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleToggleGlobalInjection()}
                  className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    memorySettings.globalEnabled
                      ? 'bg-emerald-500 text-[#0b0a10] hover:bg-emerald-400'
                      : 'border border-white/15 bg-[#0e0c16] text-[#cfc8e2] hover:border-white/30'
                  }`}
                >
                  {memorySettings.globalEnabled
                    ? 'Global Memory Injection: Enabled'
                    : 'Global Memory Injection: Paused'}
                </button>
              </div>

              {projects.length > 0 && (
                <div className="border-t border-white/8 pt-3 space-y-2">
                  <p className="text-xs font-medium text-[#cfc8e2]">
                    Per-Project Memory Injection Toggles
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {projects.map((proj) => {
                      const isDisabled = memorySettings.disabledProjectIds.includes(proj.id);
                      return (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => void handleToggleProjectInjection(proj.id)}
                          className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs transition-colors whitespace-nowrap ${
                            !isDisabled && memorySettings.globalEnabled
                              ? 'border-emerald-500/35 bg-[#0e0c16] text-emerald-200'
                              : 'border-white/10 bg-[#0e0c16] text-[#958ea8]'
                          }`}
                        >
                          {proj.name}: {isDisabled ? 'Muted' : 'Active'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* Save Explicit Project Memory Form */}
              <section className="lg:col-span-5">
                <form
                  onSubmit={(e) => void handleSaveMemory(e)}
                  className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#f1eef9]">
                    <BookmarkPlus className="h-4 w-4 text-[#a58ff8]" />
                    <h2>Save Approved Memory Item</h2>
                  </div>

                  <p className="text-xs leading-relaxed text-[#958ea8]">
                    Only items you explicitly approve here are stored. API keys, tokens, and
                    credentials are rejected automatically.
                  </p>

                  {memError && (
                    <p role="alert" className="text-xs text-rose-300">
                      {memError}
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="mem-label" className="block text-xs font-medium text-[#cfc8e2]">
                      Memory Label
                    </label>
                    <input
                      id="mem-label"
                      type="text"
                      value={memLabel}
                      onChange={(e) => setMemLabel(e.target.value)}
                      maxLength={80}
                      placeholder="e.g., Target Database Architecture"
                      className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="mem-type"
                        className="block text-xs font-medium text-[#cfc8e2]"
                      >
                        Artifact Type
                      </label>
                      <select
                        id="mem-type"
                        value={memType}
                        onChange={(e) => setMemType(e.target.value as MemoryItemType)}
                        className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 text-xs text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                      >
                        <option value="note">Note</option>
                        <option value="decision">Decision</option>
                        <option value="goal">Goal</option>
                        <option value="summary">Summary</option>
                        <option value="reference">Reference</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="mem-cat" className="block text-xs font-medium text-[#cfc8e2]">
                        Category
                      </label>
                      <select
                        id="mem-cat"
                        value={memCategory}
                        onChange={(e) => setMemCategory(e.target.value as SavedMemory['category'])}
                        className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 text-xs text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                      >
                        <option value="project-fact">Project Fact</option>
                        <option value="constraint">Constraint</option>
                        <option value="preference">Preference</option>
                        <option value="note">General Note</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="mem-project-scope"
                      className="block text-xs font-medium text-[#cfc8e2]"
                    >
                      Project Isolation Scope
                    </label>
                    <select
                      id="mem-project-scope"
                      value={memProjectId}
                      onChange={(e) => setMemProjectId(e.target.value)}
                      className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 text-xs text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                    >
                      <option value="">Global Workspace (Shared Across Your Sessions)</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          Isolated to Project: {proj.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="mem-ref-url"
                      className="block text-xs font-medium text-[#cfc8e2]"
                    >
                      Optional Reference URL (https://)
                    </label>
                    <input
                      id="mem-ref-url"
                      type="url"
                      value={memRefUrl}
                      onChange={(e) => setMemRefUrl(e.target.value)}
                      maxLength={500}
                      placeholder="https://example.org/architecture-spec"
                      className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 font-mono text-xs text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="mem-content"
                      className="block text-xs font-medium text-[#cfc8e2]"
                    >
                      Memory Content
                    </label>
                    <textarea
                      id="mem-content"
                      rows={4}
                      value={memContent}
                      onChange={(e) => setMemContent(e.target.value)}
                      maxLength={1200}
                      placeholder="e.g., Enforce strict UID isolation on all API endpoints and maintain ₹0 free-tier compatibility."
                      className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3.5 text-xs leading-relaxed text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={memBusy}
                    className="min-h-[44px] w-full rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
                  >
                    {memBusy ? 'Saving…' : 'Save Approved Memory'}
                  </button>
                </form>
              </section>

              {/* Filtered Project Memory List */}
              <section className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#e4dff2]">
                    Stored Memory Items ({filteredMemories.length})
                  </h2>

                  <label className="flex items-center gap-2 text-xs text-[#cfc8e2]">
                    <span>Scope Filter</span>
                    <select
                      aria-label="Filter memories by project scope"
                      value={scopeFilter}
                      onChange={(e) => setScopeFilter(e.target.value)}
                      className="min-h-[38px] rounded-xl border border-white/10 bg-[#13111d] px-3 py-1.5 text-xs text-[#f5f3fc]"
                    >
                      <option value="__all__">All Scopes ({memories.length})</option>
                      <option value="__global__">Global Workspace Only</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          Project: {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {filteredMemories.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-[#12101b] p-8 text-center space-y-2">
                    <p className="text-sm font-medium text-[#e4dff2]">
                      No saved memories in this scope
                    </p>
                    <p className="text-xs text-[#918aa6]">
                      Vaelor never silently profiles you. Add an explicit project decision, goal, or
                      reference note on the left to make it available within its isolated scope.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMemories.map((mem) => {
                      const projectObj = projects.find((p) => p.id === mem.projectId);
                      const isEditing = editingId === mem.id;
                      return (
                        <article
                          key={mem.id}
                          className="rounded-2xl border border-white/8 bg-[#13111d] p-5 space-y-3"
                        >
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <input
                                  type="text"
                                  aria-label="Edit memory label"
                                  value={editLabel}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                  maxLength={80}
                                  className="min-h-[38px] rounded-lg border border-white/15 bg-[#0d0b14] px-3 py-1.5 text-xs text-[#f5f3fc]"
                                />
                                <select
                                  aria-label="Edit memory type"
                                  value={editType}
                                  onChange={(e) => setEditType(e.target.value as MemoryItemType)}
                                  className="min-h-[38px] rounded-lg border border-white/15 bg-[#0d0b14] px-3 py-1.5 text-xs text-[#f5f3fc]"
                                >
                                  <option value="note">Note</option>
                                  <option value="decision">Decision</option>
                                  <option value="goal">Goal</option>
                                  <option value="summary">Summary</option>
                                  <option value="reference">Reference</option>
                                </select>
                              </div>
                              <textarea
                                rows={3}
                                aria-label="Edit memory content"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                maxLength={1200}
                                className="w-full rounded-lg border border-white/15 bg-[#0d0b14] p-2.5 text-xs text-[#f5f3fc]"
                              />
                              <input
                                type="url"
                                aria-label="Edit memory reference URL"
                                value={editRefUrl}
                                onChange={(e) => setEditRefUrl(e.target.value)}
                                maxLength={500}
                                placeholder="Optional https:// reference URL"
                                className="min-h-[36px] w-full rounded-lg border border-white/15 bg-[#0d0b14] px-3 py-1 font-mono text-xs text-[#f5f3fc]"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={memBusy}
                                  onClick={() => void handleCommitEdit(mem.id)}
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[#8b6ff7] px-3 py-1 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] whitespace-nowrap"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Save Changes</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/12 bg-[#0e0c16] px-3 py-1 text-xs text-[#cfc8e2] whitespace-nowrap"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1.5 min-w-0">
                                <h3 className="text-sm font-semibold text-[#f5f3fc]">
                                  {mem.label}
                                </h3>
                                <p className="text-xs text-[#958ea8]">
                                  <span>{mem.memoryType || 'note'}</span>
                                  <span aria-hidden="true"> · </span>
                                  <span>{mem.category}</span>
                                  <span aria-hidden="true"> · </span>
                                  <span className="text-[#c5b3fc]">
                                    {projectObj
                                      ? `Project: ${projectObj.name}`
                                      : mem.projectId
                                        ? `Project ${mem.projectId}`
                                        : 'Global Workspace'}
                                  </span>
                                  <span aria-hidden="true"> · </span>
                                  <span className="font-mono tabular-nums">
                                    {new Date(mem.updatedAt || mem.createdAt).toLocaleTimeString(
                                      [],
                                      {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      }
                                    )}
                                  </span>
                                </p>
                                <p className="pt-1 text-sm leading-relaxed text-[#cfc8e2] whitespace-pre-wrap">
                                  {mem.content}
                                </p>
                                {mem.referenceUrl && (
                                  <p className="font-mono text-xs text-[#a58ff8] break-all">
                                    Ref: {mem.referenceUrl}
                                  </p>
                                )}
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEditingMemory(mem)}
                                  aria-label={`Edit memory ${mem.label}`}
                                  className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/8 bg-[#0e0c16] text-[#958ea8] hover:border-white/25 hover:text-white"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void removeMemory(mem.id)}
                                  aria-label={`Delete memory ${mem.label}`}
                                  className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/8 bg-[#0e0c16] text-[#958ea8] hover:border-rose-500/40 hover:text-rose-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Add Document Form */}
            <section className="lg:col-span-5">
              <form
                onSubmit={(e) => void handleIngestDocument(e)}
                className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#f1eef9]">
                  <FilePlus2 className="h-4 w-4 text-[#a58ff8]" />
                  <h2>Index Document Text</h2>
                </div>

                <p className="text-xs leading-relaxed text-[#958ea8]">
                  Upload a plain-text file (<code className="font-mono">.txt</code>,{' '}
                  <code className="font-mono">.md</code>, <code className="font-mono">.csv</code>,{' '}
                  <code className="font-mono">.json</code>) or paste extracted PDF text. Content is
                  wrapped inside untrusted data tags and chunked for passage citation.
                </p>

                {docError && (
                  <p role="alert" className="text-xs text-rose-300">
                    {docError}
                  </p>
                )}

                <div>
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-[#0e0c16] px-3.5 py-2 text-xs font-medium text-[#dfd9f2] hover:border-white/25">
                    <Upload className="h-4 w-4 text-[#a58ff8]" />
                    <span>Load .txt / .md / .csv / .json file</span>
                    <input
                      type="file"
                      accept=".txt,.md,.csv,.json,text/plain,text/markdown"
                      onChange={(e) => void handleFileLoad(e)}
                      className="sr-only"
                    />
                  </label>
                  {docFileName && (
                    <p className="mt-1.5 font-mono text-[11px] text-[#9e97b0]">
                      Loaded: {docFileName}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="doc-title" className="block text-xs font-medium text-[#cfc8e2]">
                    Document Title
                  </label>
                  <input
                    id="doc-title"
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    maxLength={120}
                    placeholder="e.g., Product Requirements Specification"
                    className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="doc-body" className="block text-xs font-medium text-[#cfc8e2]">
                    Extracted Text Content
                  </label>
                  <textarea
                    id="doc-body"
                    rows={6}
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    maxLength={60000}
                    placeholder="Paste document or PDF text here for chunking and grounded retrieval…"
                    className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3.5 text-xs leading-relaxed text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={docBusy}
                  className="min-h-[44px] w-full rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50"
                >
                  {docBusy ? 'Chunking & indexing…' : 'Index document'}
                </button>
              </form>
            </section>

            {/* Indexed Documents List */}
            <section className="lg:col-span-7 space-y-3">
              <h2 className="text-sm font-semibold text-[#e4dff2]">
                Session Document Index ({documents.length})
              </h2>

              {documents.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-[#12101b] p-8 text-center space-y-2">
                  <p className="text-sm font-medium text-[#e4dff2]">No indexed documents</p>
                  <p className="text-xs text-[#918aa6]">
                    Upload or paste a text document to enable passage-cited answers from Vaelor
                    Knowledge.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const isOpen = expandedDocId === doc.id;
                    return (
                      <article
                        key={doc.id}
                        className="rounded-2xl border border-white/8 bg-[#13111d] p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold text-[#f5f3fc]">{doc.title}</h3>
                            <p className="font-mono text-xs tabular-nums text-[#958ea8]">
                              {doc.sourceKind} · {doc.chunks.length} passages ·{' '}
                              {doc.wordCount.toLocaleString()} words
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPreferredAgent('vaelor-knowledge');
                                startNewConversation(
                                  `Summarize the key points from "${doc.title}" and cite which passage numbers support each point.`
                                );
                                void navigate('/');
                              }}
                              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#0e0c16] px-3 py-1.5 text-xs font-medium text-[#dfd9f2] hover:border-white/25 whitespace-nowrap"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-[#a58ff8]" />
                              <span>Query in Chat</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void removeDocument(doc.id)}
                              aria-label={`Remove document ${doc.title}`}
                              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/8 bg-[#0e0c16] text-[#958ea8] hover:border-rose-500/40 hover:text-rose-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setExpandedDocId(isOpen ? null : doc.id)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-[#b2a8d4] hover:text-white"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span>Inspect {doc.chunks.length} indexed passages</span>
                        </button>

                        {isOpen && (
                          <div className="space-y-2 border-t border-white/8 pt-3">
                            {doc.chunks.map((chunk) => (
                              <div
                                key={chunk.id}
                                className="rounded-xl bg-[#0d0b14] p-3 text-xs leading-relaxed text-[#c6c0da]"
                              >
                                <p className="mb-1 font-mono text-[11px] text-[#a58ff8]">
                                  Passage #{chunk.index + 1}
                                </p>
                                <p className="whitespace-pre-wrap">{chunk.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <OfficialFooter />
    </div>
  );
};
