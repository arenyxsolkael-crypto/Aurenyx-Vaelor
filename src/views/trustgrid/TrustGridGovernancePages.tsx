import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { TRUSTGRID_BRAND } from '../../shared/trustgridEngine';
import { useTrustGrid } from '../../context/TrustGridContext';
import { TrustGridShell } from '../../components/TrustGridShell';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

export const TrustGridImplementationView: React.FC = () => {
  useDocumentMeta({
    title: 'Free Implementation & Deployment Plan — AURENYX TRUSTGRID',
    description:
      'Step-by-step free implementation guide for running AURENYX TRUSTGRID locally, publishing static demos, backing up JSON data, and preparing for production.',
  });

  const steps = [
    {
      title: '01. Download or Export the Project',
      body: 'Clone or download the project archive into a clean folder. Keep .env.example as your reference template and never commit real .env files or signing keys.',
    },
    {
      title: '02. Run It Locally',
      body: 'Install Node.js 20+, run npm install, then run npm run dev to start the unified server on http://localhost:3000. TrustGrid works immediately without any API key.',
    },
    {
      title: '03. Create a GitHub Repository',
      body: 'Initialize git, verify .gitignore excludes .env*, dist/, and android/keystore.properties, and push to a GitHub repository for version control.',
    },
    {
      title: '04. Publish Static Pages with GitHub Pages Where Suitable',
      body: 'Run npm run build to generate static frontend assets in dist/. Pure client-side TrustGrid routes (Assessment, Demo, Risk Rules, Testing, Safeguards, Passport, Reports, TXT/JSON export) run cleanly as a static bundle with a 404.html SPA fallback; server-orchestrated Vaelor AI chat routes (/api/*) require a Node.js host such as AI Studio Hosting or Render Free Tier.',
    },
    {
      title: '05. Collect Non-Sensitive Feedback with Free-Tier Tools',
      body: 'Use GitHub Discussions, GitHub Issues, or a plain mailto feedback link rather than embedding third-party tracking scripts. Remind testers never to submit confidential customer data.',
    },
    {
      title: '06. Test End-to-End with Fictional Workflows',
      body: 'Create three fictional workflows spanning low, moderate, and high autonomy. Verify deterministic score explanations, critical review flags, TXT/JSON downloads, and print layouts.',
    },
    {
      title: '07. Interview Three to Five Potential Users',
      body: 'Walk 3–5 agency leads, operations managers, or consultants through the 15-question assessment and ask which questions felt unclear or missing.',
    },
    {
      title: '08. Validate & Version the Assessment Methodology',
      body: 'When adjusting point weights based on real review feedback, increment CURRENT_METHODOLOGY_VERSION (for example to TG-PROVISIONAL-0.2) so existing Passport snapshots keep their original version label.',
    },
    {
      title: '09. Back Up Local Browser Data Regularly',
      body: 'Because browser localStorage is cleared when site data is wiped, click Export Backup JSON on /reports after review sessions and store backups in your team repository.',
    },
    {
      title: '10. Prepare Safely for Production Multi-User Deployment',
      body: 'Before commercial multi-user launch, replace localStorage with an authenticated database enforcing tenant isolation, server-side authorization checks, TLS, and legal review of Privacy and Terms templates.',
    },
  ];

  return (
    <TrustGridShell currentPageLabel="Free Implementation Plan">
      <div className="space-y-8">
        <div className="space-y-2 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
            Beginner-Friendly Free Implementation Plan
          </h1>
          <p className="text-sm leading-relaxed text-[#AEBFD4]">
            How to run, test, back up, and deploy {TRUSTGRID_BRAND.productName} using free and
            free-tier developer tools—including honest free-tier limits.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {steps.map((s) => (
            <section
              key={s.title}
              className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-2 text-xs"
            >
              <h2 className="text-sm font-bold text-[#F3F7FF]">{s.title}</h2>
              <p className="leading-relaxed text-[#AEBFD4]">{s.body}</p>
            </section>
          ))}
        </div>

        {/* Static Demo vs Backend Requirements Matrix */}
        <section className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-4 text-xs">
          <h2 className="text-lg font-bold text-[#F3F7FF]">
            Static Hosting vs. Backend Server Requirements
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-white/10 text-[#AEBFD4]">
                <tr>
                  <th className="py-2 pr-4 font-medium">Capability</th>
                  <th className="py-2 pr-4 font-medium">Static Hosting (GitHub Pages)</th>
                  <th className="py-2 font-medium">Node.js Backend (server.ts)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-[#AEBFD4]">
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-[#F3F7FF]">
                    TrustGrid Assessment, Scoring, Testing, Safeguards & Passport Export
                  </td>
                  <td className="py-2.5 pr-4 text-[#42D6A4]">Supported (Local Browser Storage)</td>
                  <td className="py-2.5 text-[#42D6A4]">Supported</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-[#F3F7FF]">
                    Vaelor Multi-Agent Gemini Chat & Server Rate Limiting (/api/*)
                  </td>
                  <td className="py-2.5 pr-4 text-[#FFD37A]">
                    Unavailable without separate API host
                  </td>
                  <td className="py-2.5 text-[#42D6A4]">Supported (Protects GEMINI_API_KEY)</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-[#F3F7FF]">
                    Multi-User Shared Team Database & Login
                  </td>
                  <td className="py-2.5 pr-4 text-[#FF7B8B]">Not supported</td>
                  <td className="py-2.5 text-[#FFD37A]">
                    Requires adding authenticated DB (e.g., Supabase/Cloud SQL)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[#AEBFD4]">
            Note on free-tier limits: Free cloud hosts (such as Render Free Web Services) spin down
            after ~15 minutes of inactivity and use ephemeral disks; free databases may pause after
            inactivity, and custom domains typically require a domain registrar fee.
          </p>
        </section>
      </div>
    </TrustGridShell>
  );
};

export const TrustGridContactView: React.FC = () => {
  useDocumentMeta({
    title: 'Contact & Local Enquiry Drafts — AURENYX TRUSTGRID',
    description:
      'Prepare a governance enquiry or feedback note for AURENYX TRUSTGRID with transparent local draft storage and mailto fallback.',
  });

  const { state, saveContactDraft } = useTrustGrid();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [enquiryType, setEnquiryType] = useState('Product Feedback');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<{ mailtoHref: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Please enter your name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please enter a message of at least 10 characters.');
      return;
    }

    setError(null);
    saveContactDraft({ name, email, enquiryType, message });
    const subject = encodeURIComponent(`[TrustGrid ${enquiryType}] from ${name.trim()}`);
    const body = encodeURIComponent(
      `Name: ${name.trim()}\nEmail: ${email.trim()}\nEnquiry Type: ${enquiryType}\n\n${message.trim()}`
    );
    setSavedNotice({
      mailtoHref: `mailto:${TRUSTGRID_BRAND.contactPlaceholderEmail}?subject=${subject}&body=${body}`,
    });
    setMessage('');
  };

  return (
    <TrustGridShell currentPageLabel="Contact">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
            Contact & Feedback Fallback
          </h1>
          <p className="text-xs leading-relaxed text-[#AEBFD4]">
            No email delivery server is configured in this free-tier MVP. Submitting the form below{' '}
            <strong className="text-[#F3F7FF]">does not transmit your message over the internet</strong>;
            instead, it validates your input, saves a local draft in your browser, and prepares a
            standard <code className="font-mono">mailto:</code> link using the placeholder address{' '}
            <code className="font-mono text-[#35C8FF]">{TRUSTGRID_BRAND.contactPlaceholderEmail}</code>.
            Replace <code className="font-mono">contactPlaceholderEmail</code> in{' '}
            <code className="font-mono">src/shared/trustgridEngine.ts</code> before publishing.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl border border-white/10 bg-[#0B1B30] p-6 space-y-4 text-xs"
        >
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[#FF7B8B]/40 bg-[#FF7B8B]/10 p-3 text-[#FF7B8B]"
            >
              {error}
            </div>
          )}

          {savedNotice && (
            <div
              role="status"
              className="rounded-xl border border-[#42D6A4]/40 bg-[#42D6A4]/10 p-4 space-y-2 text-[#F3F7FF]"
            >
              <div className="flex items-center gap-2 font-semibold text-[#42D6A4]">
                <CheckCircle2 className="h-4 w-4" />
                <span>Saved as a local draft in your browser (not sent to a server).</span>
              </div>
              <p className="text-[#AEBFD4]">
                To send via your own email client once you replace the placeholder recipient, use
                the prepared mailto link:
              </p>
              <a
                href={savedNotice.mailtoHref}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#1685FF] px-3.5 py-1.5 font-semibold text-[#F3F7FF]"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Open in Email Client ({TRUSTGRID_BRAND.contactPlaceholderEmail})</span>
              </a>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="contact-name" className="block font-medium text-[#F3F7FF]">
                Name *
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="contact-email" className="block font-medium text-[#F3F7FF]">
                Email *
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="contact-type" className="block font-medium text-[#F3F7FF]">
              Enquiry Type
            </label>
            <select
              id="contact-type"
              value={enquiryType}
              onChange={(e) => setEnquiryType(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
            >
              <option value="Product Feedback">Product Feedback</option>
              <option value="Methodology Question">Methodology Question</option>
              <option value="Agency / Team Pilot">Agency / Team Pilot</option>
              <option value="Bug Report">Bug Report</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="contact-msg" className="block font-medium text-[#F3F7FF]">
              Message * (Do not include sensitive data or credentials)
            </label>
            <textarea
              id="contact-msg"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#06101F] px-3 py-2.5 text-[#F3F7FF]"
            />
          </div>

          <button
            type="submit"
            className="min-h-[42px] rounded-xl bg-[#1685FF] px-5 py-2.5 font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
          >
            Save Local Draft & Prepare Email Link
          </button>
        </form>

        {state.contactDrafts.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-2 text-xs">
            <h2 className="font-bold text-[#F3F7FF]">
              Saved Local Enquiry Drafts ({state.contactDrafts.length})
            </h2>
            {state.contactDrafts.map((d) => (
              <div key={d.id} className="rounded-lg border border-white/10 bg-[#06101F] p-3">
                <p className="font-medium text-[#F3F7FF]">
                  {d.enquiryType} · {d.name} ({d.email})
                </p>
                <p className="mt-1 text-[#AEBFD4]">{d.message}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </TrustGridShell>
  );
};

export const TrustGridPrivacyView: React.FC = () => {
  useDocumentMeta({
    title: 'Starter Privacy Notice — AURENYX TRUSTGRID',
    description:
      'Transparent starter privacy notice explaining local browser storage, export/deletion controls, and server API data flows.',
  });

  return (
    <TrustGridShell currentPageLabel="Privacy Notice">
      <article className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#0B1B30] p-6 sm:p-8 space-y-5 text-xs leading-relaxed text-[#AEBFD4]">
        <div className="space-y-1 border-b border-white/10 pb-4">
          <p className="font-mono text-[#FFD37A]">
            STARTER PRIVACY NOTICE TEMPLATE — REQUIRES LEGAL REVIEW BEFORE COMMERCIAL USE
          </p>
          <h1 className="text-2xl font-bold text-[#F3F7FF]">Privacy & Data Handling Notice</h1>
        </div>

        <section className="space-y-1.5">
          <h2 className="text-sm font-bold text-[#F3F7FF]">1. Actual Data Storage Behavior</h2>
          <p>
            By default, {TRUSTGRID_BRAND.productName} stores workflow descriptions, assessment
            answers, test outcomes, safeguard notes, Passports, and contact drafts locally inside
            your browser’s <code className="font-mono">localStorage</code> under the key{' '}
            <code className="font-mono">{TRUSTGRID_BRAND.storageKey}</code>. TrustGrid governance
            pages do not transmit your workflow records to external analytics or third-party servers.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-sm font-bold text-[#F3F7FF]">
            2. Parent Platform AI Assistant Flow (When Used)
          </h2>
          <p>
            If you use the {TRUSTGRID_BRAND.parentBrand} AI Chat or Knowledge features on{' '}
            <code className="font-mono">/</code>, prompts and attached files are sent to the
            application’s Express backend (<code className="font-mono">/api/*</code>) and processed
            through the configured Gemini API provider. Session memory on the server is temporary
            in-memory state and can be purged at any time in Settings.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-sm font-bold text-[#F3F7FF]">
            3. Browser Storage Limitations & Deletion Controls
          </h2>
          <p>
            Local browser storage is not encrypted multi-user cloud storage: anyone with access to
            your device profile can view it, and clearing browser site data deletes it permanently.
            You can export JSON backups or delete individual or all records at any time from{' '}
            <Link to="/reports" className="text-[#35C8FF] underline">
              /reports
            </Link>{' '}
            and{' '}
            <Link to="/dashboard" className="text-[#35C8FF] underline">
              /dashboard
            </Link>
            .
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-sm font-bold text-[#F3F7FF]">4. No Claim of Regulatory Compliance</h2>
          <p>
            This prototype notice describes actual software behavior honestly and does not claim
            GDPR, HIPAA, SOC 2, ISO, or statutory privacy certification. Do not enter sensitive
            personal data, customer secrets, or credentials into demonstration workflows.
          </p>
        </section>
      </article>
    </TrustGridShell>
  );
};

export const TrustGridTermsView: React.FC = () => {
  useDocumentMeta({
    title: 'Starter Terms Template — AURENYX TRUSTGRID',
    description:
      'Starter demonstration terms template covering prototype limitations, no safety certification, authorized testing only, and legal review requirements.',
  });

  return (
    <TrustGridShell currentPageLabel="Terms Template">
      <article className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#0B1B30] p-6 sm:p-8 space-y-5 text-xs leading-relaxed text-[#AEBFD4]">
        <div className="space-y-1 border-b border-white/10 pb-4">
          <p className="font-mono text-[#FFD37A]">
            STARTER DEMONSTRATION TEMPLATE — REQUIRES QUALIFIED LEGAL REVIEW BEFORE LAUNCH
          </p>
          <h1 className="text-2xl font-bold text-[#F3F7FF]">
            Demonstration Terms of Use (Template)
          </h1>
        </div>

        <section className="space-y-1.5">
          <h2 className="text-sm font-bold text-[#F3F7FF]">1. Early-Stage Prototype Scope</h2>
          <p>
            {TRUSTGRID_BRAND.productName} (under {TRUSTGRID_BRAND.parentBrand}) is provided “as-is”
            as an early-stage governance documentation and workflow review prototype. Features,
            scoring heuristics, and local storage formats may change.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-sm font-bold text-[#F3F7FF]">
            2. No Security Certification or Guarantee of AI Safety
          </h2>
          <p>
            Generating an AI Workflow Passport, completing an assessment, or marking test scenarios
            as passed does not constitute a security audit, third-party certification, or guarantee
            that an AI system is safe, accurate, or free of vulnerabilities.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-sm font-bold text-[#F3F7FF]">3. Authorized Testing Only</h2>
          <p>
            Users are solely responsible for ensuring that any safety checks recorded in the Test
            Scenario Library are performed strictly within systems, staging sandboxes, and accounts
            they are explicitly authorized to test.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-sm font-bold text-[#F3F7FF]">
            4. No Legal, Regulatory, or Compliance Advice
          </h2>
          <p>
            Nothing in {TRUSTGRID_BRAND.productName}, its provisional risk rules, safeguard
            descriptions, or exported reports constitutes legal, regulatory, or compliance advice.
            Consult qualified counsel and security professionals before deploying high-impact
            workflows or launching commercially.
          </p>
        </section>
      </article>
    </TrustGridShell>
  );
};

export const TrustGridFaqView: React.FC = () => {
  useDocumentMeta({
    title: 'Frequently Asked Questions — AURENYX TRUSTGRID',
    description:
      'Clear, honest answers to ten common questions about AURENYX TRUSTGRID, AI Workflow Passports, provisional risk scores, local storage, and exports.',
  });

  const faqs = [
    {
      q: '1. What is Aurenyx TrustGrid?',
      a: 'Aurenyx TrustGrid (created under AURENYX VÆLOR) is an AI workflow governance, risk documentation, and structured review tool that helps teams document AI workflows, evaluate provisional risk factors, record staging safety checks, and issue readable AI Workflow Passports.',
    },
    {
      q: '2. What is an AI Workflow Passport?',
      a: 'An AI Workflow Passport is a versioned internal review report summarizing a workflow’s owner, purpose, connected systems, data sensitivity, autonomy, provisional score breakdown, critical review flags, test scenario outcomes, recommended safeguards, and unresolved findings.',
    },
    {
      q: '3. Is TrustGrid a certification?',
      a: 'No. TrustGrid is a structured self-documentation and review product, not an independent audit, regulatory sign-off, or safety certification.',
    },
    {
      q: '4. Are risk scores scientifically validated?',
      a: 'No. Scores are computed using an explicitly provisional, deterministic point heuristic (TG-PROVISIONAL-0.1) so teams can see every contributing factor clearly. They do not fully model likelihood, severity, or domain-specific hazards.',
    },
    {
      q: '5. Does TrustGrid connect directly to my external AI systems?',
      a: 'No. TrustGrid does not connect to or run automated tests against your external production tools or customer systems. You document workflows and record outcomes from your own authorized test environments.',
    },
    {
      q: '6. Can I use it for free?',
      a: 'Yes. The entire TrustGrid workflow—assessments, risk rules, test scenarios, safeguards, interactive demo, and TXT/JSON/Print Passport exports—runs without requiring any paid AI API key or subscription.',
    },
    {
      q: '7. Is my data stored on a cloud server?',
      a: 'In this MVP, TrustGrid records are stored locally in your browser’s localStorage on your device. Because clearing browser data removes local records, use the Export Backup JSON feature on /reports to save offline backups.',
    },
    {
      q: '8. Can I export and print reports?',
      a: 'Yes. Every AI Workflow Passport can be downloaded as plain text (.txt), downloaded as structured JSON (.json), copied to your clipboard, or printed via a dedicated print-friendly stylesheet.',
    },
    {
      q: '9. How can I provide feedback?',
      a: 'Visit /contact to prepare a structured note using the local draft and mailto helper, or log feedback in your project’s GitHub repository.',
    },
    {
      q: '10. What should I validate before using it commercially?',
      a: 'Validate the provisional scoring weights with domain experts, add authenticated multi-tenant backend storage with access controls, replace placeholder contact details, and have qualified legal counsel review the Privacy and Terms templates.',
    },
  ];

  return (
    <TrustGridShell currentPageLabel="FAQ">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-[#F3F7FF]">
            Frequently Asked Questions
          </h1>
          <p className="text-xs text-[#AEBFD4]">
            Direct, realistic answers about capabilities, storage, and prototype boundaries.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((item) => (
            <section
              key={item.q}
              className="rounded-2xl border border-white/10 bg-[#0B1B30] p-5 space-y-1.5 text-xs"
            >
              <h2 className="text-sm font-bold text-[#F3F7FF]">{item.q}</h2>
              <p className="leading-relaxed text-[#AEBFD4]">{item.a}</p>
            </section>
          ))}
        </div>
      </div>
    </TrustGridShell>
  );
};

export const NotFoundView: React.FC = () => {
  useDocumentMeta({
    title: 'Page Not Found (404) — AURENYX VÆLOR & TRUSTGRID',
    description: 'The requested workspace or governance page could not be found.',
  });

  return (
    <TrustGridShell currentPageLabel="404 Not Found">
      <div className="mx-auto max-w-xl py-12 text-center space-y-5">
        <p className="font-mono text-sm text-[#35C8FF]">HTTP 404 · ROUTE NOT FOUND</p>
        <h1 className="text-3xl font-bold text-[#F3F7FF]">Page Not Found</h1>
        <p className="text-xs leading-relaxed text-[#AEBFD4]">
          The route you requested does not exist in AURENYX VÆLOR or AURENYX TRUSTGRID. Choose a
          destination below to continue.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2 text-xs">
          <Link
            to="/trustgrid"
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-4 py-2 font-semibold text-[#F3F7FF]"
          >
            <span>TrustGrid Home</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex min-h-[42px] items-center rounded-xl border border-white/15 bg-[#0B1B30] px-4 py-2 font-medium text-[#F3F7FF]"
          >
            Governance Dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex min-h-[42px] items-center rounded-xl border border-white/15 bg-[#0B1B30] px-4 py-2 font-medium text-[#F3F7FF]"
          >
            Vaelor AI Chat
          </Link>
        </div>
      </div>
    </TrustGridShell>
  );
};
