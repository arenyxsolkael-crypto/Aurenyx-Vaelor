import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn, Play, ShieldCheck } from 'lucide-react';
import { OFFICIAL_ATTRIBUTION } from '../shared/types';
import { VaelorEmblem } from '../components/VaelorEmblem';
import { OfficialFooter } from '../components/OfficialFooter';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

type DemoTab = 'csv' | 'chart' | 'math';

const INITIAL_CSV = `Quarter,ActiveUsers,LatencyMs,CompletionRate
Q1,1240,1180,94.2
Q2,1890,1040,95.8
Q3,2650,980,97.1
Q4,3420,920,98.4`;

const INITIAL_CHART_SERIES = [
  { label: 'Q1', value: 124 },
  { label: 'Q2', value: 189 },
  { label: 'Q3', value: 265 },
  { label: 'Q4', value: 342 },
];

export const OverviewLandingView: React.FC = () => {
  const { user } = useAuth();
  const { startNewConversation } = useWorkspace();
  const navigate = useNavigate();

  const [demoTab, setDemoTab] = useState<DemoTab>('chart');
  const [csvInput, setCsvInput] = useState(INITIAL_CSV);
  const [mathInput, setMathInput] = useState('(1450 * 12) + sqrt(144) - 380');
  const [chartTitle, setChartTitle] = useState('Quarterly Indexed Passages (in hundreds)');

  const [demoRunning, setDemoRunning] = useState(false);
  const [demoOutput, setDemoOutput] = useState<string | null>(null);
  const [demoSvg, setDemoSvg] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const runLiveDemo = async () => {
    setDemoRunning(true);
    setDemoError(null);
    setDemoOutput(null);
    setDemoSvg(null);

    try {
      let body: Record<string, unknown>;
      if (demoTab === 'csv') {
        body = { tool: 'csv_analyzer', args: { csvText: csvInput } };
      } else if (demoTab === 'chart') {
        body = {
          tool: 'chart_generator',
          args: {
            title: chartTitle,
            chartType: 'bar',
            unit: 'k',
            series: INITIAL_CHART_SERIES,
          },
        };
      } else {
        body = { tool: 'calculator', args: { expression: mathInput } };
      }

      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        record?: { output: string; svgArtifact?: string; durationMs: number; tool: string };
      };

      if (!res.ok || !data.record) {
        setDemoError(data.error || 'Tool execution failed.');
        return;
      }

      setDemoOutput(data.record.output);
      if (data.record.svgArtifact) {
        setDemoSvg(data.record.svgArtifact);
      }
    } catch {
      setDemoError('Unable to reach server tool gateway.');
    } finally {
      setDemoRunning(false);
    }
  };

  useEffect(() => {
    void runLiveDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLaunchWorkspace = (seedPrompt?: string) => {
    if (seedPrompt) {
      startNewConversation(seedPrompt);
    }
    void navigate('/chat');
  };

  return (
    <div className="flex min-h-full flex-col justify-between bg-[#0b0a10] text-[#f1eef9]">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 space-y-16">
        {/* 1. Hero Section (2-Column Balanced Split on 1440px Desktop) */}
        <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 pt-2">
          <div className="flex flex-col justify-between space-y-6 lg:col-span-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs text-[#a59ec0]">
                <VaelorEmblem size="sm" />
                <span>
                  {OFFICIAL_ATTRIBUTION.founderOrganization} · Founded by{' '}
                  {OFFICIAL_ATTRIBUTION.founderName}
                </span>
              </div>

              <h1 className="text-[clamp(2.25rem,4vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-[#f6f4fc] [text-wrap:balance]">
                Intelligence, Orchestrated across Reasoning, Research, and Code.
              </h1>

              <p className="text-sm font-medium text-[#c5b3fc]">
                {OFFICIAL_ATTRIBUTION.secondaryBrandLine}
              </p>

              <p className="max-w-xl text-base leading-relaxed text-[#a8a1bd]">
                AURENYX VAELOR v0.4 coordinates Mission Control DAG workflows, project-isolated
                memory, 7-stage deep research, the Aether Vanguard Council, a non-executing Coding
                Lab, and Sentinel epistemic verification—engineered for an Android-first, ₹0
                free-tier workflow.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleLaunchWorkspace()}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#8b6ff7] px-5 py-2.5 text-sm font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] whitespace-nowrap"
                >
                  <span>{user ? 'Open Workspace' : 'Launch Workspace'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                {!user && (
                  <Link
                    to="/auth"
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-white/15 bg-[#19152b] px-4 py-2.5 text-sm font-medium text-[#f5f3fc] hover:border-[#8b6ff7]/50 whitespace-nowrap"
                  >
                    <LogIn className="h-4 w-4 text-[#c5b3fc]" />
                    <span>Sign In / Google</span>
                  </Link>
                )}

                <Link
                  to="/about"
                  className="inline-flex min-h-[46px] items-center rounded-xl border border-white/12 bg-[#13111d] px-4 py-2.5 text-sm font-medium text-[#e4dff2] hover:border-white/25 whitespace-nowrap"
                >
                  Review Capability Audit
                </Link>
              </div>

              <p className="text-xs text-[#8f88a3]">
                Server-isolated Gemini Gateway · Firebase Auth UID isolation · Zero client API keys
              </p>
            </div>
          </div>

          {/* Right Column: Live Interactive Deterministic Tool Console */}
          <div className="flex flex-col justify-start rounded-2xl border border-white/10 bg-[#13111d] p-5 lg:col-span-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#f5f3fc]">
                  Interactive Tool Gateway Sandbox
                </h2>
                <p className="text-xs text-[#958ea8]">
                  Executes real Zod-validated server tools on <code className="font-mono">/api/tools/execute</code>
                </p>
              </div>

              {/* Functional Segmented Control */}
              <div className="flex items-center gap-1 rounded-lg bg-[#0e0c16] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setDemoTab('chart');
                    setDemoOutput(null);
                    setDemoSvg(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    demoTab === 'chart'
                      ? 'bg-[#201934] text-[#f5f3fc]'
                      : 'text-[#958ea8] hover:text-[#e4dff2]'
                  }`}
                >
                  SVG Chart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDemoTab('csv');
                    setDemoOutput(null);
                    setDemoSvg(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    demoTab === 'csv'
                      ? 'bg-[#201934] text-[#f5f3fc]'
                      : 'text-[#958ea8] hover:text-[#e4dff2]'
                  }`}
                >
                  CSV Stats
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDemoTab('math');
                    setDemoOutput(null);
                    setDemoSvg(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    demoTab === 'math'
                      ? 'bg-[#201934] text-[#f5f3fc]'
                      : 'text-[#958ea8] hover:text-[#e4dff2]'
                  }`}
                >
                  Safe Math
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {demoTab === 'csv' && (
                <div>
                  <label htmlFor="demo-csv-input" className="block text-xs text-[#b5add0] mb-1">
                    CSV Dataset Input
                  </label>
                  <textarea
                    id="demo-csv-input"
                    rows={4}
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0e0c16] p-2.5 font-mono text-xs text-[#e4dff2] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>
              )}

              {demoTab === 'chart' && (
                <div>
                  <label htmlFor="demo-chart-title" className="block text-xs text-[#b5add0] mb-1">
                    Chart Title (Series: Q1=124k · Q2=189k · Q3=265k · Q4=342k)
                  </label>
                  <input
                    id="demo-chart-title"
                    type="text"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0e0c16] px-3 py-2 text-xs text-[#e4dff2] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>
              )}

              {demoTab === 'math' && (
                <div>
                  <label htmlFor="demo-math-input" className="block text-xs text-[#b5add0] mb-1">
                    Arithmetic Expression (evaluated without <code className="font-mono">eval()</code>)
                  </label>
                  <input
                    id="demo-math-input"
                    type="text"
                    value={mathInput}
                    onChange={(e) => setMathInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0e0c16] px-3 py-2 font-mono text-xs text-[#e4dff2] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => void runLiveDemo()}
                disabled={demoRunning}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#8b6ff7]/40 bg-[#1d1731] px-3.5 py-1.5 text-xs font-semibold text-[#dfd7fc] hover:bg-[#271f42] disabled:opacity-50 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{demoRunning ? 'Executing on server…' : 'Run Live Tool'}</span>
              </button>

              {demoError && (
                <p className="text-xs text-rose-300" role="alert">
                  {demoError}
                </p>
              )}

              {demoSvg && (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0e0c16] p-2">
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(demoSvg)}`}
                      alt="Interactive demo SVG chart output"
                      referrerPolicy="no-referrer"
                      className="mx-auto max-h-[210px] w-auto"
                    />
                  </div>
                  {demoOutput && (
                    <p className="font-mono text-[11px] tabular-nums text-[#a59ec0]">
                      {demoOutput}
                    </p>
                  )}
                </div>
              )}

              {demoOutput && !demoSvg && (
                <pre className="max-h-44 overflow-auto rounded-xl border border-white/8 bg-[#0e0c16] p-3 font-mono text-[11px] tabular-nums text-[#cfc8e2]">
                  {demoOutput}
                </pre>
              )}
            </div>
          </div>
        </section>

        {/* 2. Numbered Core Capabilities (Asymmetric Bento Grid — Editorial Numbering) */}
        <section className="space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
              Core Platform Architecture
            </h2>
            <p className="max-w-2xl text-sm text-[#9e97b0]">
              Four decoupled subsystems coordinate task classification, specialist execution, tool
              sandboxing, and post-generation review.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-[#13111d] p-6 md:col-span-2 space-y-2.5">
              <h3 className="text-base font-semibold text-[#f5f3fc]">
                01. Multi-Agent Task Orchestration
              </h3>
              <p className="text-sm leading-relaxed text-[#b5add0]">
                Requests are classified deterministically across Vaelor Core, Vaelor Research,
                Vaelor Forge, Vaelor Analyst, Vaelor Knowledge, and Vaelor Sentinel. Every task
                enforces loop prevention, a bounded ceiling of 4 model calls per request, and
                full <code className="font-mono">DRAFT → VERIFY</code> lifecycle visibility.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#13111d] p-6 space-y-2.5">
              <h3 className="text-base font-semibold text-[#f5f3fc]">
                02. Server-Isolated Model Gateway
              </h3>
              <p className="text-sm leading-relaxed text-[#b5add0]">
                Normalized <code className="font-mono">generate</code>,{' '}
                <code className="font-mono">stream</code>, and{' '}
                <code className="font-mono">getCapabilities</code> methods wrap Gemini{' '}
                <code className="font-mono">gemini-3.1-flash-lite</code> strictly on the backend.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#13111d] p-6 space-y-2.5">
              <h3 className="text-base font-semibold text-[#f5f3fc]">
                03. Vaelor Sentinel Verification
              </h3>
              <p className="text-sm leading-relaxed text-[#b5add0]">
                Combines deterministic regex invariants with structured JSON critic review to catch
                invented URLs, unconfigured search claims, calculator mismatches, and credential
                patterns.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#13111d] p-6 md:col-span-2 space-y-2.5">
              <h3 className="text-base font-semibold text-[#f5f3fc]">
                04. Grounded Documents, CSV Analytics & Multimodal Vision
              </h3>
              <p className="text-sm leading-relaxed text-[#b5add0]">
                Attach <code className="font-mono">.txt</code>, <code className="font-mono">.md</code>,{' '}
                <code className="font-mono">.csv</code>, <code className="font-mono">.json</code>,
                or PNG/JPEG/WEBP images directly in chat. Untrusted files are isolated inside{' '}
                <code className="font-mono">&lt;untrusted_data&gt;</code> delimiters to resist
                indirect prompt injection.
              </p>
            </article>
          </div>
        </section>

        {/* 3. Staged Tool & Integration Matrix (Stages A–D) */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-[#f6f4fc]">
              Staged Capability & Integration Matrix
            </h2>
            <p className="text-xs text-[#958ea8]">
              Honest operational status across Stages A through D under the ₹0 free-tier guardrail.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#13111d]">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="border-b border-white/8 text-[#958ea8]">
                <tr>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Capabilities & Tools</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Requirement / Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-[#ddd8ec]">
                <tr>
                  <td className="px-4 py-3 font-mono font-semibold text-[#f5f3fc]">Stage A</td>
                  <td className="px-4 py-3">
                    Safe Calculator, Date/Time Utility, Text Transformer, JSON Validator,
                    Non-Executing Static Code Reviewer, Document Passage Search, Task Planner
                  </td>
                  <td className="px-4 py-3 text-emerald-300">Active & Verified</td>
                  <td className="px-4 py-3 text-[#9e97b0]">Built-in · Zero external cost</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-semibold text-[#f5f3fc]">Stage B</td>
                  <td className="px-4 py-3">
                    CSV Statistical Analyzer & Evidence-Graded Research Framework; Authorized Web
                    Search Adapter
                  </td>
                  <td className="px-4 py-3 text-emerald-300">
                    CSV & Framework Active · Search Gated
                  </td>
                  <td className="px-4 py-3 text-[#9e97b0]">
                    Set <code className="font-mono">SEARCH_API_KEY</code> on server for live web
                    search
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-semibold text-[#f5f3fc]">Stage C</td>
                  <td className="px-4 py-3">
                    Multimodal Image Understanding, SVG Bar/Line Chart Generator, Browser Voice
                    Dictation, SVG Visual Frame Blueprints
                  </td>
                  <td className="px-4 py-3 text-emerald-300">Active (₹0 Mode)</td>
                  <td className="px-4 py-3 text-[#9e97b0]">
                    Paid raster image models remain disabled unless billing is enabled
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-semibold text-[#f5f3fc]">Stage D</td>
                  <td className="px-4 py-3">
                    Confirmation-Gated Workflow Connectors (Supabase Cloud Sync, Workspace OAuth,
                    Scheduled Automation)
                  </td>
                  <td className="px-4 py-3 text-amber-300">Requires Config & Confirmation</td>
                  <td className="px-4 py-3 text-[#9e97b0]">
                    Enforces explicit per-action user authorization before execution
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Founding Attribution & Launch Callout */}
        <section className="rounded-2xl border border-white/10 bg-[#13111d] p-6 sm:p-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              <span>Founding & Governance</span>
            </div>
            <h2 className="text-lg font-bold text-[#f6f4fc]">{OFFICIAL_ATTRIBUTION.statement}</h2>
            <p className="text-sm leading-relaxed text-[#a8a1bd]">
              {OFFICIAL_ATTRIBUTION.aboutStatement}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              handleLaunchWorkspace(
                'Compare three software architecture approaches in a Markdown table and highlight their security trade-offs.'
              )
            }
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#8b6ff7] px-5 py-2.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] whitespace-nowrap shrink-0"
          >
            <span>Try Orchestrated Prompt</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </div>

      <OfficialFooter />
    </div>
  );
};
