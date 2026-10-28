import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  Eye,
  FilePlus2,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { OfficialFooter } from '../components/OfficialFooter';
import type { CodingLabAssistResult, CodingLabFile, CodingLabMode } from '../shared/types';

const INITIAL_FILES: CodingLabFile[] = [
  {
    name: 'rateLimiter.ts',
    language: 'typescript',
    content: `export interface RateWindow {
  count: number;
  resetAtMs: number;
}

export function checkRateLimit(
  buckets: Map<string, RateWindow>,
  key: string,
  limitPerMinute: number,
  nowMs: number = Date.now()
): { allowed: boolean; remaining: number } {
  const current = buckets.get(key);
  if (!current || nowMs >= current.resetAtMs) {
    buckets.set(key, { count: 1, resetAtMs: nowMs + 60_000 });
    return { allowed: true, remaining: Math.max(0, limitPerMinute - 1) };
  }
  if (current.count >= limitPerMinute) {
    return { allowed: false, remaining: 0 };
  }
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limitPerMinute - current.count) };
}
`,
  },
  {
    name: 'statusCard.html',
    language: 'html',
    content: `<section style="font-family: system-ui, sans-serif; background:#13111d; color:#f5f3fc; padding:16px; border-radius:12px; border:1px solid rgba(255,255,255,0.12);">
  <h3 style="margin:0 0 6px 0; font-size:15px;">Gateway Rate Guardrail</h3>
  <p style="margin:0; font-size:12px; color:#b5add0;">Sliding window: 20 requests / min · Static preview only (scripts stripped).</p>
</section>`,
  },
];

/**
 * Strips executable scripts, event handlers, and javascript: URIs before rendering
 * inside a zero-permission `<iframe sandbox="">` static preview frame.
 */
function sanitizeStaticMarkupForPreview(raw: string): string {
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:');
}

