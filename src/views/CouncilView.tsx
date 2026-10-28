import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { OfficialFooter } from '../components/OfficialFooter';
import type { CouncilRoleId, CouncilSessionResult } from '../shared/types';

const COUNCIL_ROLES: { id: CouncilRoleId; label: string; summary: string }[] = [
  {
    id: 'researcher',
    label: 'Researcher',
    summary: 'Evaluates empirical evidence, retrieved citations, and open unknowns.',
  },
  {
    id: 'engineer',
    label: 'Engineer',
    summary: 'Inspects architecture, failure modes, latency ceilings, and security trade-offs.',
  },
  {
    id: 'strategist',
    label: 'Strategist',
    summary: 'Balances user value, sequencing, ₹0 cost constraints, and operational risk.',
  },
  {
    id: 'skeptical_reviewer',
    label: 'Skeptical Reviewer',
    summary: 'Challenges unstated assumptions, edge cases, and overconfident claims.',
  },
];

const COUNCIL_PRESETS = [
  'Should our Android-first web workspace store long-form document indexes in client IndexedDB or server-verified cloud storage under a ₹0 budget?',
  'Evaluate adopting optimistic UI updates vs. strict server-authoritative confirmation for approval-gated AI workflow actions.',
];

export const CouncilView: React.FC = () => {
  const { councilSessions, projects, activeProjectId, mockMode, routerStatus, conveneCouncil } =
    useWorkspace();

  const [prompt, setPrompt] = useState('');
  const [projectId, setProjectId] = useState<string>(() => activeProjectId || '');
  const [selectedRoles, setSelectedRoles] = useState<CouncilRoleId[]>([
    'researcher',
    'engineer',
    'strategist',
    'skeptical_reviewer',
  ]);
  const [maxCallBudget, setMaxCallBudget] = useState(4);
  const [maxCharsPerRole, setMaxCharsPerRole] = useState(1200);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeRoleTab, setActiveRoleTab] = useState<CouncilRoleId>('researcher');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeSession: CouncilSessionResult | undefined = useMemo(() => {
    if (selectedSessionId) {
      const found = councilSessions.find((s) => s.id === selectedSessionId);
      if (found) return found;
    }
    return councilSessions[0];
  }, [councilSessions, selectedSessionId]);

  const toggleRole = (roleId: CouncilRoleId) => {
    setSelectedRoles((prev) => {
      if (prev.includes(roleId)) {
        if (prev.length <= 2) return prev; // Keep at least 2 roles for meaningful comparison
        return prev.filter((r) => r !== roleId);
      }
      return [...prev, roleId];
    });
  };

  const handleConvene = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (prompt.trim().length < 6) {
      setErrorMessage('Enter a question or decision brief of at least 6 characters.');
      return;
    }

    setBusy(true);
    const res = await conveneCouncil({
      prompt: prompt.trim(),
      projectId: projectId || undefined,
      selectedRoles,
      maxCallBudget,
      maxCharsPerRole,
      mockMode,
    });
    setBusy(false);

    if (!res.ok || !res.session) {
      setErrorMessage(res.error || 'Could not convene Vanguard Council.');
      return;
    }

    setSelectedSessionId(res.session.id);
    if (res.session.roleOutputs[0]) {
      setActiveRoleTab(res.session.roleOutputs[0].roleId);
    }
  };

  const inspectedRoleOutput =
    activeSession?.roleOutputs.find((r) => r.roleId === activeRoleTab) ??
    activeSession?.roleOutputs[0];

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <header className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#a59ec0]">
            <span>The Aether Vanguard</span>
            <span aria-hidden="true">·</span>
            <span>Multi-Perspective Specialist Deliberation</span>
            <span aria-hidden="true">·</span>
            <span>Router Mode: {routerStatus?.operatingMode || 'single-model'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
            Aether Vanguard Council
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
            Convene distinct specialist mandates—Researcher, Engineer, Strategist, and Skeptical
            Reviewer—to surface agreements, architectural disagreements, cited evidence, and
            unresolved questions before committing to a decision.
          </p>
        </header>

        {/* Honest Model Disclosure Banner */}
        <section className="rounded-2xl border border-white/10 bg-[#13111d] p-4 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[#f5f3fc]">
              Model Architecture &amp; Independence Disclosure
            </span>
            <span className="font-mono tabular-nums text-[#c5b3fc]">
              {activeSession
                ? activeSession.isIndependentMultiModel
                  ? 'Multi-Model Routing'
                  : `Shared Foundation Model (${activeSession.operatingMode})`
                : routerStatus?.distinctModelsConfigured
                  ? 'Multi-Model Configured'
                  : 'Single-Model Role Specialization'}
            </span>
          </div>
          <p className="leading-relaxed text-[#a8a1bd]">
            {activeSession?.modelHonestyDisclosure ||
              routerStatus?.disclosureNote ||
              'When running on the ₹0 free-tier configuration, specialist Council roles execute isolated role prompts and rubrics over the shared server-side Gemini model rather than separate foundation model families.'}
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
          {/* Left: Convene Council Form */}
          <section className="lg:col-span-5">
            <form
              onSubmit={(e) => void handleConvene(e)}
              className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f5f3fc]">
                <Users className="h-4 w-4 text-[#a58ff8]" />
                <h2>Convene Specialist Session</h2>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-[#958ea8]">Example Deliberations</p>
                <div className="flex flex-wrap gap-2">
                  {COUNCIL_PRESETS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPrompt(sample);
                        setErrorMessage(null);
                      }}
                      className="min-h-[38px] rounded-lg border border-white/10 bg-[#0e0c16] px-3 py-1.5 text-xs text-[#dfd9f2] hover:border-[#8b6ff7]/50 whitespace-nowrap"
                    >
                      Load Dilemma #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="council-prompt" className="block text-xs font-medium text-[#cfc8e2]">
                  Decision Brief or Technical Question
                </label>
                <textarea
                  id="council-prompt"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={3000}
                  placeholder="Present an architectural, strategic, or research question for structured specialist critique…"
                  className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3.5 text-xs leading-relaxed text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="council-project"
                  className="block text-xs font-medium text-[#cfc8e2]"
                >
                  Project Context Scope
                </label>
                <select
                  id="council-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 text-xs text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                >
                  <option value="">Global Workspace (No Project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-[#cfc8e2]">
                  Participating Specialist Roles (min 2)
                </legend>
                <div className="space-y-1.5">
                  {COUNCIL_ROLES.map((role) => {
                    const checked = selectedRoles.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/8 bg-[#0e0c16] p-2.5 text-xs hover:border-white/20"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRole(role.id)}
                          className="mt-0.5 h-3.5 w-3.5 accent-[#8b6ff7]"
                        />
                        <div>
                          <div className="font-semibold text-[#f5f3fc]">{role.label}</div>
                          <div className="text-[11px] text-[#958ea8]">{role.summary}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="council-call-budget"
                    className="block text-xs font-medium text-[#cfc8e2]"
                  >
                    Call Budget (1–4)
                  </label>
                  <input
                    id="council-call-budget"
                    type="number"
                    min={1}
                    max={4}
                    value={maxCallBudget}
                    onChange={(e) =>
                      setMaxCallBudget(Math.min(4, Math.max(1, Number(e.target.value) || 4)))
                    }
                    className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 font-mono text-xs tabular-nums text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="council-char-limit"
                    className="block text-xs font-medium text-[#cfc8e2]"
                  >
                    Max Chars / Role
                  </label>
                  <input
                    id="council-char-limit"
                    type="number"
                    min={400}
                    max={2400}
                    step={200}
                    value={maxCharsPerRole}
                    onChange={(e) =>
                      setMaxCharsPerRole(
                        Math.min(2400, Math.max(400, Number(e.target.value) || 1200))
                      )
                    }
                    className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 font-mono text-xs tabular-nums text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] w-full rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
              >
                {busy ? 'Deliberating Across Specialists…' : 'Convene Vanguard Council'}
              </button>
            </form>
          </section>

          {/* Right: Synthesis & Individual Role Inspector */}
          <section className="lg:col-span-7 space-y-5">
            {councilSessions.length > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="council-session-select" className="text-xs font-medium text-[#cfc8e2]">
                  Recent Sessions ({councilSessions.length})
                </label>
                <select
                  id="council-session-select"
                  value={activeSession?.id || ''}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="min-h-[40px] max-w-full rounded-xl border border-white/10 bg-[#13111d] px-3 py-1.5 text-xs text-[#f5f3fc]"
                >
                  {councilSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.prompt.slice(0, 56)}… ({s.roleOutputs.length} roles)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!activeSession ? (
              <div className="rounded-2xl border border-white/10 bg-[#13111d] p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-[#f5f3fc]">No Council Deliberations Yet</p>
                <p className="mx-auto max-w-md text-xs leading-relaxed text-[#958ea8]">
                  Submit a decision brief on the left to inspect each specialist’s independent
                  mandate output alongside a synthesized matrix of agreements, disagreements, and
                  unresolved questions.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-5">
                <div className="border-b border-white/8 pb-4 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] tabular-nums text-[#958ea8]">
                    <span>Session {activeSession.id}</span>
                    <span>
                      Calls: {activeSession.callBudgetUsed}/{activeSession.maxCallBudget} ·{' '}
                      {activeSession.durationMs} ms
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#f6f4fc]">{activeSession.prompt}</h2>
                </div>

                {/* Synthesis Grid */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-[#e4dff2]">Council Synthesis</h3>

                  <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 text-xs space-y-1">
                    <p className="font-semibold text-[#c5b3fc]">Recommended Next Action</p>
                    <p className="leading-relaxed text-[#f1eef9]">
                      {activeSession.synthesis.recommendedAction}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                    <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 space-y-1.5">
                      <p className="font-semibold text-emerald-300">Agreements</p>
                      <ul className="space-y-1 text-[#cfc8e2]">
                        {activeSession.synthesis.agreements.map((item, i) => (
                          <li key={i}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 space-y-1.5">
                      <p className="font-semibold text-amber-300">Disagreements &amp; Tensions</p>
                      <ul className="space-y-1 text-[#cfc8e2]">
                        {activeSession.synthesis.disagreements.map((item, i) => (
                          <li key={i}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 space-y-1.5">
                      <p className="font-semibold text-[#b8d8f8]">Evidence Cited</p>
                      <ul className="space-y-1 text-[#cfc8e2]">
                        {activeSession.synthesis.evidenceSummary.map((item, i) => (
                          <li key={i}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 space-y-1.5">
                      <p className="font-semibold text-rose-200">Unresolved Questions</p>
                      <ul className="space-y-1 text-[#cfc8e2]">
                        {activeSession.synthesis.unresolvedQuestions.map((item, i) => (
                          <li key={i}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Individual Specialist Role Output Inspector */}
                <div className="space-y-3 border-t border-white/8 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-[#e4dff2]">
                      Inspect Individual Role Outputs
                    </h3>
                    <div className="flex flex-wrap gap-1 rounded-xl border border-white/8 bg-[#0e0c16] p-1">
                      {activeSession.roleOutputs.map((ro) => (
                        <button
                          key={ro.roleId}
                          type="button"
                          onClick={() => setActiveRoleTab(ro.roleId)}
                          className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                            inspectedRoleOutput?.roleId === ro.roleId
                              ? 'bg-[#251e3d] text-[#f5f3fc]'
                              : 'text-[#958ea8] hover:text-white'
                          }`}
                        >
                          {ro.roleTitle}
                        </button>
                      ))}
                    </div>
                  </div>

                  {inspectedRoleOutput && (
                    <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-4 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-2.5">
                        <div>
                          <p className="text-sm font-semibold text-[#f5f3fc]">
                            {inspectedRoleOutput.roleTitle}
                          </p>
                          <p className="text-[11px] text-[#958ea8]">
                            Mandate: {inspectedRoleOutput.mandate}
                          </p>
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-[#c5b3fc]">
                          {inspectedRoleOutput.modelUsed} · {inspectedRoleOutput.durationMs} ms
                        </span>
                      </div>

                      <p className="leading-relaxed text-[#e4dff2] whitespace-pre-wrap">
                        {inspectedRoleOutput.analysis}
                      </p>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <p className="font-semibold text-[#cfc8e2] mb-1">Key Points</p>
                          <ul className="space-y-1 text-[#a8a1bd]">
                            {inspectedRoleOutput.keyPoints.map((kp, idx) => (
                              <li key={idx}>• {kp}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-[#cfc8e2] mb-1">Risks &amp; Critiques</p>
                          <ul className="space-y-1 text-[#a8a1bd]">
                            {inspectedRoleOutput.risksOrCritiques.map((rk, idx) => (
                              <li key={idx}>• {rk}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="border-t border-white/6 pt-2 text-[#cfc8e2]">
                        <strong className="text-[#f5f3fc]">Role Recommendation:</strong>{' '}
                        {inspectedRoleOutput.recommendation}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sentinel Verification */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3 text-xs text-[#a8a1bd]">
                  <span className="inline-flex items-center gap-1.5">
                    {activeSession.sentinelReview.approved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                    )}
                    <span>
                      Sentinel:{' '}
                      {activeSession.sentinelReview.verificationLabel ||
                        activeSession.sentinelReview.status}{' '}
                      — {activeSession.sentinelReview.summary}
                    </span>
                  </span>
                  <ShieldCheck className="h-4 w-4 text-[#a58ff8]" />
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
