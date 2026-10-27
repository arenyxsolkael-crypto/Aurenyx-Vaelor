import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  AUTONOMY_LABELS,
  buildPassportSnapshot,
  DATA_SENSITIVITY_LABELS,
  DEFAULT_SAFEGUARD_CATALOG,
  evaluateProvisionalRisk,
  HUMAN_APPROVAL_LABELS,
  IMPACT_LABELS,
  INITIAL_TEST_SCENARIOS,
  LOGGING_LABELS,
  ROLLBACK_LABELS,
  validateAssessmentInput,
  type AssessmentQuestionnaireInput,
  type AutonomyLevel,
  type DataSensitivityLevel,
  type HumanApprovalLevel,
  type ImpactLevel,
  type LoggingLevel,
  type RollbackLevel,
  type TestOutcomeStatus,
  type TrustGridPassport,
} from '../../shared/trustgridEngine';
import { useTrustGrid } from '../../context/TrustGridContext';
import { TrustGridShell } from '../../components/TrustGridShell';
import { PassportDocumentView, riskBandTextColor } from '../../components/PassportDocumentView';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

const EMPTY_FORM: AssessmentQuestionnaireInput = {
  workflowName: '',
  organizationName: '',
  owner: '',
  purpose: '',
  platform: '',
  connectedSystems: '',
  scopeAndLimitations: '',
  dataSensitivity: 'internal',
  dataSensitivityNotes: '',
  autonomyLevel: 'human_reviewed_drafts',
  autonomyNotes: '',
  impactLevel: 'operational',
  externalInput: true,
  externalInputSources: '',
  humanApproval: 'required',
  humanApprovalDetails: '',
  loggingLevel: 'partial',
  rollbackCapability: 'supported',
  rollbackDetails: '',
  existingSafeguards: '',
  unresolvedIssues: '',
  remediationOwner: '',
  remediationDueDate: '',
  reviewerName: '',
};

const FICTIONAL_DEMO_PRESET: AssessmentQuestionnaireInput = {
  workflowName: 'Vendor Invoice Summary & Exception Triage (Fictional Demo)',
  organizationName: 'Harborlight Accounting Studio (Fictional)',
  owner: 'Nadia Gomez, Operations Lead (Fictional)',
  purpose:
    'Extracts line-item totals and due dates from supplier invoices and flags mismatches for a human bookkeeper to approve before accounting entry.',
  platform: 'Server-hosted LLM API (Read/Draft Mode)',
  connectedSystems: 'Accounts Payable Mailbox (read), Accounting Draft Ledger (create draft)',
  scopeAndLimitations:
    'Fictional demonstration record. Cannot initiate bank transfers or modify vendor payout details.',
  dataSensitivity: 'confidential_regulated',
  dataSensitivityNotes: 'Supplier billing records, tax IDs, and internal purchase order references.',
  autonomyLevel: 'limited_automatic',
  autonomyNotes: 'Automatically creates draft ledger entries under $2,500; never releases payment.',
  impactLevel: 'financial_privacy',
  externalInput: true,
  externalInputSources: 'Untrusted PDF/text invoices emailed by external vendors.',
  humanApproval: 'required',
  humanApprovalDetails: 'Bookkeeper must verify invoice match and approve payment batch manually.',
  loggingLevel: 'partial',
  rollbackCapability: 'supported',
  rollbackDetails: 'Draft ledger entries can be batch-voided and mailbox webhook paused in 1 click.',
  existingSafeguards:
    'No payout API credentials granted; vendor bank account edits locked to CFO role.',
  unresolvedIssues:
    'Prompt-injection text hidden inside vendor invoice memo lines has not yet been tested with malformed multi-currency tables.',
  remediationOwner: 'Samir Rao, Automation Engineer (Fictional)',
  remediationDueDate: '2026-05-01',
  reviewerName: 'Nadia Gomez (Fictional Demo)',
};

