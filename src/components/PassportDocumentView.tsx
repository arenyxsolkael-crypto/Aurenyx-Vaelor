import React, { useState } from 'react';
import { Check, Copy, Download, FileJson, Printer, AlertTriangle } from 'lucide-react';
import {
  formatPassportAsPlainText,
  type RiskBand,
  type TrustGridPassport,
} from '../shared/trustgridEngine';
import { TrustGridBrandMark } from './TrustGridBrandMark';

export function riskBandTextColor(band: RiskBand): string {
  switch (band) {
    case 'Low':
      return 'text-[#42D6A4]';
    case 'Moderate':
      return 'text-[#35C8FF]';
    case 'High':
      return 'text-[#FFD37A]';
    case 'Critical':
      return 'text-[#FF7B8B]';
  }
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

interface PassportDocumentViewProps {
  passport: TrustGridPassport;
  allVersionsForWorkflow?: TrustGridPassport[];
  onSelectVersion?: (passportId: string) => void;
}

export const PassportDocumentView: React.FC<PassportDocumentViewProps> = ({
  passport,
  allVersionsForWorkflow = [],
  onSelectVersion,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const s = passport.snapshot;

  const handleDownloadTxt = () => {
    const txt = formatPassportAsPlainText(passport);
    triggerFileDownload(
      `${s.passportCode.toLowerCase()}-v${s.versionNumber}.txt`,
      txt,
      'text/plain;charset=utf-8'
    );
  };

  const handleDownloadJson = () => {
    const json = JSON.stringify(passport, null, 2);
    triggerFileDownload(
      `${s.passportCode.toLowerCase()}-v${s.versionNumber}.json`,
      json,
      'application/json;charset=utf-8'
    );
  };

  const handleCopy = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(formatPassportAsPlainText(passport));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError('Clipboard permission unavailable in this browser frame. Use Download TXT instead.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Action Bar (hidden when printing) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1685FF]/25 bg-[#0B1B30] p-3.5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#AEBFD4]">
          <span className="font-mono text-[#F3F7FF]">{s.passportCode}</span>
          <span aria-hidden="true">·</span>
          <span>Snapshot v{s.versionNumber}</span>
          {allVersionsForWorkflow.length > 1 && onSelectVersion && (
            <>
              <span aria-hidden="true">·</span>
              <label htmlFor="passport-version-select" className="sr-only">
                Select historical Passport version
              </label>
              <select
                id="passport-version-select"
                value={passport.id}
                onChange={(e) => onSelectVersion(e.target.value)}
                className="rounded-lg border border-white/15 bg-[#06101F] px-2.5 py-1 text-xs text-[#F3F7FF] focus:border-[#35C8FF] focus:outline-none"
              >
                {allVersionsForWorkflow.map((ver) => (
                  <option key={ver.id} value={ver.id}>
                    Version v{ver.version} ({ver.snapshot.assessmentDate} · {ver.snapshot.methodologyVersion})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#1685FF] px-3.5 py-2 text-xs font-semibold text-[#F3F7FF] transition-colors hover:bg-[#2b92ff]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download TXT</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#06101F] px-3.5 py-2 text-xs font-medium text-[#F3F7FF] transition-colors hover:border-[#35C8FF]"
          >
            <FileJson className="h-3.5 w-3.5 text-[#35C8FF]" />
            <span>Download JSON</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#06101F] px-3.5 py-2 text-xs font-medium text-[#F3F7FF] transition-colors hover:border-[#35C8FF]"
          >
            <Printer className="h-3.5 w-3.5 text-[#35C8FF]" />
            <span>Print Passport</span>
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#06101F] px-3.5 py-2 text-xs font-medium text-[#F3F7FF] transition-colors hover:border-[#35C8FF]"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#42D6A4]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-[#35C8FF]" />
                <span>Copy Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {copyError && (
        <p role="status" className="print:hidden text-xs text-[#FFD37A]">
          {copyError}
        </p>
      )}

      {/* Printable AI Workflow Passport Document */}
      <article
        id="printable-passport"
        aria-label={`AI Workflow Passport ${s.passportCode}`}
        className="trustgrid-printable rounded-2xl border border-white/12 bg-[#0B1B30] p-6 sm:p-8 text-[#F3F7FF] space-y-8"
      >
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3.5">
            <TrustGridBrandMark size="md" className="print:hidden" />
            <div className="space-y-1">
              <p className="text-xs text-[#35C8FF]">
                AURENYX TRUSTGRID · AI WORKFLOW PASSPORT
              </p>
              <h2 className="text-xl font-bold tracking-tight text-[#F3F7FF] sm:text-2xl">
                {s.workflowName}
              </h2>
              <p className="text-xs text-[#AEBFD4]">
                Passport ID: <span className="font-mono text-[#F3F7FF]">{s.passportCode}</span>
                {' · '}Version v{s.versionNumber}
                {' · '}Methodology: <span className="font-mono">{s.methodologyVersion}</span>
                {s.isSampleDemo ? ' · Fictional Sample Record' : ' · User-Recorded Snapshot'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/12 bg-[#06101F] px-4 py-3 text-left sm:text-right">
            <p className="text-xs text-[#AEBFD4]">Provisional Risk Score</p>
            <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-[#F3F7FF]">
              {s.riskScore}{' '}
              <span className={`text-base font-semibold ${riskBandTextColor(s.riskClassification)}`}>
                ({s.riskClassification})
              </span>
            </p>
            <p className="text-[11px] text-[#AEBFD4]">Provisional heuristic · Not a certification</p>
          </div>
        </header>

        {/* Critical Review Flags (Displayed Separately from Numerical Score) */}
        <section className="space-y-2.5">
          <h3 className="text-sm font-semibold text-[#F3F7FF]">
            Critical Review Flags (Evaluated Separately from Numerical Score)
          </h3>
          {s.criticalReviewFlags.length === 0 ? (
            <p className="text-xs text-[#AEBFD4]">
              No mandatory critical review flags triggered by current questionnaire selections.
            </p>
          ) : (
            <div className="space-y-2.5">
              {s.criticalReviewFlags.map((flag) => (
                <div
                  key={flag.code}
                  className="rounded-xl border border-[#FF7B8B]/35 bg-[#FF7B8B]/10 p-4 space-y-1"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#FF7B8B]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{flag.title}</span>
                    <span className="font-mono text-[11px] opacity-85">({flag.code})</span>
                  </div>
                  <p className="text-xs text-[#F3F7FF]">{flag.reason}</p>
                  <p className="text-xs text-[#AEBFD4]">
                    <strong className="text-[#F3F7FF]">Recommended Review Action:</strong>{' '}
                    {flag.recommendedAction}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Provenance Legend */}
        <section className="grid grid-cols-1 gap-4 border-y border-white/10 py-5 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-semibold text-[#F3F7FF]">User-Entered Context</p>
            <p className="mt-0.5 text-[#AEBFD4]">
              Workflow scope, connected systems, controls, and known issues supplied by {s.reviewer}.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#35C8FF]">Rule-Generated Output</p>
            <p className="mt-0.5 text-[#AEBFD4]">
              Provisional score ({s.riskScore}), band ({s.riskClassification}), flags, and suggested safeguards.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#FFD37A]">Self-Reported Tests</p>
            <p className="mt-0.5 text-[#AEBFD4]">
              Scenario outcomes recorded by your team in authorized test environments.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#AEBFD4]">Independent Verification</p>
            <p className="mt-0.5 text-[#AEBFD4]">
              None claimed. No external audit, regulatory sign-off, or safety guarantee exists.
            </p>
          </div>
        </section>

        {/* 1. Workflow Metadata & Accountability */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#F3F7FF]">
            01. Workflow Scope, Ownership & Connected Systems (User-Entered)
          </h3>
          <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-[#AEBFD4]">Organization / Team</dt>
              <dd className="mt-0.5 font-medium text-[#F3F7FF]">{s.organizationName}</dd>
            </div>
            <div>
              <dt className="text-[#AEBFD4]">Workflow Owner</dt>
              <dd className="mt-0.5 font-medium text-[#F3F7FF]">{s.workflowOwner}</dd>
            </div>
            <div>
              <dt className="text-[#AEBFD4]">AI Model / Platform</dt>
              <dd className="mt-0.5 font-medium text-[#F3F7FF]">{s.platformUsed}</dd>
            </div>
            <div>
              <dt className="text-[#AEBFD4]">Assessment Date & Reviewer</dt>
              <dd className="mt-0.5 font-medium text-[#F3F7FF]">
                {s.assessmentDate} · {s.reviewer}
              </dd>
            </div>
            <div>
              <dt className="text-[#AEBFD4]">Next Scheduled Review</dt>
              <dd className="mt-0.5 font-mono text-[#F3F7FF]">{s.nextReviewDate}</dd>
            </div>
            <div>
              <dt className="text-[#AEBFD4]">Remediation Owner & Target</dt>
              <dd className="mt-0.5 font-medium text-[#F3F7FF]">
                {s.remediationOwner} ({s.remediationDueDate})
              </dd>
            </div>
          </dl>

          <div className="grid grid-cols-1 gap-4 pt-2 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#06101F] p-4 space-y-1">
              <p className="text-[#AEBFD4]">Business Purpose</p>
              <p className="leading-relaxed text-[#F3F7FF]">{s.businessPurpose}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#06101F] p-4 space-y-1">
              <p className="text-[#AEBFD4]">Scope, Boundaries & Connected Systems</p>
              <p className="leading-relaxed text-[#F3F7FF]">
                <strong>Connected:</strong> {s.connectedSystems}
              </p>
              <p className="leading-relaxed text-[#AEBFD4]">{s.scopeAndLimitations}</p>
            </div>
          </div>
        </section>

        {/* 2. Operational Risk Controls */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#F3F7FF]">
            02. Operational Controls & Exposure Profile (User-Entered)
          </h3>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
              <p className="text-[#AEBFD4]">Data Sensitivity</p>
              <p className="mt-0.5 font-medium text-[#F3F7FF]">{s.dataSensitivityLabel}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
              <p className="text-[#AEBFD4]">Autonomy Level</p>
              <p className="mt-0.5 font-medium text-[#F3F7FF]">{s.autonomyLevelLabel}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
              <p className="text-[#AEBFD4]">Potential Impact of Failure</p>
              <p className="mt-0.5 font-medium text-[#F3F7FF]">{s.potentialImpactLabel}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
              <p className="text-[#AEBFD4]">External / Untrusted Input Exposure</p>
              <p className="mt-0.5 font-medium text-[#F3F7FF]">{s.externalInputExposure}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
              <p className="text-[#AEBFD4]">Logging & Monitoring Controls</p>
              <p className="mt-0.5 font-medium text-[#F3F7FF]">{s.loggingAndMonitoringControls}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
              <p className="text-[#AEBFD4]">Human Approval & Rollback Controls</p>
              <p className="mt-0.5 font-medium text-[#F3F7FF]">{s.humanApprovalControls}</p>
              <p className="mt-0.5 text-[#AEBFD4]">{s.rollbackControls}</p>
            </div>
          </div>
          <p className="text-xs text-[#AEBFD4]">
            <strong className="text-[#F3F7FF]">Existing Safeguards Reported:</strong>{' '}
            {s.existingSafeguardsSummary}
          </p>
        </section>

        {/* 3. Deterministic Score Breakdown */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#F3F7FF]">
              03. Transparent Score Breakdown (Rule-Generated · {s.methodologyVersion})
            </h3>
            <span className="text-xs text-[#AEBFD4]">{s.methodologyLabel}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#06101F]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[#AEBFD4]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Factor</th>
                  <th className="px-4 py-2.5 font-medium">Recorded Selection</th>
                  <th className="px-4 py-2.5 font-medium text-right">Points</th>
                  <th className="px-4 py-2.5 font-medium">Rule Explanation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {s.scoreBreakdown.map((item) => (
                  <tr key={item.factorId}>
                    <td className="px-4 py-2.5 font-medium text-[#F3F7FF] whitespace-nowrap">
                      {item.factorLabel}
                    </td>
                    <td className="px-4 py-2.5 text-[#AEBFD4]">{item.selectedOptionLabel}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#35C8FF]">
                      +{item.points}
                    </td>
                    <td className="px-4 py-2.5 text-[#AEBFD4]">{item.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Test Scenarios & Self-Reported Outcomes */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#F3F7FF]">
            04. Practical Safety Check Scenarios (Self-Reported Outcomes — Not Independently Verified)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#06101F]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[#AEBFD4]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Scenario</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Actual Outcome</th>
                  <th className="px-4 py-2.5 font-medium">Evidence & Tester</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {s.testScenariosSummary.map((tr) => (
                  <tr key={tr.scenarioCode}>
                    <td className="px-4 py-2.5 font-medium text-[#F3F7FF]">
                      <span className="font-mono text-[#35C8FF]">{tr.scenarioCode}</span> · {tr.title}
                    </td>
                    <td className="px-4 py-2.5 font-mono uppercase whitespace-nowrap">
                      <span
                        className={
                          tr.status === 'pass'
                            ? 'text-[#42D6A4]'
                            : tr.status === 'fail'
                              ? 'text-[#FF7B8B]'
                              : tr.status === 'blocked'
                                ? 'text-[#FFD37A]'
                                : 'text-[#AEBFD4]'
                        }
                      >
                        {tr.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#AEBFD4]">{tr.actualOutcome}</td>
                    <td className="px-4 py-2.5 text-[#AEBFD4]">
                      {tr.evidenceReference} · {tr.tester} ({tr.testedAt})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. Suggested Safeguards & Unresolved Findings */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-[#F3F7FF]">
              05. Suggested Safeguards (Recommendations)
            </h3>
            <ul className="space-y-2 text-xs">
              {s.suggestedSafeguards.map((sg) => (
                <li
                  key={`${sg.category}-${sg.title}`}
                  className="rounded-xl border border-white/10 bg-[#06101F] p-3"
                >
                  <p className="font-medium text-[#F3F7FF]">
                    {sg.category}: {sg.title}
                  </p>
                  <p className="mt-0.5 text-[#AEBFD4]">
                    Status: <span className="font-mono">{sg.status}</span> · Owner: {sg.owner} ·
                    Review: {sg.reviewDate || 'Unscheduled'}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-[#F3F7FF]">
              06. Unresolved Findings & Evidence References
            </h3>
            {s.unresolvedFindings.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-[#06101F] p-3.5 text-xs text-[#AEBFD4]">
                No unresolved findings open at snapshot time.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {s.unresolvedFindings.map((f, idx) => (
                  <li
                    key={`${f.description}-${idx}`}
                    className="rounded-xl border border-white/10 bg-[#06101F] p-3"
                  >
                    <p className="font-medium text-[#F3F7FF]">{f.description}</p>
                    <p className="mt-0.5 text-[#AEBFD4]">
                      Severity: <span className="font-mono uppercase">{f.severity}</span> · Status:{' '}
                      {f.status} · Owner: {f.owner} · Due: {f.dueDate} · Source: {f.origin}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5 text-xs space-y-1">
              <p className="font-medium text-[#F3F7FF]">Evidence References Logged</p>
              <p className="text-[#AEBFD4]">
                {s.evidenceReferences.length > 0
                  ? s.evidenceReferences.join(' · ')
                  : 'No external evidence references attached.'}
              </p>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <footer className="border-t border-white/10 pt-4 text-xs leading-relaxed text-[#AEBFD4]">
          <p>{s.disclaimer}</p>
        </footer>
      </article>
    </div>
  );
};
