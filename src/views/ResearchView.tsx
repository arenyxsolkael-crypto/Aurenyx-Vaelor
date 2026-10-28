import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Compass, FileSearch } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { OfficialFooter } from '../components/OfficialFooter';

export const ResearchView: React.FC = () => {
  const {
    health,
    documents,
    setPreferredAgent,
    setResearchMode,
    startNewConversation,
  } = useWorkspace();
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [constraints, setConstraints] = useState('');
  const [frameworkPreview, setFrameworkPreview] = useState<string | null>(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  const liveSearchReady = Boolean(health?.liveSearchConfigured);
  const searchMode = health?.groundedSearchMode ?? 'unavailable';

  const handleLaunchResearchSession = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;

    const structuredPrompt = [
      `Research Investigation Topic: ${cleanTopic}`,
      constraints.trim() ? `Scope & Constraints: ${constraints.trim()}` : '',
      'Please structure your analysis into the 5-part Vaelor Research v0.3 format:',
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
    void navigate('/');
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

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-[#a58ff8]">
            <Compass className="h-4 w-4" />
            <span>Vaelor Research Specialist · v0.3 Grounded Synthesis</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
            Research Mode & Source Honesty Studio
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
            Structured 5-part inquiry combining server-side Gemini Google Search Grounding (when
            available), indexed documents, and strict separation of verified facts from open
            unknowns—never fabricating URLs or citations.
          </p>
        </div>

        {/* Search Provider Connectivity Status */}
        <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#f5f3fc]">
              Grounded Web Search Connector Status
            </h2>
            {liveSearchReady ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {searchMode === 'gemini-google-search'
                    ? 'Gemini Google Search Grounding Enabled'
                    : 'Authorized Search Connector Ready'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span>Live Web Search Disconnected (₹0 Offline/Model-Grounded Mode)</span>
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[#a8a1bd]">
            {liveSearchReady
              ? `web_search_connector is active via ${
                  searchMode === 'gemini-google-search'
                    ? 'server-side Gemini Google Search Grounding'
                    : 'SEARCH_API_KEY'
                } plus your ${documents.length} indexed session documents. If upstream search quota is throttled or returns zero web chunks, Vaelor Research reports that transparently without inventing URLs.`
              : `No server API key is currently active for live search. Vaelor Research synthesizes established domain knowledge and your ${documents.length} indexed session documents, while explicitly flagging live prices, breaking news, or unverified URLs under Uncertainties & Limitations.`}
          </p>
        </section>

        {/* Research Brief Builder */}
        <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#f5f3fc]">
            Launch Structured Research Brief
          </h2>

          <form onSubmit={handleLaunchResearchSession} className="space-y-4">
            <div>
              <label htmlFor="research-topic" className="block text-xs font-medium text-[#cfc8e2] mb-1.5">
                Primary Research Question or Topic
              </label>
              <input
                id="research-topic"
                type="text"
                required
                minLength={3}
                maxLength={600}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Compare sodium-ion and lithium-iron-phosphate grid storage economics and supply constraints"
                className="w-full rounded-xl border border-white/10 bg-[#0e0c16] px-3.5 py-2.5 text-sm text-[#f5f3fc] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
              />
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
                placeholder="e.g., Focus on stationary microgrids in tropical climates; include a Markdown comparison table."
                className="w-full rounded-xl border border-white/10 bg-[#0e0c16] px-3.5 py-2.5 text-sm text-[#f5f3fc] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={topic.trim().length < 3}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#8b6ff7] px-4 py-2 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-40 whitespace-nowrap"
              >
                <span>Open in Vaelor Research</span>
                <ArrowRight className="h-4 w-4" />
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

        {/* Three-Tier Evidence Standard */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f5f3fc]">01. Verified Findings</h3>
            <p className="text-xs leading-relaxed text-[#a8a1bd]">
              Established scientific principles, documented technical standards, deterministic tool
              calculations, and verbatim passages from your uploaded documents.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f5f3fc]">02. Working Assumptions</h3>
            <p className="text-xs leading-relaxed text-[#a8a1bd]">
              Contextual syntheses, architectural trade-offs, and scenario estimates whose validity
              depends on scale, region, or deployment workload.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f5f3fc]">03. Open Unknowns</h3>
            <p className="text-xs leading-relaxed text-[#a8a1bd]">
              Real-time pricing, post-cutoff regulatory changes, and external URLs that require
              primary-source lookup or a configured search API key.
            </p>
          </div>
        </section>
      </div>

      <OfficialFooter />
    </div>
  );
};
