import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  MessageSquare,
  Trash2,
  Upload,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { SavedMemory } from '../shared/types';

export const KnowledgeView: React.FC = () => {
  const {
    documents,
    memories,
    ingestDocument,
    removeDocument,
    saveMemory,
    removeMemory,
    setPreferredAgent,
    startNewConversation,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'documents' | 'memories'>('documents');

  // Document form state
  const [docTitle, setDocTitle] = useState('');
  const [docFileName, setDocFileName] = useState<string | undefined>(undefined);
  const [docSourceKind, setDocSourceKind] = useState<'paste' | 'upload'>('paste');
  const [docContent, setDocContent] = useState('');
  const [docError, setDocError] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  // Memory form state
  const [memLabel, setMemLabel] = useState('');
  const [memCategory, setMemCategory] = useState<SavedMemory['category']>('project-fact');
  const [memContent, setMemContent] = useState('');
  const [memError, setMemError] = useState<string | null>(null);
  const [memBusy, setMemBusy] = useState(false);

  const navigate = useNavigate();

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
      content: memContent.trim(),
    });
    setMemBusy(false);

    if (!res.ok) {
      setMemError(res.error || 'Could not save memory note.');
      return;
    }

    setMemLabel('');
    setMemContent('');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
          Knowledge & Memory Workspace
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
          Vaelor separates temporary chat turns, indexed document passages, and explicitly saved user
          memory notes. All records currently reside in temporary server session memory (₹0 Free
          Tier) and can be deleted anytime.
        </p>
      </div>

      {/* Interactive Segmented Tab Control */}
      <div className="inline-flex rounded-xl border border-white/10 bg-[#13111d] p-1">
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
        <button
          type="button"
          onClick={() => setActiveTab('memories')}
          className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
            activeTab === 'memories'
              ? 'bg-[#251e3d] text-[#f5f3fc]'
              : 'text-[#9e97b0] hover:text-white'
          }`}
        >
          Saved User Memory ({memories.length})
        </button>
      </div>

      {activeTab === 'documents' ? (
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
                wrapped as untrusted data and chunked for passage citation.
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
      ) : (
        /* Explicitly Saved User Memory Tab */
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <section className="lg:col-span-5">
            <form
              onSubmit={(e) => void handleSaveMemory(e)}
              className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f1eef9]">
                <BookmarkPlus className="h-4 w-4 text-[#a58ff8]" />
                <h2>Save Explicit Memory Note</h2>
              </div>

              <p className="text-xs leading-relaxed text-[#958ea8]">
                Only notes you explicitly save here are shared as user memory context. Secrets and
                API keys are automatically blocked.
              </p>

              {memError && (
                <p role="alert" className="text-xs text-rose-300">
                  {memError}
                </p>
              )}

              <div className="space-y-1.5">
                <label htmlFor="mem-label" className="block text-xs font-medium text-[#cfc8e2]">
                  Label
                </label>
                <input
                  id="mem-label"
                  type="text"
                  value={memLabel}
                  onChange={(e) => setMemLabel(e.target.value)}
                  maxLength={80}
                  placeholder="e.g., Preferred Stack"
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mem-cat" className="block text-xs font-medium text-[#cfc8e2]">
                  Category
                </label>
                <select
                  id="mem-cat"
                  value={memCategory}
                  onChange={(e) => setMemCategory(e.target.value as SavedMemory['category'])}
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                >
                  <option value="preference">Preference</option>
                  <option value="project-fact">Project Fact</option>
                  <option value="constraint">Constraint</option>
                  <option value="note">General Note</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mem-content" className="block text-xs font-medium text-[#cfc8e2]">
                  Memory Content
                </label>
                <textarea
                  id="mem-content"
                  rows={4}
                  value={memContent}
                  onChange={(e) => setMemContent(e.target.value)}
                  maxLength={1200}
                  placeholder="e.g., Target primary developer device is an Android browser; prefer beginner-friendly TypeScript explanations."
                  className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3.5 text-xs leading-relaxed text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={memBusy}
                className="min-h-[44px] w-full rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50"
              >
                {memBusy ? 'Saving…' : 'Save memory note'}
              </button>
            </form>
          </section>

          <section className="lg:col-span-7 space-y-3">
            <h2 className="text-sm font-semibold text-[#e4dff2]">
              Saved Session Memory Notes ({memories.length})
            </h2>

            {memories.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-[#12101b] p-8 text-center space-y-2">
                <p className="text-sm font-medium text-[#e4dff2]">No saved user memories</p>
                <p className="text-xs text-[#918aa6]">
                  Vaelor does not silently record long-term user profiles. Add an explicit note on
                  the left if you want specialists to reference it during this session.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {memories.map((mem) => (
                  <article
                    key={mem.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-[#13111d] p-5"
                  >
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-semibold text-[#f5f3fc]">{mem.label}</h3>
                      <p className="text-xs text-[#958ea8]">
                        {mem.category} · Saved{' '}
                        {new Date(mem.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="pt-1 text-sm leading-relaxed text-[#cfc8e2]">{mem.content}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void removeMemory(mem.id)}
                      aria-label={`Delete memory ${mem.label}`}
                      className="inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-white/8 bg-[#0e0c16] text-[#958ea8] hover:border-rose-500/40 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