export const CodingLabView: React.FC = () => {
  const { mockMode, runCodingLabAssist } = useWorkspace();

  const [files, setFiles] = useState<CodingLabFile[]>(INITIAL_FILES);
  const [activeIndex, setActiveIndex] = useState(0);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLang, setNewFileLang] = useState('typescript');

  const [mode, setMode] = useState<CodingLabMode>('inspect_and_review');
  const [prompt, setPrompt] = useState(
    'Audit all files for security risks, boundary bugs, and generate deterministic edge-case checks.'
  );
  const [showStaticPreview, setShowStaticPreview] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CodingLabAssistResult | null>(null);

  const activeFile = files[activeIndex] ?? files[0];

  const isPreviewableMarkup = useMemo(() => {
    if (!activeFile) return false;
    const lower = activeFile.name.toLowerCase();
    return (
      lower.endsWith('.html') ||
      lower.endsWith('.svg') ||
      activeFile.language === 'html' ||
      activeFile.language === 'svg'
    );
  }, [activeFile]);

  const sanitizedPreviewDoc = useMemo(() => {
    if (!activeFile) return '';
    return sanitizeStaticMarkupForPreview(activeFile.content);
  }, [activeFile]);

  const handleUpdateActiveContent = (content: string) => {
    setFiles((prev) => prev.map((f, idx) => (idx === activeIndex ? { ...f, content } : f)));
  };

  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const clean = newFileName.trim();
    if (!clean || !/^[a-zA-Z0-9._/-]{2,80}$/.test(clean)) {
      setErrorMessage('Enter a valid filename such as utils.ts or card.svg.');
      return;
    }
    if (files.length >= 8) {
      setErrorMessage('Coding Lab workspace supports up to 8 files per session.');
      return;
    }
    if (files.some((f) => f.name === clean)) {
      setErrorMessage(`A file named ${clean} already exists in this workspace.`);
      return;
    }
    const created: CodingLabFile = {
      name: clean,
      language: newFileLang,
      content: `// ${clean}\n`,
    };
    setFiles((prev) => [...prev, created]);
    setActiveIndex(files.length);
    setNewFileName('');
  };

  const handleDeleteFile = (idx: number) => {
    if (files.length <= 1) return;
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setActiveIndex(0);
  };

  const handleDownloadActiveFile = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunAssist = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (prompt.trim().length < 4) {
      setErrorMessage('Provide an instruction or inspection prompt of at least 4 characters.');
      return;
    }
    setBusy(true);
    const res = await runCodingLabAssist({
      mode,
      prompt: prompt.trim(),
      files,
      mockMode,
    });
    setBusy(false);

    if (!res.ok || !res.result) {
      setErrorMessage(res.error || 'Coding Lab operation failed.');
      return;
    }
    setResult(res.result);
  };

  const handleApplyGeneratedFiles = () => {
    if (!result || result.generatedFiles.length === 0) return;
    setFiles((prev) => {
      const merged = [...prev];
      for (const gf of result.generatedFiles) {
        const existingIdx = merged.findIndex((f) => f.name === gf.name);
        if (existingIdx >= 0) {
          merged[existingIdx] = gf;
        } else if (merged.length < 8) {
          merged.push(gf);
        }
      }
      return merged;
    });
  };

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <header className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#a59ec0]">
            <span>Vaelor Forge</span>
            <span aria-hidden="true">·</span>
            <span>Static Security Analysis &amp; Test Synthesis</span>
            <span aria-hidden="true">·</span>
            <span>Arbitrary Code Execution: Disabled</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">Secure Coding Lab</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
            Inspect multi-file codebases with deterministic static security checks, synthesize
            modular code updates, and generate runnable <code className="font-mono">node:test</code>{' '}
            plans—without executing untrusted code on server or browser.
          </p>
        </header>

        {/* Mandatory Sandbox & Non-Execution Disclosure Banner */}
        <section className="rounded-2xl border border-amber-400/25 bg-[#151221] p-4 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-200">
              <ShieldAlert className="h-4 w-4" />
              <span>Code Execution Sandbox: Unavailable (Static &amp; Non-Executing Mode)</span>
            </span>
            <span className="font-mono text-[11px] text-[#cfc8e2]">
              executedCode: false · sandboxStatus: unavailable
            </span>
          </div>
          <p className="leading-relaxed text-[#b5add0]">
            For your security, AURENYX VAELOR never runs <code className="font-mono">eval</code>,{' '}
            <code className="font-mono">new Function</code>, <code className="font-mono">vm</code>,
            or shell commands on AI-generated or uploaded code, and never attaches server secrets.
            HTML/SVG files can be inspected in a zero-script{' '}
            <code className="font-mono">sandbox=&quot;&quot;</code> static frame or downloaded for
            local testing.
          </p>
        </section>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-xs text-rose-200"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-rose-100 hover:bg-white/10 whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left 7 Columns: Multi-File Editor & Sandboxed Static Preview */}
          <section className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4">
              {/* File Tabs & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {files.map((file, idx) => (
                    <div key={file.name} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        className={`min-h-[38px] rounded-lg px-3 py-1.5 font-mono text-xs transition-colors whitespace-nowrap ${
                          idx === activeIndex
                            ? 'bg-[#251e3d] font-semibold text-[#f5f3fc]'
                            : 'bg-[#0e0c16] text-[#958ea8] hover:text-white'
                        }`}
                      >
                        {file.name}
                      </button>
                      {files.length > 1 && idx === activeIndex && (
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(idx)}
                          aria-label={`Remove file ${file.name}`}
                          className="ml-1 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#958ea8] hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {isPreviewableMarkup && (
                    <button
                      type="button"
                      onClick={() => setShowStaticPreview((v) => !v)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/12 bg-[#0e0c16] px-3 py-1.5 text-xs font-medium text-[#dfd9f2] hover:border-white/25 whitespace-nowrap"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#a58ff8]" />
                      <span>{showStaticPreview ? 'Hide Static Preview' : 'Static Preview'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDownloadActiveFile}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/12 bg-[#0e0c16] px-3 py-1.5 text-xs font-medium text-[#dfd9f2] hover:border-white/25 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5 text-[#a58ff8]" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>

              {/* Add New File Row */}
              <form onSubmit={handleAddFile} className="flex flex-wrap items-center gap-2">
                <label htmlFor="coding-new-filename" className="sr-only">
                  New file name
                </label>
                <input
                  id="coding-new-filename"
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  maxLength={80}
                  placeholder="New file (e.g. validator.test.ts)"
                  className="min-h-[38px] flex-1 rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-1.5 font-mono text-xs text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                />
                <label htmlFor="coding-new-filelang" className="sr-only">
                  New file language
                </label>
                <select
                  id="coding-new-filelang"
                  value={newFileLang}
                  onChange={(e) => setNewFileLang(e.target.value)}
                  className="min-h-[38px] rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-1.5 text-xs text-[#f5f3fc]"
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="json">JSON</option>
                  <option value="html">HTML</option>
                  <option value="svg">SVG</option>
                  <option value="markdown">Markdown</option>
                  <option value="kotlin">Kotlin</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/12 bg-[#0e0c16] px-3 py-1.5 text-xs font-medium text-[#e4dff2] hover:border-white/25 whitespace-nowrap"
                >
                  <FilePlus2 className="h-3.5 w-3.5 text-[#a58ff8]" />
                  <span>Add File</span>
                </button>
              </form>

              {/* Editor Surface */}
              {activeFile && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#958ea8]">
                    <label htmlFor="coding-lab-editor" className="font-mono text-[#cfc8e2]">
                      Editing: {activeFile.name} ({activeFile.language})
                    </label>
                    <span className="font-mono tabular-nums">
                      {activeFile.content.length.toLocaleString()} chars
                    </span>
                  </div>
                  <textarea
                    id="coding-lab-editor"
                    rows={14}
                    value={activeFile.content}
                    onChange={(e) => handleUpdateActiveContent(e.target.value)}
                    maxLength={40000}
                    spellCheck={false}
                    className="w-full rounded-xl border border-white/10 bg-[#09080f] p-3.5 font-mono text-xs leading-relaxed text-[#e8e4f5] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>
              )}

              {/* Sandboxed Zero-Script HTML/SVG Static Preview */}
              {showStaticPreview && isPreviewableMarkup && (
                <div className="space-y-2 border-t border-white/8 pt-3">
                  <div className="flex items-center justify-between text-xs text-[#958ea8]">
                    <span className="font-semibold text-[#e4dff2]">
                      Zero-Script Static Markup Preview (<code className="font-mono">sandbox=&quot;&quot;</code>)
                    </span>
                    <span>Scripts &amp; inline handlers stripped</span>
                  </div>
                  <iframe
                    title="Sandboxed Static Markup Preview"
                    sandbox=""
                    srcDoc={sanitizedPreviewDoc}
                    className="h-40 w-full rounded-xl border border-white/10 bg-[#0b0a10]"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Right 5 Columns: Assist Controls & Inspection Results */}
          <section className="lg:col-span-5 space-y-5">
            <form
              onSubmit={(e) => void handleRunAssist(e)}
              className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f5f3fc]">
                <Code2 className="h-4 w-4 text-[#a58ff8]" />
                <h2>Coding Lab Mode</h2>
              </div>

              <div className="flex flex-wrap gap-1 rounded-xl border border-white/8 bg-[#0e0c16] p-1">
                {(
                  [
                    { id: 'inspect_and_review', label: 'Static Review' },
                    { id: 'generate_code', label: 'Generate Code' },
                    { id: 'generate_test_plan', label: 'Test Plan' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={`min-h-[38px] flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      mode === item.id
                        ? 'bg-[#251e3d] text-[#f5f3fc]'
                        : 'text-[#958ea8] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="coding-lab-prompt" className="block text-xs font-medium text-[#cfc8e2]">
                  Instruction for Vaelor Forge
                </label>
                <textarea
                  id="coding-lab-prompt"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={3000}
                  className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3 text-xs leading-relaxed text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] w-full rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
              >
                {busy ? 'Running Non-Executing Analysis…' : 'Run Coding Lab Assist'}
              </button>
            </form>

            {result && (
              <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
                  <span className="font-semibold text-[#f5f3fc]">Analysis Output</span>
                  <span className="font-mono text-[11px] tabular-nums text-[#958ea8]">
                    {result.modelUsed} · {result.durationMs} ms
                  </span>
                </div>

                <p className="leading-relaxed text-[#dfd9f2] whitespace-pre-wrap">
                  {result.summary}
                </p>

                {result.generatedFiles.length > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0e0c16] p-3">
                    <span className="text-[#cfc8e2]">
                      {result.generatedFiles.length} generated file(s) ready to inspect
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyGeneratedFiles}
                      className="min-h-[36px] rounded-lg bg-[#8b6ff7] px-3 py-1 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] whitespace-nowrap"
                    >
                      Load into Editor
                    </button>
                  </div>
                )}

                {/* Static Findings */}
                <div className="space-y-2">
                  <p className="font-semibold text-[#e4dff2]">
                    Static Security &amp; Quality Findings ({result.staticFindings.length})
                  </p>
                  {result.staticFindings.length === 0 ? (
                    <p className="text-[#958ea8]">
                      No static security anti-patterns flagged in submitted files.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {result.staticFindings.map((f, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-white/8 bg-[#0e0c16] p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span
                              className={
                                f.severity === 'high'
                                  ? 'text-rose-300'
                                  : f.severity === 'medium'
                                    ? 'text-amber-300'
                                    : 'text-[#c5b3fc]'
                              }
                            >
                              {f.severity.toUpperCase()} · {f.rule}
                            </span>
                            <span className="text-[#8f88a3]">{f.file}</span>
                          </div>
                          <p className="text-[#cfc8e2]">{f.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Test Plan */}
                {result.testCases.length > 0 && (
                  <div className="space-y-2 border-t border-white/8 pt-3">
                    <p className="font-semibold text-[#e4dff2]">
                      Recommended <code className="font-mono">node:test</code> Verification Cases (
                      {result.testCases.length})
                    </p>
                    <p className="font-mono text-[11px] text-[#c5b3fc]">
                      Command: {result.recommendedTestCommand}
                    </p>
                    <div className="space-y-1.5">
                      {result.testCases.map((tc) => (
                        <div
                          key={tc.id}
                          className="rounded-xl border border-white/8 bg-[#0e0c16] p-2.5 space-y-0.5"
                        >
                          <p className="font-medium text-[#f5f3fc]">
                            {tc.title}{' '}
                            <span className="font-mono text-[11px] text-[#958ea8]">
                              ({tc.category} · {tc.targetFile})
                            </span>
                          </p>
                          <p className="text-[#a8a1bd]">Expected: {tc.expectedOutcome}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 border-t border-white/8 pt-3 text-[11px] text-[#a8a1bd]">
                  {result.sentinelReview.approved ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                  )}
                  <span>{result.sandboxNotice}</span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <OfficialFooter />
    </div>
  );
};
