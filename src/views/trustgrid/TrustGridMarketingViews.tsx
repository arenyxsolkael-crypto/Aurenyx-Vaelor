import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  AUTONOMY_LABELS,
  CURRENT_METHODOLOGY_LABEL,
  CURRENT_METHODOLOGY_VERSION,
  DATA_SENSITIVITY_LABELS,
  evaluateProvisionalRisk,
  HUMAN_APPROVAL_LABELS,
  IMPACT_LABELS,
  LOGGING_LABELS,
  METHODOLOGY_LIMITATION_NOTE,
  ROLLBACK_LABELS,
  TRUSTGRID_BRAND,
  type AssessmentQuestionnaireInput,
  type AutonomyLevel,
  type DataSensitivityLevel,
  type HumanApprovalLevel,
  type ImpactLevel,
  type LoggingLevel,
  type RollbackLevel,
} from '../../shared/trustgridEngine';
import { TrustGridShell } from '../../components/TrustGridShell';
import { riskBandTextColor } from '../../components/PassportDocumentView';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

export const TrustGridHomeView: React.FC = () => {
  useDocumentMeta({
    title: 'AURENYX TRUSTGRID — AI Workflow Governance & Risk Passport',
    description: TRUSTGRID_BRAND.supportingMessage,
  });

  return (
    <TrustGridShell currentPageLabel="Home">
      <div className="space-y-16">
        {/* 1. Hero + Sample-Labeled Dashboard Preview */}
        <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 pt-2">
          <div className="space-y-6 lg:col-span-7">
            <p className="text-xs font-medium tracking-wider text-[#35C8FF]">
              {TRUSTGRID_BRAND.eyebrow}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF] sm:text-5xl text-balance">
              {TRUSTGRID_BRAND.headline}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#AEBFD4]">
              {TRUSTGRID_BRAND.supportingMessage}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/demo"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#1685FF] px-5 py-2.5 text-sm font-semibold text-[#F3F7FF] transition-colors hover:bg-[#2b92ff]"
              >
                <span>Try the Free Demo</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/product"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-[#0B1B30] px-5 py-2.5 text-sm font-medium text-[#F3F7FF] transition-colors hover:border-[#35C8FF]"
              >
                <span>Explore the Product</span>
              </Link>
            </div>
            <p className="text-xs text-[#AEBFD4]">
              Runs without a paid AI API key · Provisional transparent scoring · Parent platform:{' '}
              <span className="text-[#F3F7FF]">{TRUSTGRID_BRAND.parentBrand}</span>
            </p>
          </div>

          {/* Illustrative Dashboard Preview (Explicitly Labeled Sample Data) */}
          <div className="lg:col-span-5 rounded-2xl border border-[#1685FF]/30 bg-[#0B1B30] p-5 sm:p-6 space-y-5">
            <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <p className="text-xs font-semibold text-[#F3F7FF]">
                  Workflow Governance Snapshot
                </p>
                <p className="text-[11px] text-[#35C8FF]">
                  Illustrative Sample Data — Fictional Support Triage Workflow
                </p>
              </div>
              <span className="font-mono text-xs text-[#AEBFD4]">ATP-DEMO-2026</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
                <p className="text-[#AEBFD4]">Sample Risk Rating</p>
                <p className="mt-1 font-mono text-lg font-bold text-[#FFD37A]">
                  7 pts · High
                </p>
                <p className="text-[11px] text-[#AEBFD4]">Provisional v0.1</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
                <p className="text-[#AEBFD4]">Assessment Status</p>
                <p className="mt-1 font-semibold text-[#42D6A4]">Completed (Sample)</p>
                <p className="text-[11px] text-[#AEBFD4]">Review due in 90 days</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
                <p className="text-[#AEBFD4]">Test Scenarios Run</p>
                <p className="mt-1 font-mono text-base font-bold text-[#F3F7FF]">
                  4 / 8 recorded
                </p>
                <p className="text-[11px] text-[#FF7B8B]">1 failed check logged</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#06101F] p-3.5">
                <p className="text-[#AEBFD4]">Open Sample Findings</p>
                <p className="mt-1 font-mono text-base font-bold text-[#FFD37A]">2 open</p>
                <p className="text-[11px] text-[#AEBFD4]">Named owners assigned</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-[#AEBFD4]">
              <p className="font-semibold text-[#F3F7FF]">Suggested Safeguards (Sample)</p>
              <p>· Delimit untrusted customer emails against indirect prompt injection</p>
              <p>· Require human agent click before any refund or outbound dispatch</p>
            </div>
          </div>
        </section>

        {/* 2. Product Capability Cards */}
        <section className="space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-[#F3F7FF]">
              Structured Governance Without Inflated Claims
            </h2>
            <p className="text-sm text-[#AEBFD4] max-w-2xl">
              Designed for small agencies, internal engineering teams, and consultants who need
              readable documentation rather than opaque compliance theater.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: '01. Guided 15-Question Risk Review',
                body: 'Capture workflow ownership, data sensitivity, autonomy, failure impact, untrusted inputs, logging, human approval, and rollback readiness.',
                link: '/assessment',
                cta: 'Start Assessment',
              },
              {
                title: '02. Transparent Provisional Scoring',
                body: 'Every point and critical review flag is shown openly with its exact rule explanation and methodology version.',
                link: '/risk-rules',
                cta: 'Inspect Risk Rules',
              },
              {
                title: '03. Practical Safety Test Library',
                body: 'Record authorized staging tests across 8 core failure modes—from prompt injection to timeout fallbacks—plus custom scenarios.',
                link: '/testing',
                cta: 'Open Test Library',
              },
              {
                title: '04. Categorized Safeguard Tracking',
                body: 'Track 12 practical control areas with owners, status, evidence references, and review dates.',
                link: '/safeguards',
                cta: 'Browse Safeguards',
              },
              {
                title: '05. AI Workflow Passport Generator',
                body: 'Compile scope, score breakdown, test outcomes, and unresolved findings into a versioned, print-ready Passport.',
                link: '/passport',
                cta: 'View Sample Passport',
              },
              {
                title: '06. Local-First Export & JSON Backup',
                body: 'Download Passports as TXT or JSON, print clean reports, and back up or restore your entire workspace without paid subscriptions.',
                link: '/reports',
                cta: 'Manage Reports',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-4"
              >
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-[#F3F7FF]">{card.title}</h3>
                  <p className="text-xs leading-relaxed text-[#AEBFD4]">{card.body}</p>
                </div>
                <Link
                  to={card.link}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#35C8FF] hover:underline"
                >
                  <span>{card.cta}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* 3. How TrustGrid Works in Four Steps */}
        <section className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#F3F7FF]">How TrustGrid Works in Four Steps</h2>
            <p className="text-xs text-[#AEBFD4]">
              A repeatable workflow review cycle you can complete in under 20 minutes.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            {[
              {
                step: 'Step 01',
                title: 'Document the Workflow',
                desc: 'Record business purpose, connected tools, data types, autonomy boundaries, and named owners—never API keys or secrets.',
              },
              {
                step: 'Step 02',
                title: 'Evaluate Provisional Risk',
                desc: 'Review the deterministic point breakdown and separate Critical Review Flags for confidential data, high autonomy, or legal/safety impact.',
              },
              {
                step: 'Step 03',
                title: 'Record Staging Checks & Safeguards',
                desc: 'Run practical checks in your own authorized test environment and record pass/fail outcomes, evidence references, and follow-up findings.',
              },
              {
                step: 'Step 04',
                title: 'Issue & Export the Passport',
                desc: 'Generate a versioned AI Workflow Passport (TXT, JSON, or Print) with a scheduled next-review date.',
              },
            ].map((item) => (
              <div key={item.step} className="space-y-1.5">
                <p className="font-mono text-[#35C8FF]">{item.step}</p>
                <h3 className="text-sm font-semibold text-[#F3F7FF]">{item.title}</h3>
                <p className="leading-relaxed text-[#AEBFD4]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Passport Preview + Safety Testing + Free Implementation */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-3">
            <h2 className="text-base font-bold text-[#F3F7FF]">AI Workflow Passport Preview</h2>
            <p className="text-xs leading-relaxed text-[#AEBFD4]">
              Every Passport clearly separates user-entered context, rule-generated suggestions,
              and self-reported test outcomes—and preserves historical snapshots when workflows
              change.
            </p>
            <Link
              to="/passport"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#35C8FF] hover:underline"
            >
              <span>Inspect Full Sample Passport</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-3">
            <h2 className="text-base font-bold text-[#F3F7FF]">Authorized Safety Testing</h2>
            <p className="text-xs leading-relaxed text-[#AEBFD4]">
              TrustGrid does not run automated attacks against external systems. Instead, it gives
              your team 8 structured checklists to execute safely in staging and log real evidence.
            </p>
            <Link
              to="/testing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#35C8FF] hover:underline"
            >
              <span>Review 8 Test Scenarios</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-3">
            <h2 className="text-base font-bold text-[#F3F7FF]">Zero-Cost Free Implementation</h2>
            <p className="text-xs leading-relaxed text-[#AEBFD4]">
              Run locally, export static demos, collect early user feedback, and back up records as
              JSON files with ₹0 / $0 software spend.
            </p>
            <Link
              to="/implementation"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#35C8FF] hover:underline"
            >
              <span>Read 10-Step Free Guide</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* 5. FAQ Preview & Final Call to Action */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-xl font-bold text-[#F3F7FF]">Common Questions</h2>
            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-[#0B1B30] p-4 space-y-1">
                <p className="font-semibold text-[#F3F7FF]">
                  Is TrustGrid a security or regulatory certification?
                </p>
                <p className="text-[#AEBFD4]">
                  No. TrustGrid is a practical documentation and structured review tool. It does not
                  certify AI safety or legal compliance.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1B30] p-4 space-y-1">
                <p className="font-semibold text-[#F3F7FF]">
                  Does it require a paid AI API key or connect to external AI systems?
                </p>
                <p className="text-[#AEBFD4]">
                  No paid key is required, and TrustGrid does not connect directly to your external
                  production systems. All scoring and Passport exports run deterministically.
                </p>
              </div>
            </div>
            <Link
              to="/faq"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#35C8FF] hover:underline"
            >
              <span>Read all 10 FAQ answers</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-[#1685FF]/35 bg-[#0B1B30] p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#F3F7FF]">
              Document Your First AI Workflow Today
            </h2>
            <p className="text-xs leading-relaxed text-[#AEBFD4]">
              Try the interactive fictional demo immediately or run the 15-question assessment for
              one of your own workflows.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/demo"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#1685FF] px-4 py-2 text-xs font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
              >
                Launch Interactive Demo
              </Link>
              <Link
                to="/assessment"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-white/15 bg-[#06101F] px-4 py-2 text-xs font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
              >
                Start Guided Assessment
              </Link>
            </div>
          </div>
        </section>
      </div>
    </TrustGridShell>
  );
};

export const TrustGridProductView: React.FC = () => {
  useDocumentMeta({
    title: 'Product Modules — AURENYX TRUSTGRID',
    description:
      'Explore the eight core governance modules in AURENYX TRUSTGRID, including purpose, inputs, outputs, and honest prototype limitations.',
  });

  const modules = [
    {
      name: '01. Workflow Inventory',
      purpose: 'Maintain a clear catalog of AI assistants, automations, owners, and connected tools.',
      inputs: 'Workflow name, owning team, business purpose, AI model/platform, connected systems.',
      outputs: 'Structured workflow record linked to assessments, tests, safeguards, and Passports.',
      limitations: 'Does not auto-discover shadow AI usage or connect directly to cloud IAM APIs.',
    },
    {
      name: '02. Guided Assessment',
      purpose: 'Walk teams through 15 structured risk, control, and accountability questions.',
      inputs: 'Data sensitivity, autonomy level, failure impact, untrusted inputs, logging, approval, rollback.',
      outputs: 'Validated assessment record saved with methodology version and reviewer metadata.',
      limitations: 'Relies on accurate self-reporting by someone familiar with how the workflow operates.',
    },
    {
      name: '03. Transparent Risk Rules',
      purpose: 'Compute a repeatable provisional score and surface high-consequence review flags.',
      inputs: 'Answers from the guided assessment questionnaire.',
      outputs: 'Numerical score, illustrative band (Low to Critical), factor-by-factor breakdown, and Critical Review Flags.',
      limitations: 'Provisional point heuristic; not scientifically validated or mapped to statutory compliance.',
    },
    {
      name: '04. Test Scenario Library',
      purpose: 'Guide practical staging checks across 8 common AI failure modes plus custom team scenarios.',
      inputs: 'Test status (pass/fail/blocked/not-run), actual outcome, evidence reference, tester, date, notes.',
      outputs: 'Traceable test log per workflow and optional follow-up findings for failed checks.',
      limitations: 'Does not run automated red-teaming against external endpoints; records authorized manual checks only.',
    },
    {
      name: '05. Safeguard Tracking',
      purpose: 'Organize recommended technical and operational controls across 12 safeguard categories.',
      inputs: 'Assigned owner, implementation status, evidence reference, and next review date.',
      outputs: 'Per-workflow safeguard checklist embedded into generated Passports.',
      limitations: 'Implementing listed safeguards reduces operational risk but never guarantees zero failures.',
    },
    {
      name: '06. Findings & Issue Tracking',
      purpose: 'Keep unresolved risks, failed test follow-ups, and remediation deadlines visible.',
      inputs: 'Issue description, severity, owner, target due date, evidence, and resolution status.',
      outputs: 'Open findings list surfaced on the Dashboard and inside every AI Workflow Passport.',
      limitations: 'Lightweight internal tracker; does not sync bi-directionally with external Jira/GitHub tickets in MVP.',
    },
    {
      name: '07. AI Workflow Passport',
      purpose: 'Summarize workflow scope, controls, score breakdown, test results, and open issues in one readable report.',
      inputs: 'Workflow record, assessment snapshot, test outcomes, safeguards, and findings.',
      outputs: 'Immutable versioned Passport snapshot with unique Passport ID and clear provenance labels.',
      limitations: 'Internal review artifact only; not an independent audit report or third-party certification.',
    },
    {
      name: '08. Report Export & Version History',
      purpose: 'Share reports offline, print clean copies, and preserve historical snapshots when rules or workflows evolve.',
      inputs: 'Saved Passport snapshots and local workspace state.',
      outputs: 'Plain-text (.txt) report, structured JSON (.json) report, print stylesheet view, and full workspace JSON backup.',
      limitations: 'Local browser storage can be cleared by browser settings unless backed up via JSON export.',
    },
  ];

  return (
    <TrustGridShell currentPageLabel="Product">
      <div className="space-y-8">
        <div className="space-y-2 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
            Core Governance Modules
          </h1>
          <p className="text-sm leading-relaxed text-[#AEBFD4]">
            Every module in {TRUSTGRID_BRAND.productName} is built around transparent inputs,
            inspectable outputs, and explicit prototype boundaries.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {modules.map((mod) => (
            <section
              key={mod.name}
              className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-3 text-xs"
            >
              <h2 className="text-base font-bold text-[#F3F7FF]">{mod.name}</h2>
              <p className="text-[#F3F7FF] leading-relaxed">{mod.purpose}</p>
              <div className="space-y-1.5 border-t border-white/10 pt-3 text-[#AEBFD4]">
                <p>
                  <strong className="text-[#F3F7FF]">Inputs:</strong> {mod.inputs}
                </p>
                <p>
                  <strong className="text-[#F3F7FF]">Outputs:</strong> {mod.outputs}
                </p>
                <p>
                  <strong className="text-[#FFD37A]">Limitations:</strong> {mod.limitations}
                </p>
              </div>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/assessment"
            className="inline-flex min-h-[42px] items-center rounded-xl bg-[#1685FF] px-5 py-2 text-xs font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
          >
            Run Guided Assessment
          </Link>
          <Link
            to="/demo"
            className="inline-flex min-h-[42px] items-center rounded-xl border border-white/15 bg-[#0B1B30] px-5 py-2 text-xs font-medium text-[#F3F7FF] hover:border-[#35C8FF]"
          >
            Open Interactive Demo
          </Link>
        </div>
      </div>
    </TrustGridShell>
  );
};

export const TrustGridSolutionsView: React.FC = () => {
  useDocumentMeta({
    title: 'Solutions by Team — AURENYX TRUSTGRID',
    description:
      'Practical AI workflow governance use cases for AI automation agencies, small businesses, internal AI teams, and independent consultants.',
  });

  const segments = [
    {
      audience: '01. AI Automation Agencies',
      summary:
        'Deliver a clear handoff package alongside client automations so stakeholders understand boundaries, human approval steps, and known limitations.',
      scenarios: [
        'Document inbound lead triage, support drafting, or invoice extraction workflows before client sign-off.',
        'Record staging checks for prompt injection and fallback behavior prior to production cutover.',
        'Export a plain-language AI Workflow Passport showing what requires human review.',
      ],
    },
    {
      audience: '02. Small Businesses Using AI Assistants',
      summary:
        'Keep track of which customer-facing or back-office tasks use AI models, what data is shared, and who is responsible if outputs go wrong.',
      scenarios: [
        'Inventory customer email drafters, scheduling assistants, and document summarizers in one place.',
        'Identify where sensitive customer or financial information needs minimization before prompting.',
        'Set 90-day review reminders and maintain a rollback plan if a workflow misbehaves.',
      ],
    },
    {
      audience: '03. Internal AI & Product Engineering Teams',
      summary:
        'Standardize lightweight pre-launch reviews across engineering, operations, and security reviewers without heavyweight enterprise tooling.',
      scenarios: [
        'Evaluate autonomy changes when moving from read-only copilot suggestions to automated tool calls.',
        'Track open remediation items with named owners and target dates alongside staging test evidence.',
        'Preserve versioned Passport snapshots each time prompts, tools, or underlying models are upgraded.',
      ],
    },
    {
      audience: '04. Independent AI Consultants & Reviewers',
      summary:
        'Use a transparent, explainable questionnaire and provisional rule table during structured client discovery and workflow readiness workshops.',
      scenarios: [
        'Walk client teams through 15 concrete questions covering data, autonomy, logging, and rollback.',
        'Use separate Critical Review Flags to highlight high-consequence areas without black-box scores.',
        'Export TXT or JSON Passport summaries that clients can store in their own repositories.',
      ],
    },
  ];

  return (
    <TrustGridShell currentPageLabel="Solutions">
      <div className="space-y-8">
        <div className="space-y-2 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
            Practical Governance for Real Workflows
          </h1>
          <p className="text-sm leading-relaxed text-[#AEBFD4]">
            Potential ways teams can apply {TRUSTGRID_BRAND.productName}. Because this is an
            early-stage Version 0.1 release, these examples illustrate intended workflows rather
            than claimed customer case studies.
          </p>
        </div>

        <div className="space-y-5">
          {segments.map((seg) => (
            <section
              key={seg.audience}
              className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-3"
            >
              <h2 className="text-lg font-bold text-[#F3F7FF]">{seg.audience}</h2>
              <p className="text-xs leading-relaxed text-[#AEBFD4]">{seg.summary}</p>
              <ul className="space-y-1.5 pt-1 text-xs text-[#F3F7FF]">
                {seg.scenarios.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#42D6A4]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </TrustGridShell>
  );
};

export const TrustGridRiskRulesView: React.FC = () => {
  useDocumentMeta({
    title: 'Provisional Risk Rules & Methodology — AURENYX TRUSTGRID',
    description:
      'Inspect the deterministic provisional risk scoring table, illustrative bands, and critical review flags in AURENYX TRUSTGRID.',
  });

  const [simInput, setSimInput] = useState<AssessmentQuestionnaireInput>({
    workflowName: 'Interactive Rule Simulator',
    organizationName: 'Simulation',
    owner: 'Reviewer',
    purpose: 'Interactive rule inspection',
    platform: 'Any LLM',
    connectedSystems: 'CRM',
    scopeAndLimitations: '',
    dataSensitivity: 'internal',
    autonomyLevel: 'human_reviewed_drafts',
    impactLevel: 'operational',
    externalInput: true,
    humanApproval: 'required',
    loggingLevel: 'partial',
    rollbackCapability: 'supported',
    existingSafeguards: '',
    unresolvedIssues: '',
    remediationOwner: 'Owner',
  });

  const liveEval = evaluateProvisionalRisk(simInput);

  return (
    <TrustGridShell currentPageLabel="Risk Rules">
      <div className="space-y-10">
        <div className="space-y-3 max-w-3xl">
          <p className="font-mono text-xs text-[#35C8FF]">
            Methodology Version: {CURRENT_METHODOLOGY_VERSION} · Provisional Methodology
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
            Transparent Provisional Risk Rules
          </h1>
          <p className="text-sm leading-relaxed text-[#AEBFD4]">{CURRENT_METHODOLOGY_LABEL}</p>
          <div className="rounded-xl border border-[#FFD37A]/35 bg-[#FFD37A]/10 p-4 text-xs leading-relaxed text-[#F3F7FF]">
            <strong className="text-[#FFD37A]">Explicit Limitation Notice:</strong>{' '}
            {METHODOLOGY_LIMITATION_NOTE} Historical assessments and Passports store the exact
            methodology version (<code className="font-mono">{CURRENT_METHODOLOGY_VERSION}</code>)
            used at creation so future rule updates never silently alter past reports.
          </div>
        </div>

        {/* Exact Point Allocation Table */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#F3F7FF]">Deterministic Point Allocation</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
            <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-2">
              <h3 className="text-sm font-semibold text-[#F3F7FF]">Data Sensitivity (0–2 pts + Flag)</h3>
              <ul className="space-y-1.5 text-[#AEBFD4]">
                <li>· Public information: <span className="font-mono text-[#F3F7FF]">0 points</span></li>
                <li>· Internal non-sensitive information: <span className="font-mono text-[#F3F7FF]">+1 point</span></li>
                <li>· Personal or sensitive information: <span className="font-mono text-[#F3F7FF]">+2 points</span></li>
                <li>
                  · Confidential or regulated information:{' '}
                  <span className="font-mono text-[#FF7B8B]">+2 points + Critical Review Flag</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-2">
              <h3 className="text-sm font-semibold text-[#F3F7FF]">Autonomy Level (0–2 pts + Flag)</h3>
              <ul className="space-y-1.5 text-[#AEBFD4]">
                <li>· Generates suggestions only: <span className="font-mono text-[#F3F7FF]">0 points</span></li>
                <li>· Drafts actions for human review: <span className="font-mono text-[#F3F7FF]">+1 point</span></li>
                <li>· Executes limited actions automatically: <span className="font-mono text-[#F3F7FF]">+2 points</span></li>
                <li>
                  · Executes consequential actions with minimal oversight:{' '}
                  <span className="font-mono text-[#FF7B8B]">+2 points + Critical Review Flag</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-2">
              <h3 className="text-sm font-semibold text-[#F3F7FF]">Potential Failure Impact (0–2 pts + Flag)</h3>
              <ul className="space-y-1.5 text-[#AEBFD4]">
                <li>· Minor inconvenience: <span className="font-mono text-[#F3F7FF]">0 points</span></li>
                <li>· Operational disruption: <span className="font-mono text-[#F3F7FF]">+1 point</span></li>
                <li>· Financial or privacy impact: <span className="font-mono text-[#F3F7FF]">+2 points</span></li>
                <li>
                  · Significant legal, safety, or business impact:{' '}
                  <span className="font-mono text-[#FF7B8B]">+2 points + Critical Review Flag</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-2">
              <h3 className="text-sm font-semibold text-[#F3F7FF]">Additional Control Factors (0–6 pts)</h3>
              <ul className="space-y-1.5 text-[#AEBFD4]">
                <li>· External or untrusted input processed: <span className="font-mono text-[#F3F7FF]">+1 point</span></li>
                <li>· Logging: Comprehensive (<span className="font-mono">0</span>), Partial (<span className="font-mono text-[#F3F7FF]">+1</span>), Weak (<span className="font-mono text-[#F3F7FF]">+2</span>)</li>
                <li>· Human approval: Enforced (<span className="font-mono">0</span>), Inconsistent (<span className="font-mono text-[#F3F7FF]">+1</span>), None (<span className="font-mono text-[#F3F7FF]">+2</span>)</li>
                <li>· No stop or rollback procedure where appropriate: <span className="font-mono text-[#F3F7FF]">+1 point</span></li>
              </ul>
            </div>
          </div>

          {/* Illustrative Risk Bands */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            {[
              { range: '0–3 points', band: 'Low' as const, desc: 'Lower exposure; maintain baseline logging & periodic review.' },
              { range: '4–6 points', band: 'Moderate' as const, desc: 'Targeted safeguards and staging checks advised.' },
              { range: '7–9 points', band: 'High' as const, desc: 'Strong human approval, input isolation, and testing needed.' },
              { range: '10+ points', band: 'Critical' as const, desc: 'Pause autonomous rollout until controls & flags are resolved.' },
            ].map((b) => (
              <div key={b.band} className="rounded-xl border border-white/10 bg-[#0B1B30] p-4 space-y-1">
                <p className="font-mono text-[#AEBFD4]">{b.range}</p>
                <p className={`text-base font-bold ${riskBandTextColor(b.band)}`}>{b.band}</p>
                <p className="text-[11px] text-[#AEBFD4]">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Deterministic Calculator Sandbox */}
        <section className="rounded-2xl border border-[#1685FF]/30 bg-[#0B1B30] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#F3F7FF]">
                Interactive Rule Inspector
              </h2>
              <p className="text-xs text-[#AEBFD4]">
                Test how changing any factor affects the deterministic provisional score and separate
                critical review flags.
              </p>
            </div>
            <div className="rounded-xl border border-white/12 bg-[#06101F] px-4 py-2.5 text-right">
              <p className="text-[11px] text-[#AEBFD4]">Simulated Provisional Score</p>
              <p className="font-mono text-xl font-bold tabular-nums">
                {liveEval.score} pts ·{' '}
                <span className={riskBandTextColor(liveEval.riskBand)}>{liveEval.riskBand}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <label className="space-y-1">
              <span className="text-[#AEBFD4]">Data Sensitivity</span>
              <select
                value={simInput.dataSensitivity}
                onChange={(e) =>
                  setSimInput((p) => ({
                    ...p,
                    dataSensitivity: e.target.value as DataSensitivityLevel,
                  }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
              >
                {Object.entries(DATA_SENSITIVITY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[#AEBFD4]">Autonomy Level</span>
              <select
                value={simInput.autonomyLevel}
                onChange={(e) =>
                  setSimInput((p) => ({
                    ...p,
                    autonomyLevel: e.target.value as AutonomyLevel,
                  }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
              >
                {Object.entries(AUTONOMY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[#AEBFD4]">Potential Impact</span>
              <select
                value={simInput.impactLevel}
                onChange={(e) =>
                  setSimInput((p) => ({
                    ...p,
                    impactLevel: e.target.value as ImpactLevel,
                  }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
              >
                {Object.entries(IMPACT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[#AEBFD4]">External / Untrusted Input</span>
              <select
                value={simInput.externalInput ? 'yes' : 'no'}
                onChange={(e) =>
                  setSimInput((p) => ({ ...p, externalInput: e.target.value === 'yes' }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
              >
                <option value="yes">Yes (+1 pt)</option>
                <option value="no">No (0 pts)</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[#AEBFD4]">Logging Level</span>
              <select
                value={simInput.loggingLevel}
                onChange={(e) =>
                  setSimInput((p) => ({ ...p, loggingLevel: e.target.value as LoggingLevel }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
              >
                {Object.entries(LOGGING_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[#AEBFD4]">Human Approval</span>
              <select
                value={simInput.humanApproval}
                onChange={(e) =>
                  setSimInput((p) => ({
                    ...p,
                    humanApproval: e.target.value as HumanApprovalLevel,
                  }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
              >
                {Object.entries(HUMAN_APPROVAL_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="text-[#AEBFD4]">Stop / Rollback Capability</span>
              <select
                value={simInput.rollbackCapability}
                onChange={(e) =>
                  setSimInput((p) => ({
                    ...p,
                    rollbackCapability: e.target.value as RollbackLevel,
                  }))
                }
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2 text-[#F3F7FF]"
              >
                {Object.entries(ROLLBACK_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {liveEval.criticalReviewFlags.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-[#FF7B8B]">
                Separate Critical Review Flags Triggered ({liveEval.criticalReviewFlags.length}):
              </p>
              {liveEval.criticalReviewFlags.map((flag) => (
                <div
                  key={flag.code}
                  className="flex items-start gap-2 rounded-xl border border-[#FF7B8B]/35 bg-[#FF7B8B]/10 p-3 text-xs text-[#F3F7FF]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7B8B]" />
                  <div>
                    <p className="font-semibold text-[#FF7B8B]">{flag.title}</p>
                    <p className="text-[#AEBFD4]">{flag.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </TrustGridShell>
  );
};
