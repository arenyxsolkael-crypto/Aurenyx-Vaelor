import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  Download,
  ExternalLink,
  FileSearch,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { MarkdownView } from '../components/MarkdownView';
import { OfficialFooter } from '../components/OfficialFooter';
import type { DeepResearchReport } from '../shared/types';

export const ResearchView: React.FC = () => {
  const {
    health,
    documents,
    projects,
    activeProjectId,
    mockMode,
    deepResearchReports,
    runDeepResearch,
    setPreferredAgent,
    setResearchMode,
    startNewConversation,
  } = useWorkspace();
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [constraints, setConstraints] = useState('');
  const [projectId, setProjectId] = useState<string>(() => activeProjectId || '');
  const [frameworkPreview, setFrameworkPreview] = useState<string | null>(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  const [runningDeep, setRunningDeep] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const liveSearchReady = Boolean(health?.liveSearchConfigured) && !mockMode;
  const searchMode = health?.groundedSearchMode ?? 'unavailable';

  const activeReport: DeepResearchReport | undefined = useMemo(() => {
    if (selectedReportId) {
      const found = deepResearchReports.find((r) => r.id === selectedReportId);
      if (found) return found;
    }
    return deepResearchReports[0];
  }, [deepResearchReports, selectedReportId]);

  const handleRunDeepPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanTopic = topic.trim();
    if (cleanTopic.length < 4) {
      setErrorMessage('Enter a research question of at least 4 characters.');
      return;
    }

    const fullQuery = constraints.trim()
      ? `${cleanTopic}\nScope & Constraints: ${constraints.trim()}`
      : cleanTopic;

    setRunningDeep(true);
    const res = await runDeepResearch({
      query: fullQuery,
      projectId: projectId || undefined,
      mockMode,
    });
    setRunningDeep(false);

    if (!res.ok || !res.report) {
      setErrorMessage(res.error || 'Could not complete Deep Research workflow.');
      return;
    }
    setSelectedReportId(res.report.id);
  };

  const handleOpenInChat = () => {
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;

    const structuredPrompt = [
      `Research Investigation Topic: ${cleanTopic}`,
      constraints.trim() ? `Scope & Constraints: ${constraints.trim()}` : '',
      'Please structure your analysis into the 5-part Vaelor Research format:',
      '1. Direct Answer',
      '2. Key Findings',
      '3. Evidence & Citations (cite retrieved web sources or indexed session documents strictly when verified)',
      '4. Uncertainties & Limitations',
      '5. Sources',
    ]
      .filter(Boolean)
      .join('\n');

    setPreferredAgent('aurenyx-research');
    setResearchMode(true);
    startNewConversation(structuredPrompt);
    void navigate('/chat');
  };

  const handlePreviewMatrix = async () => {
    const cleanTopic = topic.trim();
    if (cleanTopic.length < 3) return;
    setLoadingMatrix(true);
    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'research_framework',
          args: { topic: cleanTopic },
        }),
      });
      const data = (await res.json()) as { record?: { output: string } };
      if (data.record?.output) {
        setFrameworkPreview(data.record.output);
      }
    } finally {
      setLoadingMatrix(false);
    }
  };

  const handleDownloadReport = (rep: DeepResearchReport) => {
    const blob = new Blob([rep.reportMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaelor-deep-research-${rep.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        <header className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#a58ff8]">
            <Compass className="h-4 w-4" />
            <span>Vaelor Deep Research v0.4</span>
            <span aria-hidden="true">·</span>
            <span>7-Stage Grounded Synthesis &amp; Claim-to-Source Matrix</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
            Deep Research &amp; Source Verification Studio
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
            Execute a transparent 7-stage research pipeline—clarifying sub-questions, querying
            authorized search providers and indexed documents, comparing source agreement, mapping
            claims to citations, and explicitly flagging unsupported statements or open unknowns.
          </p>
        </header>

        {/* Search Provider Connectivity Status */}
        <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#f5f3fc]">
              Grounded Web Search Connector Status
            </h2>
            {liveSearchReady ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {searchMode === 'gemini-google-search'
                    ? 'Gemini Google Search Grounding Active'
                    : 'Authorized Search Connector Active'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {mockMode
                    ? 'Local Mock Mode Active (Live Web Search Bypassed)'
                    : 'Live Web Search Unavailable (Indexed Docs + Model Synthesis Only)'}
                </span>
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[#a8a1bd]">
            {liveSearchReady
              ? `Real search executes via ${
                  searchMode === 'gemini-google-search'
                    ? 'server-side Gemini Google Search Grounding'
                    : 'configured search connector'
                } alongside your ${documents.length} indexed session documents. Every URL and access timestamp is recorded verbatim.`
              : `External web search is not active for this run. Deep Research will evaluate your ${documents.length} indexed session documents and project memories, mark uncorroborated web claims as Open Unknowns, and never invent URLs.`}
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

        {/* Research Brief Builder */}
        <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#f5f3fc]">
            Run 7-Stage Deep Research Investigation
          </h2>

          <form onSubmit={(e) => void handleRunDeepPipeline(e)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <label
                  htmlFor="research-topic"
                  className="block text-xs font-medium text-[#cfc8e2] mb-1.5"
                >
                  Primary Research Question or Topic
                </label>
                <input
                  id="research-topic"
                  type="text"
                  required
                  minLength={4}
                  maxLength={600}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Compare sodium-ion and lithium-iron-phosphate grid storage economics and supply constraints"
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0e0c16] px-3.5 py-2.5 text-sm text-[#f5f3fc] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <div className="lg:col-span-4">
                <label
                  htmlFor="research-project"
                  className="block text-xs font-medium text-[#cfc8e2] mb-1.5"
                >
                  Project Context Scope
                </label>
                <select
                  id="research-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0e0c16] px-3 py-2 text-xs text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                >
                  <option value="">Global Workspace (No Project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="research-constraints"
                className="block text-xs font-medium text-[#cfc8e2] mb-1.5"
              >
                Optional Scope, Geography, or Decision Criteria
              </label>
              <textarea
                id="research-constraints"
                rows={2}
                maxLength={600}
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="e.g., Focus on stationary microgrids in tropical climates; highlight contradictory cost estimates."
                className="w-full rounded-xl border border-white/10 bg-[#0e0c16] px-3.5 py-2.5 text-sm text-[#f5f3fc] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={topic.trim().length < 4 || runningDeep}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#8b6ff7] px-4 py-2 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-45 whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {runningDeep ? 'Running 7-Stage Pipeline…' : 'Run 7-Stage Deep Research'}
                </span>
              </button>

              <button
                type="button"
                disabled={topic.trim().length < 3 || runningDeep}
                onClick={handleOpenInChat}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/12 bg-[#0e0c16] px-3.5 py-2 text-xs font-medium text-[#e4dff2] hover:border-white/25 disabled:opacity-40 whitespace-nowrap"
              >
                <span>Open in Vaelor Chat</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                disabled={topic.trim().length < 3 || loadingMatrix}
                onClick={() => void handlePreviewMatrix()}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/12 bg-[#0e0c16] px-3.5 py-2 text-xs font-medium text-[#e4dff2] hover:border-white/25 disabled:opacity-40 whitespace-nowrap"
              >
                <FileSearch className="h-3.5 w-3.5 text-[#a58ff8]" />
                <span>{loadingMatrix ? 'Checking rubric…' : 'Preview Evidence Rubric'}</span>
              </button>
            </div>
          </form>

          {frameworkPreview && (
            <pre className="overflow-x-auto rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 font-mono text-xs text-[#cfc8e2]">
              {frameworkPreview}
            </pre>
          )}
        </section>

        {/* Active Deep Research Report Inspector */}
        {deepResearchReports.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="select-research-report" className="text-xs font-medium text-[#cfc8e2]">
              Completed Deep Research Reports ({deepResearchReports.length})
            </label>
            <select
              id="select-research-report"
              value={activeReport?.id || ''}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="min-h-[40px] max-w-full rounded-xl border border-white/10 bg-[#13111d] px-3 py-1.5 text-xs text-[#f5f3fc]"
            >
              {deepResearchReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.query.slice(0, 60)}… ({r.statusLabel})
                </option>
              ))}
            </select>
          </div>
        )}

        {activeReport && (
          <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-4">
              <div className="space-y-1">
                <p className="font-mono text-xs tabular-nums text-[#a59ec0]">
                  {activeReport.statusLabel} · Provider: {activeReport.searchProviderUsed} ·{' '}
                  {activeReport.durationMs} ms
                </p>
                <h2 className="text-lg font-bold text-[#f6f4fc]">{activeReport.query}</h2>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadReport(activeReport)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/12 bg-[#0e0c16] px-3.5 py-1.5 text-xs font-medium text-[#e4dff2] hover:border-white/25 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-[#a58ff8]" />
                <span>Download Report (.md)</span>
              </button>
            </div>

            {/* 1. 7-Stage Pipeline Execution Trace */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#e4dff2]">7-Stage Workflow Trace</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                {activeReport.stages.map((st, idx) => (
                  <div
                    key={st.id}
                    className="rounded-xl border border-white/8 bg-[#0e0c16] p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                      <span className="text-[#c5b3fc]">
                        0{idx + 1}. {st.label}
                      </span>
                      <span
                        className={
                          st.status === 'completed'
                            ? 'text-emerald-300'
                            : st.status === 'degraded'
                              ? 'text-amber-300'
                              : 'text-[#8f88a3]'
                        }
                      >
                        {st.status}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#a8a1bd]">{st.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Clarified Sub-Questions */}
            {activeReport.clarifiedQuestions.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <h3 className="font-semibold text-[#e4dff2]">Clarified Sub-Questions</h3>
                <ul className="space-y-1 text-[#cfc8e2]">
                  {activeReport.clarifiedQuestions.map((q, i) => (
                    <li key={i}>
                      0{i + 1}. {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 3. Retrieved Sources Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#e4dff2]">
                Retrieved Sources ({activeReport.sources.length})
              </h3>
              {activeReport.sources.length === 0 ? (
                <p className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 text-xs text-amber-200">
                  Zero external or session sources were retrieved for this query. All factual claims
                  requiring external verification are marked below as Unsupported or Unknown rather
                  than fabricating citations.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/8 bg-[#0e0c16]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/8 text-[#958ea8]">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">ID</th>
                        <th className="px-3 py-2.5 font-medium">Source Title &amp; Excerpt</th>
                        <th className="px-3 py-2.5 font-medium">Type</th>
                        <th className="px-3 py-2.5 font-medium">Accessed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6 text-[#ddd8ec]">
                      {activeReport.sources.map((src) => (
                        <tr key={src.id} className="align-top">
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[#c5b3fc] whitespace-nowrap">
                            {src.id}
                          </td>
                          <td className="px-3 py-2.5 space-y-1">
                            <div className="font-medium text-[#f5f3fc]">{src.sourceTitle}</div>
                            <p className="text-[11px] text-[#a8a1bd]">{src.excerpt}</p>
                            {src.url && (
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-[11px] text-[#8ad8ff] hover:underline break-all"
                              >
                                <span>{src.url}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">
                            {src.sourceType}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-[#958ea8] whitespace-nowrap">
                            {src.retrievedAt ? src.retrievedAt.slice(0, 10) : 'Session'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 4. Source Comparison Matrix */}
            {activeReport.comparisons.length > 0 && (
              <div className="space-y-2 text-xs">
                <h3 className="font-semibold text-[#e4dff2]">Source Agreement &amp; Contradictions</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {activeReport.comparisons.map((cmp, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/8 bg-[#0e0c16] p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#f5f3fc]">{cmp.topic}</span>
                        <span className="font-mono text-[11px] text-[#c5b3fc]">
                          {cmp.agreementLevel}
                        </span>
                      </div>
                      <p className="text-[#a8a1bd]">{cmp.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Claim-to-Source Epistemic Matrix */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#e4dff2]">
                Claim-to-Source Epistemic Matrix ({activeReport.claims.length})
              </h3>
              <div className="overflow-x-auto rounded-xl border border-white/8 bg-[#0e0c16]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/8 text-[#958ea8]">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Claim Statement</th>
                      <th className="px-3 py-2.5 font-medium">Epistemic Class</th>
                      <th className="px-3 py-2.5 font-medium">Supporting Sources</th>
                      <th className="px-3 py-2.5 font-medium">Verification Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6 text-[#ddd8ec]">
                    {activeReport.claims.map((cl) => (
                      <tr key={cl.id} className="align-top">
                        <td className="px-3 py-2.5 text-[#f5f3fc]">{cl.statement}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">
                          <span
                            className={
                              cl.epistemicClass === 'verified_fact'
                                ? 'text-emerald-300'
                                : cl.epistemicClass === 'plausible_inference'
                                  ? 'text-[#c5b3fc]'
                                  : 'text-amber-300'
                            }
                          >
                            {cl.epistemicClass}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-[#b8d8f8] whitespace-nowrap">
                          {cl.sourceIds.length > 0 ? cl.sourceIds.join(', ') : 'none'}
                        </td>
                        <td className="px-3 py-2.5 text-[#a8a1bd]">{cl.verificationNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. Uncertainties & Unsupported Statements */}
            {(activeReport.uncertainties.length > 0 ||
              activeReport.unsupportedStatements.length > 0) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 space-y-1.5">
                  <p className="font-semibold text-amber-300">Open Uncertainties</p>
                  <ul className="space-y-1 text-[#cfc8e2]">
                    {activeReport.uncertainties.map((u, i) => (
                      <li key={i}>• {u}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 space-y-1.5">
                  <p className="font-semibold text-rose-200">Unsupported / Unverified Claims</p>
                  <ul className="space-y-1 text-[#cfc8e2]">
                    {(activeReport.unsupportedStatements.length > 0
                      ? activeReport.unsupportedStatements
                      : ['No unsupported statements asserted as fact.']
                    ).map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 7. Synthesized Final Report */}
            <div className="space-y-2 border-t border-white/8 pt-4">
              <h3 className="text-xs font-semibold text-[#e4dff2]">Synthesized Research Report</h3>
              <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-4">
                <MarkdownView content={activeReport.reportMarkdown} />
              </div>
            </div>
          </section>
        )}

        {/* Three-Tier Evidence Standard */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f5f3fc]">01. Verified Facts</h3>
            <p className="text-xs leading-relaxed text-[#a8a1bd]">
              Claims directly backed by retrieved web sources, deterministic tool outputs, or
              verbatim passages from your indexed documents.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f5f3fc]">02. Plausible Inferences</h3>
            <p className="text-xs leading-relaxed text-[#a8a1bd]">
              Contextual syntheses, engineering trade-offs, and reasoned extrapolations whose
              validity depends on workload, geography, or operating assumptions.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f5f3fc]">03. Open Unknowns</h3>
            <p className="text-xs leading-relaxed text-[#a8a1bd]">
              Live pricing, post-cutoff regulatory changes, and external URLs when search is
              disconnected or uncorroborated—flagged explicitly rather than guessed.
            </p>
          </div>
        </section>
      </div>

      <OfficialFooter />
    </div>
  );
};