export const TrustGridAssessmentView: React.FC = () => {
  useDocumentMeta({
    title: 'Guided AI Workflow Risk Assessment — AURENYX TRUSTGRID',
    description:
      'Complete the 15-question guided AI workflow risk assessment, review your provisional score breakdown, and generate an AI Workflow Passport.',
  });

  const [searchParams] = useSearchParams();
  const editWorkflowId = searchParams.get('edit') || undefined;
  const { state, saveWorkflowAssessment } = useTrustGrid();

  const existingAssessment = useMemo(
    () =>
      editWorkflowId
        ? state.assessments.find((a) => a.workflowId === editWorkflowId)
        : undefined,
    [editWorkflowId, state.assessments]
  );

  const [form, setForm] = useState<AssessmentQuestionnaireInput>(
    () => existingAssessment?.answers ?? EMPTY_FORM
  );
  const [step, setStep] = useState<number>(1); // 1..4 questions, 5 = review, 6 = completed summary
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [completedResult, setCompletedResult] = useState<ReturnType<
    typeof saveWorkflowAssessment
  > | null>(null);

  const previewEval = useMemo(() => evaluateProvisionalRisk(form), [form]);

  const validateCurrentStep = (targetStep: number): string[] => {
    const errs: string[] = [];
    if (targetStep === 1) {
      if (form.workflowName.trim().length < 2) {
        errs.push('Question 1: Enter the workflow name (at least 2 characters).');
      }
      if (form.organizationName.trim().length < 2) {
        errs.push('Question 2: Enter the owning organization or team.');
      }
      if (form.owner.trim().length < 2) {
        errs.push('Enter a workflow owner name or role.');
      }
      if (form.purpose.trim().length < 10) {
        errs.push('Question 3: Describe the business purpose (at least 10 characters).');
      }
      if (form.platform.trim().length < 2) {
        errs.push('Question 4: Specify the AI model or platform used.');
      }
      if (form.connectedSystems.trim().length < 2) {
        errs.push('Question 5: List connected systems/tools (or write "None / Standalone").');
      }
    }
    if (targetStep === 4) {
      if (form.remediationOwner.trim().length < 2) {
        errs.push('Question 15: Specify who owns remediation for open issues.');
      }
    }
    return errs;
  };

  const goNext = () => {
    const errs = validateCurrentStep(step);
    if (errs.length > 0) {
      setStepErrors(errs);
      return;
    }
    setStepErrors([]);
    setStep((s) => Math.min(5, s + 1));
  };

  const goBack = () => {
    setStepErrors([]);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmitAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    const fullErrors = validateAssessmentInput(form);
    if (fullErrors.length > 0) {
      setStepErrors(fullErrors);
      return;
    }
    setStepErrors([]);
    const saved = saveWorkflowAssessment(form, {
      existingWorkflowId: editWorkflowId,
      isSampleDemo: false,
    });
    setCompletedResult(saved);
    setStep(6);
  };

  return (
    <TrustGridShell currentPageLabel={editWorkflowId ? 'Update Assessment' : 'Guided Assessment'}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#F3F7FF] sm:text-3xl">
              {editWorkflowId
                ? 'Update AI Workflow Assessment (Preserves Prior Snapshots)'
                : 'Guided 15-Question AI Workflow Assessment'}
            </h1>
            <p className="text-xs text-[#AEBFD4]">
              Do not enter API keys, passwords, or sensitive customer records. Answers are stored
              locally in your browser and scored deterministically.
            </p>
          </div>
          {step < 6 && (
            <button
              type="button"
              onClick={() => {
                setForm(FICTIONAL_DEMO_PRESET);
                setStepErrors([]);
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#0B1B30] px-3 py-1.5 text-xs font-medium text-[#35C8FF] hover:border-[#35C8FF]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Prefill Fictional Example</span>
            </button>
          )}
        </div>

        {/* Step Progress Indicator */}
        {step <= 5 && (
          <div aria-label="Assessment progress" className="grid grid-cols-5 gap-2 text-xs">
            {[
              { num: 1, label: '1. Context (Q1–Q5)' },
              { num: 2, label: '2. Exposure (Q6–Q8)' },
              { num: 3, label: '3. Controls (Q9–Q12)' },
              { num: 4, label: '4. Accountability (Q13–Q15)' },
              { num: 5, label: '5. Review & Save' },
            ].map((item) => (
              <div
                key={item.num}
                className={`rounded-lg border px-2.5 py-2 text-center font-medium ${
                  step === item.num
                    ? 'border-[#35C8FF] bg-[#1685FF]/20 text-[#F3F7FF]'
                    : step > item.num
                      ? 'border-[#42D6A4]/40 bg-[#0B1B30] text-[#42D6A4]'
                      : 'border-white/10 bg-[#0B1B30]/60 text-[#AEBFD4]'
                }`}
              >
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">Step {item.num}</span>
              </div>
            ))}
          </div>
        )}

        {stepErrors.length > 0 && (
          <div
            role="alert"
            className="rounded-xl border border-[#FF7B8B]/40 bg-[#FF7B8B]/10 p-4 text-xs text-[#F3F7FF] space-y-1"
          >
            <p className="font-semibold text-[#FF7B8B]">Please resolve the following before continuing:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {stepErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Step 1: Questions 1–5 */}
        {step === 1 && (
          <section className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-5 text-xs">
            <h2 className="text-base font-bold text-[#F3F7FF]">
              Step 1 of 5 · Workflow Identity, Purpose & Integrations (Questions 1–5)
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="q1-name" className="block font-medium text-[#F3F7FF]">
                  1. What is the workflow name? *
                </label>
                <input
                  id="q1-name"
                  type="text"
                  value={form.workflowName}
                  onChange={(e) => setForm((p) => ({ ...p, workflowName: e.target.value }))}
                  placeholder="e.g., Customer Support Reply Drafter"
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF] placeholder-[#AEBFD4]/55 focus:border-[#35C8FF] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="q2-org" className="block font-medium text-[#F3F7FF]">
                  2. What organization or team owns it? *
                </label>
                <input
                  id="q2-org"
                  type="text"
                  value={form.organizationName}
                  onChange={(e) => setForm((p) => ({ ...p, organizationName: e.target.value }))}
                  placeholder="e.g., Support Operations Team"
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF] placeholder-[#AEBFD4]/55 focus:border-[#35C8FF] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="q2b-owner" className="block font-medium text-[#F3F7FF]">
                  Named Workflow Owner (Person or Role) *
                </label>
                <input
                  id="q2b-owner"
                  type="text"
                  value={form.owner}
                  onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))}
                  placeholder="e.g., Jordan Lee, Support Lead"
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF] placeholder-[#AEBFD4]/55 focus:border-[#35C8FF] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="q4-platform" className="block font-medium text-[#F3F7FF]">
                  4. Which AI model or platform is used? *
                </label>
                <input
                  id="q4-platform"
                  type="text"
                  value={form.platform}
                  onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value }))}
                  placeholder="e.g., Gemini 3.1 Flash-Lite via server API"
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF] placeholder-[#AEBFD4]/55 focus:border-[#35C8FF] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="q3-purpose" className="block font-medium text-[#F3F7FF]">
                3. What is its business purpose? *
              </label>
              <textarea
                id="q3-purpose"
                rows={3}
                value={form.purpose}
                onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                placeholder="Describe what the workflow does, who uses its output, and what decisions depend on it."
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF] placeholder-[#AEBFD4]/55 focus:border-[#35C8FF] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="q5-systems" className="block font-medium text-[#F3F7FF]">
                5. What systems, tools, or integrations can it access? *
              </label>
              <input
                id="q5-systems"
                type="text"
                value={form.connectedSystems}
                onChange={(e) => setForm((p) => ({ ...p, connectedSystems: e.target.value }))}
                placeholder="e.g., Helpdesk API (read), Slack alert webhook (write), or None / Standalone"
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF] placeholder-[#AEBFD4]/55 focus:border-[#35C8FF] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="q5b-scope" className="block font-medium text-[#F3F7FF]">
                Scope & Out-of-Scope Limitations (Optional)
              </label>
              <input
                id="q5b-scope"
                type="text"
                value={form.scopeAndLimitations}
                onChange={(e) => setForm((p) => ({ ...p, scopeAndLimitations: e.target.value }))}
                placeholder="e.g., Internal English support tickets only; never used for legal or medical advice."
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF] placeholder-[#AEBFD4]/55 focus:border-[#35C8FF] focus:outline-none"
              />
            </div>
          </section>
        )}

        {/* Step 2: Questions 6–8 */}
        {step === 2 && (
          <section className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-5 text-xs">
            <h2 className="text-base font-bold text-[#F3F7FF]">
              Step 2 of 5 · Data Sensitivity, Autonomy & Failure Impact (Questions 6–8)
            </h2>

            <div className="space-y-2">
              <label htmlFor="q6-data" className="block font-medium text-[#F3F7FF]">
                6. What type of data does it handle?
              </label>
              <select
                id="q6-data"
                value={form.dataSensitivity}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    dataSensitivity: e.target.value as DataSensitivityLevel,
                  }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              >
                {Object.entries(DATA_SENSITIVITY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              {(form.dataSensitivity === 'personal_sensitive' ||
                form.dataSensitivity === 'confidential_regulated') && (
                <div className="pt-1 space-y-1">
                  <label htmlFor="q6-notes" className="block text-[#35C8FF]">
                    Conditional follow-up: Which sensitive record categories are involved (without entering real examples)?
                  </label>
                  <input
                    id="q6-notes"
                    type="text"
                    value={form.dataSensitivityNotes || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, dataSensitivityNotes: e.target.value }))
                    }
                    placeholder="e.g., Customer billing addresses, support transcripts, tax IDs"
                    className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="q7-autonomy" className="block font-medium text-[#F3F7FF]">
                7. What level of autonomy does it have?
              </label>
              <select
                id="q7-autonomy"
                value={form.autonomyLevel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, autonomyLevel: e.target.value as AutonomyLevel }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              >
                {Object.entries(AUTONOMY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              {(form.autonomyLevel === 'limited_automatic' ||
                form.autonomyLevel === 'consequential_autonomous') && (
                <div className="pt-1 space-y-1">
                  <label htmlFor="q7-notes" className="block text-[#35C8FF]">
                    Conditional follow-up: Which automated actions can trigger without prior human edit?
                  </label>
                  <input
                    id="q7-notes"
                    type="text"
                    value={form.autonomyNotes || ''}
                    onChange={(e) => setForm((p) => ({ ...p, autonomyNotes: e.target.value }))}
                    placeholder="e.g., Updates ticket priority tags and posts internal Slack summaries"
                    className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="q8-impact" className="block font-medium text-[#F3F7FF]">
                8. What is the potential impact of a failure?
              </label>
              <select
                id="q8-impact"
                value={form.impactLevel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, impactLevel: e.target.value as ImpactLevel }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              >
                {Object.entries(IMPACT_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Step 3: Questions 9–12 */}
        {step === 3 && (
          <section className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-5 text-xs">
            <h2 className="text-base font-bold text-[#F3F7FF]">
              Step 3 of 5 · Input Exposure, Approval, Logging & Rollback (Questions 9–12)
            </h2>

            <div className="space-y-2">
              <label htmlFor="q9-external" className="block font-medium text-[#F3F7FF]">
                9. Does it process external or untrusted inputs?
              </label>
              <select
                id="q9-external"
                value={form.externalInput ? 'yes' : 'no'}
                onChange={(e) =>
                  setForm((p) => ({ ...p, externalInput: e.target.value === 'yes' }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              >
                <option value="yes">
                  Yes — Inbound emails, public web forms, external documents, or third-party URLs
                </option>
                <option value="no">No — Trusted internal prompts and curated data only</option>
              </select>
              {form.externalInput && (
                <div className="pt-1 space-y-1">
                  <label htmlFor="q9-sources" className="block text-[#35C8FF]">
                    Conditional follow-up: Describe the untrusted input sources
                  </label>
                  <input
                    id="q9-sources"
                    type="text"
                    value={form.externalInputSources || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, externalInputSources: e.target.value }))
                    }
                    placeholder="e.g., Public web chat widget and customer file uploads"
                    className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="q10-approval" className="block font-medium text-[#F3F7FF]">
                10. Is human approval required for sensitive actions?
              </label>
              <select
                id="q10-approval"
                value={form.humanApproval}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    humanApproval: e.target.value as HumanApprovalLevel,
                  }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              >
                {Object.entries(HUMAN_APPROVAL_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              {form.humanApproval !== 'none' && (
                <div className="pt-1 space-y-1">
                  <label htmlFor="q10-details" className="block text-[#35C8FF]">
                    Conditional follow-up: How is human approval enforced?
                  </label>
                  <input
                    id="q10-details"
                    type="text"
                    value={form.humanApprovalDetails || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, humanApprovalDetails: e.target.value }))
                    }
                    placeholder="e.g., Operator clicks Approve in internal queue before email sends"
                    className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="q11-logging" className="block font-medium text-[#F3F7FF]">
                11. Are relevant events logged and reviewable?
              </label>
              <select
                id="q11-logging"
                value={form.loggingLevel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, loggingLevel: e.target.value as LoggingLevel }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              >
                {Object.entries(LOGGING_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="q12-rollback" className="block font-medium text-[#F3F7FF]">
                12. Can the workflow be stopped or rolled back?
              </label>
              <select
                id="q12-rollback"
                value={form.rollbackCapability}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    rollbackCapability: e.target.value as RollbackLevel,
                  }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              >
                {Object.entries(ROLLBACK_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Step 4: Questions 13–15 */}
        {step === 4 && (
          <section className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-5 text-xs">
            <h2 className="text-base font-bold text-[#F3F7FF]">
              Step 4 of 5 · Existing Safeguards, Known Issues & Remediation Owner (Questions 13–15)
            </h2>

            <div className="space-y-1.5">
              <label htmlFor="q13-safeguards" className="block font-medium text-[#F3F7FF]">
                13. What safeguards are already in place?
              </label>
              <textarea
                id="q13-safeguards"
                rows={3}
                value={form.existingSafeguards}
                onChange={(e) => setForm((p) => ({ ...p, existingSafeguards: e.target.value }))}
                placeholder="e.g., Read-only API scopes, rate limit of 20 requests/min, human review queue."
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="q14-issues" className="block font-medium text-[#F3F7FF]">
                14. What unresolved issues are known?
              </label>
              <textarea
                id="q14-issues"
                rows={3}
                value={form.unresolvedIssues}
                onChange={(e) => setForm((p) => ({ ...p, unresolvedIssues: e.target.value }))}
                placeholder="Document any known edge cases, untested prompt paths, or missing logs honestly."
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="q15-rem-owner" className="block font-medium text-[#F3F7FF]">
                  15. Who owns remediation? *
                </label>
                <input
                  id="q15-rem-owner"
                  type="text"
                  value={form.remediationOwner}
                  onChange={(e) => setForm((p) => ({ ...p, remediationOwner: e.target.value }))}
                  placeholder="e.g., Alex Rivera, Lead Engineer"
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="q15-due" className="block font-medium text-[#F3F7FF]">
                  Target Remediation Date
                </label>
                <input
                  id="q15-due"
                  type="date"
                  value={form.remediationDueDate || ''}
                  onChange={(e) => setForm((p) => ({ ...p, remediationDueDate: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="q15-reviewer" className="block font-medium text-[#F3F7FF]">
                  Reviewer Recording Assessment
                </label>
                <input
                  id="q15-reviewer"
                  type="text"
                  value={form.reviewerName || ''}
                  onChange={(e) => setForm((p) => ({ ...p, reviewerName: e.target.value }))}
                  placeholder="Defaults to Workflow Owner"
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
                />
              </div>
            </div>
          </section>
        )}

        {/* Step 5: Review Screen Before Submission */}
        {step === 5 && (
          <form
            onSubmit={handleSubmitAssessment}
            className="rounded-2xl border border-[#1685FF]/35 bg-[#0B1B30] p-6 space-y-6 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-[#F3F7FF]">
                  Step 5 of 5 · Review Answers & Provisional Score Preview
                </h2>
                <p className="text-[#AEBFD4]">
                  Verify your entries below before saving the workflow record and generating a
                  Passport snapshot.
                </p>
              </div>
              <div className="rounded-xl border border-white/12 bg-[#06101F] px-4 py-2 text-right">
                <p className="text-[11px] text-[#AEBFD4]">Provisional Score Preview</p>
                <p className="font-mono text-lg font-bold">
                  {previewEval.score} pts ·{' '}
                  <span className={riskBandTextColor(previewEval.riskBand)}>
                    {previewEval.riskBand}
                  </span>
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#06101F] p-3">
                <dt className="text-[#AEBFD4]">Workflow & Organization</dt>
                <dd className="mt-0.5 font-medium text-[#F3F7FF]">
                  {form.workflowName} · {form.organizationName}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#06101F] p-3">
                <dt className="text-[#AEBFD4]">Owner & Remediation Lead</dt>
                <dd className="mt-0.5 font-medium text-[#F3F7FF]">
                  {form.owner} / Remediation: {form.remediationOwner}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#06101F] p-3">
                <dt className="text-[#AEBFD4]">Model & Connected Systems</dt>
                <dd className="mt-0.5 font-medium text-[#F3F7FF]">
                  {form.platform} · {form.connectedSystems}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#06101F] p-3">
                <dt className="text-[#AEBFD4]">Exposure Profile</dt>
                <dd className="mt-0.5 font-medium text-[#F3F7FF]">
                  {DATA_SENSITIVITY_LABELS[form.dataSensitivity]} ·{' '}
                  {AUTONOMY_LABELS[form.autonomyLevel]}
                </dd>
              </div>
            </dl>

            {previewEval.criticalReviewFlags.length > 0 && (
              <div className="rounded-xl border border-[#FF7B8B]/35 bg-[#FF7B8B]/10 p-4 space-y-1">
                <p className="font-semibold text-[#FF7B8B]">
                  Critical Review Flags ({previewEval.criticalReviewFlags.length}) will be recorded:
                </p>
                {previewEval.criticalReviewFlags.map((f) => (
                  <p key={f.code} className="text-[#F3F7FF]">
                    · {f.title} ({f.code})
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#06101F] px-4 py-2 font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Edit</span>
              </button>
              <button
                type="submit"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1685FF] px-5 py-2.5 font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Save Assessment & Generate Passport</span>
              </button>
            </div>
          </form>
        )}

        {/* Navigation Buttons for Steps 1..4 */}
        {step >= 1 && step <= 4 && (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={step === 1}
              onClick={goBack}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#0B1B30] px-4 py-2 text-xs font-medium text-[#F3F7FF] disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous Step</span>
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-5 py-2 text-xs font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
            >
              <span>{step === 4 ? 'Review Answers' : 'Next Step'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 6: Post-Submission Results & Next Actions */}
        {step === 6 && completedResult && (
          <div className="space-y-6">
            <div
              role="status"
              className="rounded-2xl border border-[#42D6A4]/40 bg-[#0B1B30] p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-base font-bold text-[#42D6A4]">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Workflow Saved & Passport Snapshot Generated</span>
                </div>
                <span className="font-mono text-xs text-[#35C8FF]">
                  {completedResult.passport.passportCode} · v{completedResult.passport.version}
                </span>
              </div>

              <p className="text-xs text-[#AEBFD4]">
                Provisional Risk Score:{' '}
                <strong className="font-mono text-sm text-[#F3F7FF]">
                  {completedResult.assessment.score} points
                </strong>{' '}
                (
                <span className={riskBandTextColor(completedResult.assessment.riskBand)}>
                  {completedResult.assessment.riskBand}
                </span>
                ) under <code className="font-mono">{completedResult.assessment.methodologyVersion}</code>.
              </p>

              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                <Link
                  to={`/passport?id=${completedResult.passport.id}`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-4 py-2 font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
                >
                  <span>Open Full Passport & Export</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to={`/testing?workflow=${completedResult.workflow.id}`}
                  className="inline-flex min-h-[40px] items-center rounded-xl border border-white/15 bg-[#06101F] px-4 py-2 font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
                >
                  Record Staging Test Scenarios
                </Link>
                <Link
                  to={`/safeguards?workflow=${completedResult.workflow.id}`}
                  className="inline-flex min-h-[40px] items-center rounded-xl border border-white/15 bg-[#06101F] px-4 py-2 font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
                >
                  Track Safeguards
                </Link>
              </div>
            </div>

            <PassportDocumentView passport={completedResult.passport} />
          </div>
        )}
      </div>
    </TrustGridShell>
  );
};

export const TrustGridDemoView: React.FC = () => {
  useDocumentMeta({
    title: 'Interactive Free Governance Demo — AURENYX TRUSTGRID',
    description:
      'Try AURENYX TRUSTGRID interactively with fictional workflow data—no paid AI API key required. Score risks, log test outcomes, and export a Passport.',
  });

  const [demoInput, setDemoInput] = useState<AssessmentQuestionnaireInput>(FICTIONAL_DEMO_PRESET);
  const [scenarioStatuses, setScenarioStatuses] = useState<Record<string, TestOutcomeStatus>>({
    'scn-01': 'fail',
    'scn-02': 'pass',
    'scn-05': 'pass',
    'scn-08': 'pass',
  });
  const [demoTester, setDemoTester] = useState('Demo Operator (Self-Reported)');
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const evaluation = useMemo(() => evaluateProvisionalRisk(demoInput), [demoInput]);

  const demoPassport = useMemo<TrustGridPassport>(() => {
    const nowDate = '2026-03-01';
    const nextReview = '2026-05-30';
    const wfId = 'wf-interactive-demo';
    const asmtId = 'asmt-interactive-demo';

    const wf = {
      id: wfId,
      organizationId: 'org-demo',
      organizationName: demoInput.organizationName || 'Fictional Demo Organization',
      name: demoInput.workflowName || 'Untitled Fictional Workflow',
      purpose: demoInput.purpose || 'Fictional demonstration workflow.',
      owner: demoInput.owner || 'Demo Owner',
      platform: demoInput.platform || 'Demo LLM Platform',
      connectedSystems: demoInput.connectedSystems || 'Sandbox CRM',
      scopeAndLimitations:
        demoInput.scopeAndLimitations || 'Interactive browser demo; fictional workflow data only.',
      dataSensitivity: demoInput.dataSensitivity,
      autonomyLevel: demoInput.autonomyLevel,
      impactLevel: demoInput.impactLevel,
      externalInput: demoInput.externalInput,
      externalInputSources: demoInput.externalInputSources,
      loggingLevel: demoInput.loggingLevel,
      humanApproval: demoInput.humanApproval,
      rollbackCapability: demoInput.rollbackCapability,
      safeguards: demoInput.existingSafeguards,
      unresolvedIssues: demoInput.unresolvedIssues,
      remediationOwner: demoInput.remediationOwner || 'Demo Engineer',
      remediationDueDate: demoInput.remediationDueDate || '2026-04-15',
      reviewerName: demoInput.reviewerName || 'Demo Reviewer',
      isSampleDemo: true,
      createdAt: `${nowDate}T00:00:00.000Z`,
      updatedAt: `${nowDate}T00:00:00.000Z`,
    };

    const asmt = {
      id: asmtId,
      workflowId: wfId,
      methodologyVersion: evaluation.methodologyVersion,
      methodologyLabel: evaluation.methodologyLabel,
      answers: demoInput,
      score: evaluation.score,
      riskBand: evaluation.riskBand,
      contributions: evaluation.contributions,
      criticalReviewFlags: evaluation.criticalReviewFlags,
      findings: demoInput.unresolvedIssues ? [demoInput.unresolvedIssues] : [],
      assessor: wf.reviewerName,
      assessedAt: nowDate,
      nextReviewDate: nextReview,
    };

    const testResults = INITIAL_TEST_SCENARIOS.map((scn) => {
      const st = scenarioStatuses[scn.id] ?? 'not-run';
      return {
        id: `demo-tr-${scn.id}`,
        workflowId: wfId,
        scenarioId: scn.id,
        scenarioCode: scn.code,
        scenarioTitle: scn.title,
        status: st,
        expectedResult: scn.expectedBehavior,
        actualResult:
          st === 'pass'
            ? 'Self-reported pass in fictional demo sandbox.'
            : st === 'fail'
              ? 'Self-reported failure recorded in demo sandbox; remediation required.'
              : st === 'blocked'
                ? 'Blocked pending staging fixture.'
                : '',
        evidenceReference: st === 'not-run' ? '' : `Demo log #${scn.code}`,
        tester: st === 'not-run' ? '' : demoTester,
        testedAt: st === 'not-run' ? '' : nowDate,
        notes: '',
        followUpFinding: '',
      };
    });

    const safeguards = DEFAULT_SAFEGUARD_CATALOG.filter((sg) =>
      evaluation.recommendedSafeguardCategories.includes(sg.category)
    ).map((sg, idx) => ({
      ...sg,
      id: `demo-sg-${idx}`,
      workflowId: wfId,
      owner: wf.remediationOwner,
      status: 'recommended' as const,
      evidence: '',
      reviewDate: nextReview,
    }));

    const findings = [
      ...(demoInput.unresolvedIssues.trim()
        ? [
            {
              id: 'demo-fnd-user',
              workflowId: wfId,
              description: demoInput.unresolvedIssues.trim(),
              severity: 'high' as const,
              owner: wf.remediationOwner,
              dueDate: wf.remediationDueDate,
              status: 'open' as const,
              evidence: 'User-entered demo issue',
              origin: 'user-entered' as const,
              createdAt: nowDate,
              updatedAt: nowDate,
            },
          ]
        : []),
      ...evaluation.criticalReviewFlags.map((fl, i) => ({
        id: `demo-fnd-flag-${i}`,
        workflowId: wfId,
        description: `${fl.title}: ${fl.recommendedAction}`,
        severity: 'critical' as const,
        owner: wf.remediationOwner,
        dueDate: wf.remediationDueDate,
        status: 'open' as const,
        evidence: fl.code,
        origin: 'rule-generated' as const,
        createdAt: nowDate,
        updatedAt: nowDate,
      })),
    ];

    const passportCode = 'ATP-SANDBOX-0001';
    return {
      id: 'pp-interactive-sandbox',
      passportCode,
      workflowId: wfId,
      assessmentId: asmtId,
      version: 1,
      snapshot: buildPassportSnapshot({
        passportCode,
        versionNumber: 1,
        workflow: wf,
        assessment: asmt,
        testResults,
        safeguards,
        findings,
      }),
      createdAt: `${nowDate}T00:00:00.000Z`,
      updatedAt: `${nowDate}T00:00:00.000Z`,
      createdBy: wf.reviewerName,
      isSampleDemo: true,
    };
  }, [demoInput, evaluation, scenarioStatuses, demoTester]);

  const handleLoadFictional = () => {
    setDemoInput(FICTIONAL_DEMO_PRESET);
    setScenarioStatuses({
      'scn-01': 'fail',
      'scn-02': 'pass',
      'scn-05': 'pass',
      'scn-08': 'pass',
    });
    setResetNotice('Loaded fictional Vendor Invoice Triage example.');
  };

  const handleResetBlankDemo = () => {
    setDemoInput({
      ...EMPTY_FORM,
      workflowName: 'My Fictional AI Assistant',
      organizationName: 'Example Team',
      owner: 'Project Lead',
      purpose: 'Drafts internal meeting action items for human team review.',
      platform: 'Free-tier LLM API',
      connectedSystems: 'Internal Notes App (read/draft)',
      dataSensitivity: 'internal',
      autonomyLevel: 'suggestions_only',
      impactLevel: 'minor',
      externalInput: false,
      humanApproval: 'required',
      loggingLevel: 'comprehensive',
      rollbackCapability: 'not_required',
      remediationOwner: 'Engineering Lead',
    });
    setScenarioStatuses({});
    setResetNotice('Reset demo to a minimal low-risk fictional baseline.');
  };

  return (
    <TrustGridShell currentPageLabel="Interactive Demo">
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <p className="text-xs font-medium text-[#35C8FF]">
              ZERO-API-KEY SANDBOX · DETERMINISTIC LOCAL ENGINE
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
              Interactive TrustGrid Governance Demo
            </h1>
            <p className="text-sm text-[#AEBFD4]">
              Adjust workflow context, risk controls, self-reported staging checks, and unresolved
              issues below to see the provisional score and AI Workflow Passport update immediately.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLoadFictional}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-4 py-2 text-xs font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Load Fictional Example</span>
            </button>
            <button
              type="button"
              onClick={handleResetBlankDemo}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#0B1B30] px-4 py-2 text-xs font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>

        {resetNotice && (
          <p role="status" className="text-xs text-[#42D6A4]">
            {resetNotice}
          </p>
        )}

        {/* Interactive Controls Split: User-Entered vs Self-Reported Tests vs Rule Output */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Column 1: User-Entered Workflow & Risk Controls */}
          <section className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-4 text-xs">
            <div>
              <p className="text-[11px] font-semibold text-[#35C8FF]">
                SECTION A · USER-ENTERED INFORMATION
              </p>
              <h2 className="text-base font-bold text-[#F3F7FF]">
                1. Fictional Workflow & Control Selections
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Workflow Name</span>
                <input
                  type="text"
                  value={demoInput.workflowName}
                  onChange={(e) => setDemoInput((p) => ({ ...p, workflowName: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Organization (Fictional)</span>
                <input
                  type="text"
                  value={demoInput.organizationName}
                  onChange={(e) =>
                    setDemoInput((p) => ({ ...p, organizationName: e.target.value }))
                  }
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Data Sensitivity</span>
                <select
                  value={demoInput.dataSensitivity}
                  onChange={(e) =>
                    setDemoInput((p) => ({
                      ...p,
                      dataSensitivity: e.target.value as DataSensitivityLevel,
                    }))
                  }
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                >
                  {Object.entries(DATA_SENSITIVITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Autonomy Level</span>
                <select
                  value={demoInput.autonomyLevel}
                  onChange={(e) =>
                    setDemoInput((p) => ({
                      ...p,
                      autonomyLevel: e.target.value as AutonomyLevel,
                    }))
                  }
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                >
                  {Object.entries(AUTONOMY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Potential Impact</span>
                <select
                  value={demoInput.impactLevel}
                  onChange={(e) =>
                    setDemoInput((p) => ({ ...p, impactLevel: e.target.value as ImpactLevel }))
                  }
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                >
                  {Object.entries(IMPACT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[#AEBFD4]">External / Untrusted Input</span>
                <select
                  value={demoInput.externalInput ? 'yes' : 'no'}
                  onChange={(e) =>
                    setDemoInput((p) => ({ ...p, externalInput: e.target.value === 'yes' }))
                  }
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                >
                  <option value="yes">Yes (+1 pt)</option>
                  <option value="no">No (0 pts)</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Logging & Traceability</span>
                <select
                  value={demoInput.loggingLevel}
                  onChange={(e) =>
                    setDemoInput((p) => ({ ...p, loggingLevel: e.target.value as LoggingLevel }))
                  }
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                >
                  {Object.entries(LOGGING_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[#AEBFD4]">Human Approval</span>
                <select
                  value={demoInput.humanApproval}
                  onChange={(e) =>
                    setDemoInput((p) => ({
                      ...p,
                      humanApproval: e.target.value as HumanApprovalLevel,
                    }))
                  }
                  className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
                >
                  {Object.entries(HUMAN_APPROVAL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-[#AEBFD4]">Known Unresolved Issues (User-Entered)</span>
              <textarea
                rows={2}
                value={demoInput.unresolvedIssues}
                onChange={(e) => setDemoInput((p) => ({ ...p, unresolvedIssues: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
              />
            </label>
          </section>

          {/* Column 2: Self-Reported Test Outcomes + Rule-Generated Summary */}
          <section className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-5 text-xs">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-[#FFD37A]">
                SECTION B · SELF-REPORTED TEST OUTCOMES
              </p>
              <h2 className="text-base font-bold text-[#F3F7FF]">
                2. Mark Staging Check Outcomes
              </h2>
              <p className="text-[#AEBFD4]">
                Self-recorded outcomes only—never implies independent third-party verification.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-[#AEBFD4]">Tester Name (Demo)</span>
              <input
                type="text"
                value={demoTester}
                onChange={(e) => setDemoTester(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-1.5 text-[#F3F7FF]"
              />
            </label>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {INITIAL_TEST_SCENARIOS.map((scn) => {
                const current = scenarioStatuses[scn.id] ?? 'not-run';
                return (
                  <div
                    key={scn.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#06101F] px-3 py-2"
                  >
                    <span className="truncate text-[#F3F7FF]">
                      <span className="font-mono text-[#35C8FF]">{scn.code}</span> · {scn.title}
                    </span>
                    <select
                      aria-label={`Outcome for ${scn.title}`}
                      value={current}
                      onChange={(e) =>
                        setScenarioStatuses((prev) => ({
                          ...prev,
                          [scn.id]: e.target.value as TestOutcomeStatus,
                        }))
                      }
                      className="rounded border border-white/15 bg-[#0B1B30] px-2 py-1 font-mono text-[11px] text-[#F3F7FF]"
                    >
                      <option value="not-run">NOT-RUN</option>
                      <option value="pass">PASS</option>
                      <option value="fail">FAIL</option>
                      <option value="blocked">BLOCKED</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 pt-4 space-y-1.5">
              <p className="text-[11px] font-semibold text-[#35C8FF]">
                SECTION C · RULE-GENERATED PROVISIONAL SUMMARY
              </p>
              <p className="font-mono text-base font-bold">
                Score: {evaluation.score} pts ·{' '}
                <span className={riskBandTextColor(evaluation.riskBand)}>
                  {evaluation.riskBand}
                </span>
              </p>
              <p className="text-[#AEBFD4]">
                Critical Review Flags: {evaluation.criticalReviewFlags.length} · Suggested Safeguard
                Categories: {evaluation.recommendedSafeguardCategories.length}
              </p>
              {evaluation.criticalReviewFlags.map((fl) => (
                <p key={fl.code} className="flex items-center gap-1.5 text-[#FF7B8B]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{fl.title}</span>
                </p>
              ))}
            </div>
          </section>
        </div>

        {/* Live Generated AI Workflow Passport (TXT, JSON, Print, Copy) */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-[#F3F7FF]">
              Live Generated Demo Passport (Export TXT, JSON, or Print)
            </h2>
            <Link
              to="/assessment"
              className="text-xs font-semibold text-[#35C8FF] hover:underline"
            >
              Want to save permanently to your Reports Dashboard? Run Guided Assessment →
            </Link>
          </div>
          <PassportDocumentView passport={demoPassport} />
        </section>
      </div>
    </TrustGridShell>
  );
};
