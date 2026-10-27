import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Download,
  FilePlus2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  formatPassportAsPlainText,
  type RiskBand,
  type SafeguardCategory,
  type SafeguardStatus,
  type TestOutcomeStatus,
} from '../../shared/trustgridEngine';
import { useTrustGrid } from '../../context/TrustGridContext';
import { TrustGridShell } from '../../components/TrustGridShell';
import {
  PassportDocumentView,
  riskBandTextColor,
  triggerFileDownload,
} from '../../components/PassportDocumentView';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

export const TrustGridDashboardView: React.FC = () => {
  useDocumentMeta({
    title: 'Governance Dashboard — AURENYX TRUSTGRID',
    description:
      'Overview of saved AI workflows, risk bands, test scenario completion, open findings, and recently updated AI Workflow Passports.',
  });

  const { state, resetToEmptyWorkspace, restoreSampleDemoData } = useTrustGrid();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Latest assessment per workflow
  const latestAssessments = useMemo(() => {
    const map = new Map<string, (typeof state.assessments)[number]>();
    for (const asmt of state.assessments) {
      if (!map.has(asmt.workflowId)) {
        map.set(asmt.workflowId, asmt);
      }
    }
    return Array.from(map.values());
  }, [state.assessments]);

  const countsByBand = useMemo(() => {
    const counts: Record<RiskBand, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
    for (const a of latestAssessments) {
      counts[a.riskBand] += 1;
    }
    return counts;
  }, [latestAssessments]);

  const needingReviewCount = useMemo(
    () =>
      latestAssessments.filter(
        (a) => a.criticalReviewFlags.length > 0 || a.riskBand === 'High' || a.riskBand === 'Critical'
      ).length,
    [latestAssessments]
  );

  const openFindings = useMemo(
    () => state.findings.filter((f) => f.status !== 'resolved'),
    [state.findings]
  );

  const completedTestsCount = useMemo(
    () => state.testResults.filter((t) => t.status !== 'not-run').length,
    [state.testResults]
  );

  return (
    <TrustGridShell currentPageLabel="Dashboard">
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
              AI Workflow Governance Dashboard
            </h1>
            <p className="text-xs text-[#AEBFD4]">
              Reflects actual records saved in your local workspace—never fabricated telemetry.
              {state.workflows.some((w) => w.isSampleDemo) &&
                ' Includes 1 clearly labeled fictional sample record.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/assessment"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-4 py-2 text-xs font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Assessment</span>
            </Link>
            <Link
              to="/testing"
              className="inline-flex min-h-[40px] items-center rounded-xl border border-white/15 bg-[#0B1B30] px-3.5 py-2 text-xs font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
            >
              Test Library
            </Link>
            <Link
              to="/reports"
              className="inline-flex min-h-[40px] items-center rounded-xl border border-white/15 bg-[#0B1B30] px-3.5 py-2 text-xs font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
            >
              All Reports
            </Link>
          </div>
        </div>

        {/* Metrics Summary */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-5 text-xs">
          <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-4">
            <p className="text-[#AEBFD4]">Saved Workflows</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#F3F7FF]">
              {state.workflows.length}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-4">
            <p className="text-[#AEBFD4]">Needing Priority Review</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#FFD37A]">
              {needingReviewCount}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-4">
            <p className="text-[#AEBFD4]">Tests Recorded</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#35C8FF]">
              {completedTestsCount} / {state.testResults.length}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-4">
            <p className="text-[#AEBFD4]">Open Findings</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#FF7B8B]">
              {openFindings.length}
            </p>
          </div>
          <div className="col-span-2 lg:col-span-1 rounded-2xl border border-white/10 bg-[#0B1B30] p-4">
            <p className="text-[#AEBFD4]">By Risk Band</p>
            <p className="mt-1.5 font-mono text-xs text-[#F3F7FF]">
              L:{countsByBand.Low} · M:{countsByBand.Moderate} · H:{countsByBand.High} · C:
              {countsByBand.Critical}
            </p>
          </div>
        </section>

        {/* Empty Onboarding State vs Active Records */}
        {state.workflows.length === 0 ? (
          <section className="rounded-2xl border border-white/12 bg-[#0B1B30] p-8 text-center space-y-4">
            <h2 className="text-lg font-bold text-[#F3F7FF]">
              No Workflows Saved in Local Workspace (0 Records)
            </h2>
            <p className="mx-auto max-w-lg text-xs leading-relaxed text-[#AEBFD4]">
              Start a guided 15-question assessment for one of your AI workflows, or load the
              fictional sample workflow to explore Passports, staging test checklists, and exports.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/assessment"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-5 py-2 text-xs font-semibold text-[#F3F7FF]"
              >
                <span>Create First Workflow Assessment</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={restoreSampleDemoData}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#06101F] px-4 py-2 text-xs font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
              >
                Load Fictional Sample Record
              </button>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Recently Updated Passports */}
            <section className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#F3F7FF]">Recently Updated Passports</h2>
                <Link to="/reports" className="text-xs font-medium text-[#35C8FF] hover:underline">
                  View all →
                </Link>
              </div>
              <div className="space-y-3 text-xs">
                {state.passports.slice(0, 5).map((pp) => (
                  <div
                    key={pp.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#06101F] p-4"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold text-[#F3F7FF]">{pp.snapshot.workflowName}</p>
                      <p className="text-[#AEBFD4]">
                        <span className="font-mono text-[#35C8FF]">{pp.passportCode}</span> · v
                        {pp.version} · {pp.snapshot.methodologyVersion}
                        {pp.isSampleDemo ? ' · Demo Sample' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono font-bold ${riskBandTextColor(
                          pp.snapshot.riskClassification
                        )}`}
                      >
                        {pp.snapshot.riskScore} pts ({pp.snapshot.riskClassification})
                      </span>
                      <Link
                        to={`/passport?id=${pp.id}`}
                        className="rounded-lg border border-white/15 px-3 py-1.5 font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Open Findings */}
            <section className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-4">
              <h2 className="text-base font-bold text-[#F3F7FF]">Open Findings & Remediation</h2>
              {openFindings.length === 0 ? (
                <p className="text-xs text-[#AEBFD4]">No unresolved findings open.</p>
              ) : (
                <ul className="space-y-2.5 text-xs">
                  {openFindings.slice(0, 5).map((f) => (
                    <li
                      key={f.id}
                      className="rounded-xl border border-white/10 bg-[#06101F] p-3.5 space-y-1"
                    >
                      <p className="font-medium text-[#F3F7FF]">{f.description}</p>
                      <p className="text-[#AEBFD4]">
                        Severity: <span className="font-mono uppercase">{f.severity}</span> · Owner:{' '}
                        {f.owner} · Due: {f.dueDate}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-white/10 pt-3 flex items-center justify-between text-xs">
                <span className="text-[#AEBFD4]">Want to test empty 0-record state?</span>
                {!confirmClearOpen ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearOpen(true)}
                    className="text-[#FF7B8B] hover:underline"
                  >
                    Clear Workspace…
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetToEmptyWorkspace();
                        setConfirmClearOpen(false);
                      }}
                      className="rounded bg-[#FF7B8B] px-2.5 py-1 font-semibold text-[#06101F]"
                    >
                      Confirm Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearOpen(false)}
                      className="text-[#AEBFD4]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </TrustGridShell>
  );
};

export const TrustGridPassportView: React.FC = () => {
  useDocumentMeta({
    title: 'AI Workflow Passport — AURENYX TRUSTGRID',
    description:
      'Review and export a structured AI Workflow Passport containing scope, provisional risk breakdown, test outcomes, safeguards, and open findings.',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const { state, restoreSampleDemoData, mintUpdatedPassportSnapshot } = useTrustGrid();
  const selectedId = searchParams.get('id');

  const activePassport = useMemo(() => {
    if (selectedId) {
      const found = state.passports.find((p) => p.id === selectedId);
      if (found) return found;
    }
    return state.passports[0] ?? null;
  }, [selectedId, state.passports]);

  const versionsForWorkflow = useMemo(() => {
    if (!activePassport) return [];
    return state.passports
      .filter((p) => p.workflowId === activePassport.workflowId)
      .sort((a, b) => b.version - a.version);
  }, [activePassport, state.passports]);

  const handleGenerateSample = () => {
    if (state.passports.length === 0) {
      restoreSampleDemoData();
      return;
    }
    if (activePassport) {
      const minted = mintUpdatedPassportSnapshot(activePassport.workflowId);
      if (minted) {
        setSearchParams({ id: minted.id });
      }
    }
  };

  return (
    <TrustGridShell currentPageLabel="AI Workflow Passport">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div className="space-y-1.5 max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
              AI Workflow Passport
            </h1>
            <p className="text-xs leading-relaxed text-[#AEBFD4]">
              A structured internal review summary capturing workflow purpose, connected systems,
              provisional risk breakdown, self-reported test checks, recommended safeguards, and
              named remediation owners. Not an external safety certification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateSample}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-4 py-2 text-xs font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>
                {state.passports.length === 0
                  ? 'Generate Sample Passport'
                  : 'Mint Updated Snapshot Version'}
              </span>
            </button>
            <Link
              to="/assessment"
              className="inline-flex min-h-[40px] items-center rounded-xl border border-white/15 bg-[#0B1B30] px-4 py-2 text-xs font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
            >
              Assess New Workflow
            </Link>
          </div>
        </div>

        {state.passports.length > 1 && activePassport && (
          <div className="print:hidden flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor="select-passport-wf" className="text-[#AEBFD4]">
              Saved Passports:
            </label>
            <select
              id="select-passport-wf"
              value={activePassport.id}
              onChange={(e) => setSearchParams({ id: e.target.value })}
              className="rounded-lg border border-white/15 bg-[#0B1B30] px-3 py-2 text-[#F3F7FF]"
            >
              {state.passports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.passportCode} · v{p.version} — {p.snapshot.workflowName}
                </option>
              ))}
            </select>
          </div>
        )}

        {activePassport ? (
          <PassportDocumentView
            passport={activePassport}
            allVersionsForWorkflow={versionsForWorkflow}
            onSelectVersion={(id) => setSearchParams({ id })}
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-8 text-center space-y-4">
            <p className="text-sm font-semibold text-[#F3F7FF]">
              No AI Workflow Passports saved yet.
            </p>
            <button
              type="button"
              onClick={restoreSampleDemoData}
              className="inline-flex min-h-[42px] items-center rounded-xl bg-[#1685FF] px-5 py-2 text-xs font-semibold text-[#F3F7FF]"
            >
              Generate Sample Passport
            </button>
          </div>
        )}
      </div>
    </TrustGridShell>
  );
};

export const TrustGridTestingView: React.FC = () => {
  useDocumentMeta({
    title: 'Safety Test Scenario Library — AURENYX TRUSTGRID',
    description:
      'Record authorized staging test outcomes across eight initial AI safety scenarios or add custom test scenarios for your workflow.',
  });

  const [searchParams] = useSearchParams();
  const { state, recordTestOutcome, addCustomScenario, mintUpdatedPassportSnapshot } =
    useTrustGrid();

  const [selectedWfId, setSelectedWfId] = useState<string>(
    () => searchParams.get('workflow') || state.workflows[0]?.id || ''
  );
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<TestOutcomeStatus>('pass');
  const [actualDraft, setActualDraft] = useState('');
  const [evidenceDraft, setEvidenceDraft] = useState('');
  const [testerDraft, setTesterDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [findingDraft, setFindingDraft] = useState('');

  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customObjective, setCustomObjective] = useState('');
  const [customPre, setCustomPre] = useState('');
  const [customSetup, setCustomSetup] = useState('');
  const [customExpected, setCustomExpected] = useState('');
  const [customErr, setCustomErr] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const openEditorForScenario = (scenarioId: string) => {
    const existing = state.testResults.find(
      (tr) => tr.workflowId === selectedWfId && tr.scenarioId === scenarioId
    );
    setEditingScenarioId(scenarioId);
    setStatusDraft(existing?.status === 'not-run' || !existing ? 'pass' : existing.status);
    setActualDraft(existing?.actualResult ?? '');
    setEvidenceDraft(existing?.evidenceReference ?? '');
    setTesterDraft(existing?.tester ?? '');
    setNotesDraft(existing?.notes ?? '');
    setFindingDraft(existing?.followUpFinding ?? '');
  };

  const handleSaveResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWfId || !editingScenarioId) return;
    recordTestOutcome({
      workflowId: selectedWfId,
      scenarioId: editingScenarioId,
      status: statusDraft,
      actualResult: actualDraft,
      evidenceReference: evidenceDraft,
      tester: testerDraft || 'Workspace Reviewer',
      testedAt: new Date().toISOString().slice(0, 10),
      notes: notesDraft,
      followUpFinding: findingDraft,
    });
    mintUpdatedPassportSnapshot(selectedWfId, testerDraft || undefined);
    setEditingScenarioId(null);
    setSavedBanner('Test outcome recorded and a new Passport snapshot version was saved.');
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const handleCreateCustomScenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTitle.trim().length < 3 || customObjective.trim().length < 5 || customExpected.trim().length < 5) {
      setCustomErr('Provide scenario title, objective, and expected behavior.');
      return;
    }
    setCustomErr(null);
    addCustomScenario({
      title: customTitle,
      objective: customObjective,
      preconditions: customPre || 'Authorized non-production test environment.',
      setupGuidance: customSetup || 'Execute scenario manually with synthetic test inputs.',
      expectedBehavior: customExpected,
    });
    setCustomTitle('');
    setCustomObjective('');
    setCustomPre('');
    setCustomSetup('');
    setCustomExpected('');
    setShowAddCustom(false);
  };

  return (
    <TrustGridShell currentPageLabel="Testing">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
              Practical Safety Test Scenario Library
            </h1>
            <p className="text-xs leading-relaxed text-[#AEBFD4]">
              Authorized environments only: TrustGrid never executes automated security attacks
              against external systems. Record outcomes your team has genuinely run in a staging
              sandbox. Marking a check as <span className="font-mono text-[#F3F7FF]">PASS</span>{' '}
              records your self-reported check and does not imply independent verification.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddCustom((v) => !v)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-4 py-2 text-xs font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
          >
            <FilePlus2 className="h-4 w-4" />
            <span>Add Custom Scenario</span>
          </button>
        </div>

        {/* Target Workflow Selector */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0B1B30] p-4 text-xs">
          <label htmlFor="testing-wf-select" className="font-medium text-[#F3F7FF]">
            Recording outcomes for workflow:
          </label>
          {state.workflows.length === 0 ? (
            <span className="text-[#FFD37A]">
              No saved workflows yet.{' '}
              <Link to="/assessment" className="underline">
                Create an assessment first
              </Link>{' '}
              to attach test records.
            </span>
          ) : (
            <select
              id="testing-wf-select"
              value={selectedWfId}
              onChange={(e) => setSelectedWfId(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
            >
              {state.workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {savedBanner && (
          <p role="status" className="text-xs text-[#42D6A4]">
            {savedBanner}
          </p>
        )}

        {/* Add Custom Scenario Form */}
        {showAddCustom && (
          <form
            onSubmit={handleCreateCustomScenario}
            className="rounded-2xl border border-[#35C8FF]/40 bg-[#0B1B30] p-6 space-y-4 text-xs"
          >
            <h2 className="text-base font-bold text-[#F3F7FF]">Create Custom Test Scenario</h2>
            {customErr && <p className="text-[#FF7B8B]">{customErr}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Scenario Title *</span>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Multi-language refund policy boundary check"
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Preconditions</span>
                <input
                  type="text"
                  value={customPre}
                  onChange={(e) => setCustomPre(e.target.value)}
                  placeholder="Staging sandbox with synthetic test data"
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-[#AEBFD4]">Objective *</span>
              <input
                type="text"
                value={customObjective}
                onChange={(e) => setCustomObjective(e.target.value)}
                placeholder="What specific risk or boundary does this scenario check?"
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Setup / Input Guidance</span>
                <textarea
                  rows={2}
                  value={customSetup}
                  onChange={(e) => setCustomSetup(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Expected Safe Behavior *</span>
                <textarea
                  rows={2}
                  value={customExpected}
                  onChange={(e) => setCustomExpected(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-[#1685FF] px-4 py-2 font-semibold text-[#F3F7FF]"
              >
                Save Scenario
              </button>
              <button
                type="button"
                onClick={() => setShowAddCustom(false)}
                className="rounded-lg border border-white/15 px-4 py-2 text-[#AEBFD4]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Scenarios List */}
        <div className="space-y-4">
          {state.scenarios.map((scn) => {
            const wfResult = state.testResults.find(
              (tr) => tr.workflowId === selectedWfId && tr.scenarioId === scn.id
            );
            const st = wfResult?.status ?? 'not-run';
            const isEditing = editingScenarioId === scn.id;

            return (
              <section
                key={scn.id}
                className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 sm:p-6 space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[#35C8FF]">
                      {scn.code} {scn.isCustom ? '· Custom Scenario' : '· Core Library'}
                    </p>
                    <h2 className="text-base font-bold text-[#F3F7FF]">{scn.title}</h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono uppercase font-semibold ${
                        st === 'pass'
                          ? 'text-[#42D6A4]'
                          : st === 'fail'
                            ? 'text-[#FF7B8B]'
                            : st === 'blocked'
                              ? 'text-[#FFD37A]'
                              : 'text-[#AEBFD4]'
                      }`}
                    >
                      Status: {st}
                    </span>
                    {selectedWfId && (
                      <button
                        type="button"
                        onClick={() =>
                          isEditing ? setEditingScenarioId(null) : openEditorForScenario(scn.id)
                        }
                        className="min-h-[36px] rounded-lg border border-white/15 bg-[#06101F] px-3 py-1.5 font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
                      >
                        {isEditing ? 'Close' : 'Record Outcome'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-[#AEBFD4] md:grid-cols-3">
                  <div>
                    <strong className="text-[#F3F7FF]">Objective:</strong> {scn.objective}
                  </div>
                  <div>
                    <strong className="text-[#F3F7FF]">Setup Guidance:</strong> {scn.setupGuidance}
                  </div>
                  <div>
                    <strong className="text-[#F3F7FF]">Expected Behavior:</strong>{' '}
                    {scn.expectedBehavior}
                  </div>
                </div>

                {wfResult && wfResult.status !== 'not-run' && !isEditing && (
                  <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5 text-[#AEBFD4] space-y-1">
                    <p>
                      <strong className="text-[#F3F7FF]">Recorded Outcome:</strong>{' '}
                      {wfResult.actualResult || 'No detail entered'}
                    </p>
                    <p>
                      <strong className="text-[#F3F7FF]">Evidence:</strong>{' '}
                      {wfResult.evidenceReference || 'None'} ·{' '}
                      <strong className="text-[#F3F7FF]">Tester:</strong> {wfResult.tester} (
                      {wfResult.testedAt})
                    </p>
                  </div>
                )}

                {isEditing && (
                  <form
                    onSubmit={handleSaveResult}
                    className="rounded-xl border border-[#1685FF]/35 bg-[#06101F] p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-[#AEBFD4]">Test Status</span>
                        <select
                          value={statusDraft}
                          onChange={(e) => setStatusDraft(e.target.value as TestOutcomeStatus)}
                          className="w-full rounded-lg border border-white/15 bg-[#0B1B30] px-2.5 py-2 text-[#F3F7FF]"
                        >
                          <option value="pass">Pass (Self-Reported)</option>
                          <option value="fail">Fail</option>
                          <option value="blocked">Blocked</option>
                          <option value="not-run">Not Run</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-[#AEBFD4]">Tester Name</span>
                        <input
                          type="text"
                          value={testerDraft}
                          onChange={(e) => setTesterDraft(e.target.value)}
                          placeholder="e.g., QA Reviewer"
                          className="w-full rounded-lg border border-white/15 bg-[#0B1B30] px-2.5 py-2 text-[#F3F7FF]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[#AEBFD4]">Evidence Reference</span>
                        <input
                          type="text"
                          value={evidenceDraft}
                          onChange={(e) => setEvidenceDraft(e.target.value)}
                          placeholder="e.g., Staging log #402"
                          className="w-full rounded-lg border border-white/15 bg-[#0B1B30] px-2.5 py-2 text-[#F3F7FF]"
                        />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[#AEBFD4]">Actual Outcome Observed</span>
                      <textarea
                        rows={2}
                        value={actualDraft}
                        onChange={(e) => setActualDraft(e.target.value)}
                        placeholder="Describe what actually happened during your authorized staging run."
                        className="w-full rounded-lg border border-white/15 bg-[#0B1B30] px-2.5 py-2 text-[#F3F7FF]"
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-[#AEBFD4]">Notes</span>
                        <input
                          type="text"
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          className="w-full rounded-lg border border-white/15 bg-[#0B1B30] px-2.5 py-2 text-[#F3F7FF]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[#AEBFD4]">Follow-Up Finding (Optional — adds to Findings)</span>
                        <input
                          type="text"
                          value={findingDraft}
                          onChange={(e) => setFindingDraft(e.target.value)}
                          placeholder="e.g., Add HTML sanitizer before prompt template"
                          className="w-full rounded-lg border border-white/15 bg-[#0B1B30] px-2.5 py-2 text-[#F3F7FF]"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="min-h-[38px] rounded-lg bg-[#1685FF] px-4 py-1.5 font-semibold text-[#F3F7FF]"
                    >
                      Save Test Outcome
                    </button>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </TrustGridShell>
  );
};

export const TrustGridSafeguardsView: React.FC = () => {
  useDocumentMeta({
    title: 'Safeguard Library & Controls — AURENYX TRUSTGRID',
    description:
      'Review and track twelve categorized AI workflow safeguards with owners, implementation status, evidence references, and review dates.',
  });

  const [searchParams] = useSearchParams();
  const { state, updateSafeguard } = useTrustGrid();
  const [selectedWfId, setSelectedWfId] = useState<string>(
    () => searchParams.get('workflow') || state.workflows[0]?.id || ''
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const activeItems = useMemo(() => {
    const wfItems = selectedWfId
      ? state.safeguards.filter((s) => s.workflowId === selectedWfId)
      : state.safeguards;
    const base = wfItems.length > 0 ? wfItems : state.safeguards;
    if (categoryFilter === 'All') return base;
    return base.filter((s) => s.category === categoryFilter);
  }, [state.safeguards, selectedWfId, categoryFilter]);

  const categories: ('All' | SafeguardCategory)[] = [
    'All',
    'Access control',
    'Least privilege',
    'Human approval',
    'Data minimization',
    'Logging and monitoring',
    'Prompt-injection defenses',
    'Output validation',
    'Rate limits',
    'Failure handling',
    'Rollback and recovery',
    'Incident response',
    'Periodic reassessment',
  ];

  return (
    <TrustGridShell currentPageLabel="Safeguards">
      <div className="space-y-6">
        <div className="space-y-1.5 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
            Categorized Safeguard Library
          </h1>
          <p className="text-xs leading-relaxed text-[#AEBFD4]">
            Safeguards listed below are practical recommendations to help reduce risk—never
            automatic declarations that a workflow is safe.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0B1B30] p-4 text-xs">
          <div className="flex items-center gap-2">
            <label htmlFor="sg-wf-select" className="text-[#AEBFD4]">
              Workflow:
            </label>
            <select
              id="sg-wf-select"
              value={selectedWfId}
              onChange={(e) => setSelectedWfId(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#06101F] px-3 py-1.5 text-[#F3F7FF]"
            >
              {state.workflows.length === 0 && <option value="">Reference Catalog</option>}
              {state.workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sg-cat-select" className="text-[#AEBFD4]">
              Category:
            </label>
            <select
              id="sg-cat-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#06101F] px-3 py-1.5 text-[#F3F7FF]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {activeItems.map((sg) => (
            <section
              key={sg.id}
              className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-3 text-xs"
            >
              <div>
                <p className="font-mono text-[11px] text-[#35C8FF]">{sg.category}</p>
                <h2 className="text-base font-bold text-[#F3F7FF]">{sg.title}</h2>
              </div>
              <p className="text-[#AEBFD4] leading-relaxed">{sg.description}</p>
              <p className="text-[#AEBFD4]">
                <strong className="text-[#F3F7FF]">Risk Addressed:</strong> {sg.riskAddressed}
              </p>
              <p className="text-[#AEBFD4]">
                <strong className="text-[#F3F7FF]">Suggested Implementation:</strong>{' '}
                {sg.suggestedImplementation}
              </p>

              <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <label className="space-y-1">
                  <span className="text-[#AEBFD4]">Status</span>
                  <select
                    aria-label={`Status for ${sg.title}`}
                    value={sg.status}
                    onChange={(e) =>
                      updateSafeguard(sg.id, { status: e.target.value as SafeguardStatus })
                    }
                    className="w-full rounded border border-white/15 bg-[#06101F] px-2 py-1.5 text-[#F3F7FF]"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="implemented">Implemented</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[#AEBFD4]">Owner</span>
                  <input
                    type="text"
                    aria-label={`Owner for ${sg.title}`}
                    value={sg.owner}
                    onChange={(e) => updateSafeguard(sg.id, { owner: e.target.value })}
                    placeholder="Assign owner"
                    className="w-full rounded border border-white/15 bg-[#06101F] px-2 py-1.5 text-[#F3F7FF]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[#AEBFD4]">Evidence Ref</span>
                  <input
                    type="text"
                    aria-label={`Evidence for ${sg.title}`}
                    value={sg.evidence}
                    onChange={(e) => updateSafeguard(sg.id, { evidence: e.target.value })}
                    placeholder="PR / Config ID"
                    className="w-full rounded border border-white/15 bg-[#06101F] px-2 py-1.5 text-[#F3F7FF]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[#AEBFD4]">Review Date</span>
                  <input
                    type="date"
                    aria-label={`Review date for ${sg.title}`}
                    value={sg.reviewDate}
                    onChange={(e) => updateSafeguard(sg.id, { reviewDate: e.target.value })}
                    className="w-full rounded border border-white/15 bg-[#06101F] px-2 py-1.5 text-[#F3F7FF]"
                  />
                </label>
              </div>
            </section>
          ))}
        </div>
      </div>
    </TrustGridShell>
  );
};

export const TrustGridReportsView: React.FC = () => {
  useDocumentMeta({
    title: 'Saved AI Workflow Passports & Backups — AURENYX TRUSTGRID',
    description:
      'Search, filter, export, duplicate, delete, and back up saved AI Workflow Passports in AURENYX TRUSTGRID.',
  });

  const navigate = useNavigate();
  const {
    state,
    duplicateWorkflow,
    deleteWorkflow,
    exportBackupJson,
    importBackupJson,
    restoreSampleDemoData,
  } = useTrustGrid();

  const [query, setQuery] = useState('');
  const [bandFilter, setBandFilter] = useState<'All' | RiskBand>('All');
  const [recordKindFilter, setRecordKindFilter] = useState<'all' | 'user' | 'demo'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'score'>('updated');
  const [confirmDeleteWfId, setConfirmDeleteWfId] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Show latest Passport per workflow on main dashboard list
  const latestPassports = useMemo(() => {
    const map = new Map<string, (typeof state.passports)[number]>();
    for (const pp of state.passports) {
      const prev = map.get(pp.workflowId);
      if (!prev || pp.version > prev.version) {
        map.set(pp.workflowId, pp);
      }
    }
    return Array.from(map.values());
  }, [state.passports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return latestPassports
      .filter((pp) => {
        if (bandFilter !== 'All' && pp.snapshot.riskClassification !== bandFilter) return false;
        if (recordKindFilter === 'demo' && !pp.isSampleDemo) return false;
        if (recordKindFilter === 'user' && pp.isSampleDemo) return false;
        if (!q) return true;
        return (
          pp.snapshot.workflowName.toLowerCase().includes(q) ||
          pp.passportCode.toLowerCase().includes(q) ||
          pp.snapshot.organizationName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'score') return b.snapshot.riskScore - a.snapshot.riskScore;
        if (sortBy === 'created') return b.createdAt.localeCompare(a.createdAt);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [latestPassports, query, bandFilter, recordKindFilter, sortBy]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const res = importBackupJson(raw);
    setImportFeedback({
      ok: res.ok,
      msg: res.ok ? 'Workspace JSON backup imported successfully.' : res.error || 'Import failed.',
    });
    e.target.value = '';
  };

  return (
    <TrustGridShell currentPageLabel="Reports">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
              Saved AI Workflow Passports
            </h1>
            <p className="text-xs text-[#AEBFD4]">
              Search, filter, duplicate, export, or back up your saved Passports. Local browser
              storage can be cleared by browser settings—use Export Backup JSON to keep a file copy.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() =>
                triggerFileDownload(
                  `trustgrid-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  exportBackupJson(),
                  'application/json'
                )
              }
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#0B1B30] px-3.5 py-2 font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
            >
              <Download className="h-3.5 w-3.5 text-[#35C8FF]" />
              <span>Export Backup JSON</span>
            </button>

            <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-[#0B1B30] px-3.5 py-2 font-medium text-[#F3F7FF] hover:border-[#35C8FF]">
              <Upload className="h-3.5 w-3.5 text-[#35C8FF]" />
              <span>Import Backup JSON</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => void handleImportFile(e)}
                className="sr-only"
              />
            </label>

            <Link
              to="/assessment"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-4 py-2 font-semibold text-[#F3F7FF]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Assessment</span>
            </Link>
          </div>
        </div>

        {importFeedback && (
          <p
            role="status"
            className={`text-xs ${importFeedback.ok ? 'text-[#42D6A4]' : 'text-[#FF7B8B]'}`}
          >
            {importFeedback.msg}
          </p>
        )}

        {/* Search, Filter & Sort Controls */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-[#0B1B30] p-4 sm:grid-cols-4 text-xs">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#AEBFD4]" />
            <input
              type="search"
              aria-label="Search saved Passports"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ID, team…"
              className="w-full rounded-lg border border-white/15 bg-[#06101F] py-2 pl-8 pr-3 text-[#F3F7FF]"
            />
          </div>

          <select
            aria-label="Filter by risk band"
            value={bandFilter}
            onChange={(e) => setBandFilter(e.target.value as 'All' | RiskBand)}
            className="rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
          >
            <option value="All">All Risk Bands</option>
            <option value="Low">Low (0–3)</option>
            <option value="Moderate">Moderate (4–6)</option>
            <option value="High">High (7–9)</option>
            <option value="Critical">Critical (10+)</option>
          </select>

          <select
            aria-label="Filter by record status"
            value={recordKindFilter}
            onChange={(e) => setRecordKindFilter(e.target.value as 'all' | 'user' | 'demo')}
            className="rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
          >
            <option value="all">All Records (User + Sample)</option>
            <option value="user">User-Created Records Only</option>
            <option value="demo">Demo Sample Records Only</option>
          </select>

          <select
            aria-label="Sort reports"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'updated' | 'created' | 'score')}
            className="rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
          >
            <option value="updated">Sort: Last Updated</option>
            <option value="created">Sort: Date Created</option>
            <option value="score">Sort: Highest Provisional Score</option>
          </select>
        </div>

        {/* Reports List or Empty State */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-8 text-center space-y-4">
            <p className="text-sm font-semibold text-[#F3F7FF]">
              No matching AI Workflow Passports found.
            </p>
            <p className="text-xs text-[#AEBFD4]">
              Create a new assessment or load the fictional demonstration record.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                to="/assessment"
                className="rounded-xl bg-[#1685FF] px-4 py-2 text-xs font-semibold text-[#F3F7FF]"
              >
                Start Guided Assessment
              </Link>
              {state.passports.length === 0 && (
                <button
                  type="button"
                  onClick={restoreSampleDemoData}
                  className="rounded-xl border border-white/15 bg-[#06101F] px-4 py-2 text-xs text-[#F3F7FF]"
                >
                  Restore Fictional Sample
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((pp) => {
              const wf = state.workflows.find((w) => w.id === pp.workflowId);
              const isConfirmingDelete = confirmDeleteWfId === pp.workflowId;

              return (
                <article
                  key={pp.id}
                  className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-4 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[#AEBFD4]">
                        <span className="font-mono text-[#35C8FF]">{pp.passportCode}</span> · v
                        {pp.version} · Methodology:{' '}
                        <span className="font-mono">{pp.snapshot.methodologyVersion}</span>
                        {pp.isSampleDemo ? ' · DEMO DATA (FICTIONAL)' : ' · User Record'}
                      </p>
                      <h2 className="text-lg font-bold text-[#F3F7FF]">
                        {pp.snapshot.workflowName}
                      </h2>
                      <p className="text-[#AEBFD4]">
                        Organization: {pp.snapshot.organizationName} · Created:{' '}
                        {pp.createdAt.slice(0, 10)} · Updated:{' '}
                        {(wf?.updatedAt || pp.updatedAt).slice(0, 10)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-lg font-bold">
                        {pp.snapshot.riskScore} pts ·{' '}
                        <span className={riskBandTextColor(pp.snapshot.riskClassification)}>
                          {pp.snapshot.riskClassification}
                        </span>
                      </p>
                      {pp.snapshot.criticalReviewFlags.length > 0 && (
                        <p className="inline-flex items-center gap-1 text-[11px] text-[#FF7B8B]">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{pp.snapshot.criticalReviewFlags.length} Review Flag(s)</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/passport?id=${pp.id}`}
                        className="min-h-[36px] inline-flex items-center rounded-lg bg-[#1685FF] px-3.5 py-1.5 font-semibold text-[#F3F7FF]"
                      >
                        View Report
                      </Link>
                      <Link
                        to={`/assessment?edit=${pp.workflowId}`}
                        className="min-h-[36px] inline-flex items-center rounded-lg border border-white/15 bg-[#06101F] px-3 py-1.5 text-[#F3F7FF] hover:border-[#35C8FF]"
                      >
                        Edit Workflow
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          const cloned = duplicateWorkflow(pp.workflowId);
                          if (cloned) {
                            void navigate(`/passport?id=${cloned.id}`);
                          }
                        }}
                        className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-white/15 bg-[#06101F] px-3 py-1.5 text-[#F3F7FF] hover:border-[#35C8FF]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Duplicate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          triggerFileDownload(
                            `${pp.passportCode.toLowerCase()}-v${pp.version}.txt`,
                            formatPassportAsPlainText(pp),
                            'text/plain;charset=utf-8'
                          )
                        }
                        className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-white/15 bg-[#06101F] px-3 py-1.5 text-[#F3F7FF] hover:border-[#35C8FF]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Export TXT</span>
                      </button>
                    </div>

                    {!isConfirmingDelete ? (
                      <button
                        type="button"
                        aria-label={`Delete report ${pp.snapshot.workflowName}`}
                        onClick={() => setConfirmDeleteWfId(pp.workflowId)}
                        className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[#FF7B8B] hover:border-[#FF7B8B]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[#FF7B8B]">Delete workflow & snapshots?</span>
                        <button
                          type="button"
                          onClick={() => {
                            deleteWorkflow(pp.workflowId);
                            setConfirmDeleteWfId(null);
                          }}
                          className="rounded-lg bg-[#FF7B8B] px-3 py-1.5 font-semibold text-[#06101F]"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteWfId(null)}
                          className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[#AEBFD4]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </TrustGridShell>
  );
};
