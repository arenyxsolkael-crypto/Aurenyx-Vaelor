import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Smartphone, Wrench } from 'lucide-react';
import { OFFICIAL_ATTRIBUTION } from '../shared/types';
import { TRUSTGRID_BRAND } from '../shared/trustgridEngine';
import { VaelorEmblem } from '../components/VaelorEmblem';
import { TrustGridBrandMark } from '../components/TrustGridBrandMark';
import { OfficialFooter } from '../components/OfficialFooter';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const TRUSTGRID_PRINCIPLES = [
  {
    title: '01. Transparent Assumptions',
    body: 'Every risk score displays the exact point table, methodology version, and contributing answers rather than hiding behind opaque formulas.',
  },
  {
    title: '02. Evidence Over Unsupported Claims',
    body: 'User-entered workflow descriptions, rule-generated recommendations, and self-reported test checks are labeled distinctly without claiming external verification.',
  },
  {
    title: '03. Clear Human Accountability',
    body: 'Every AI Workflow Passport names a human workflow owner, reviewer, and remediation owner with target review dates.',
  },
  {
    title: '04. Continuous Improvement',
    body: 'Historical assessment and Passport snapshots are preserved whenever workflows, safeguards, or provisional rules are updated.',
  },
  {
    title: '05. Responsible AI Workflow Review',
    body: 'Safety checks are recorded strictly in authorized environments using synthetic data—never automated external attacks or real customer secrets.',
  },
];

const CAPABILITY_AUDIT = [
  {
    item: '01. Mission Control & Dependency-Aware DAG Orchestration (v0.4)',
    status: 'Implemented',
    notes: 'Dependency-ordered subtasks, proposed vs. executed distinction, human approval gates for consequential steps, pause/resume/cancel/retry, and strict step/time/call bounds.',
  },
  {
    item: '02. Project-Isolated Memory & Context Injection Controls',
    status: 'Implemented',
    notes: 'Per-project memory isolation (zero cross-project leakage), approved note/decision/goal/summary/reference items, global + per-project injection toggles, and JSON export.',
  },
  {
    item: '03. 7-Stage Deep Research & Claim-to-Source Matrix',
    status: 'Implemented',
    notes: 'Clarification, grounded search, source collection, comparison, synthesis, verification, and final report with source URLs, access dates, and unsupported-claim flags.',
  },
  {
    item: '04. Aether Vanguard Council & Adaptive Model Router',
    status: 'Implemented',
    notes: 'Researcher, Engineer, Strategist, and Skeptical Reviewer roles with explicit single- vs. multi-model honesty disclosure, call budgets, and ₹0 cost guardrails.',
  },
  {
    item: '05. Secure Non-Executing Coding Lab & Sentinel Epistemic Audit',
    status: 'Implemented',
    notes: 'Multi-file editor, static AST/regex security inspection, node:test synthesis, script-stripped sandboxed HTML/SVG preview (executedCode: false), and verified fact vs. inference audit.',
  },
  {
    item: '06. Aurenyx TrustGrid Governance & Native Android Suite',
    status: 'Implemented',
    notes: '15-question risk assessment, provisional risk rules, 8+ test scenarios, Passport export, plus full Kotlin + Jetpack Compose Android project in /android.',
  },
  {
    item: '07. Multimodal Workspace & Untrusted Input Isolation',
    status: 'Partial (Text + Image Scope)',
    notes: 'PNG/JPEG/WEBP/GIF images and .txt/.md/.csv/.json up to 1 MB wrapped in <untrusted_data> boundaries; binary PDF OCR excluded on ₹0 tier.',
  },
  {
    item: '08. Studio Raster Image Generation & Cloud Firestore Sync',
    status: '₹0 Guardrail / Verified Auth Sync',
    notes: 'Paid models blocked unless ENABLE_PAID_MODELS=true; Firestore persistence active for verified accounts with local session fallback.',
  },
];

export const AboutView: React.FC = () => {
  useDocumentMeta({
    title: 'About AURENYX VÆLOR & AURENYX TRUSTGRID',
    description:
      'Official identity, founding attribution, TrustGrid governance principles, and transparent capability audit.',
  });

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-10">
        {/* 1. Parent Platform Identity & Founding Attribution */}
        <section className="rounded-2xl border border-white/10 bg-[#13111d] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <VaelorEmblem size="md" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
                {OFFICIAL_ATTRIBUTION.productName} &amp; {TRUSTGRID_BRAND.productName}
              </h1>
              <p className="text-xs text-[#a58ff8]">
                Version {OFFICIAL_ATTRIBUTION.version} ({OFFICIAL_ATTRIBUTION.releaseTitle}) ·{' '}
                {OFFICIAL_ATTRIBUTION.tagline} · {TRUSTGRID_BRAND.tagline}
              </p>
              <p className="mt-0.5 text-xs text-[#b5add0]">
                {OFFICIAL_ATTRIBUTION.secondaryBrandLine}
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold text-[#ece8f6]">{OFFICIAL_ATTRIBUTION.statement}</p>

          <p className="text-sm leading-relaxed text-[#b5add0]">
            {OFFICIAL_ATTRIBUTION.aboutStatement}
          </p>

          <div className="grid grid-cols-1 gap-4 border-t border-white/8 pt-4 text-xs sm:grid-cols-3">
            <div>
              <p className="text-[#8f88a3]">Founder Organization</p>
              <p className="mt-0.5 font-semibold text-[#f5f3fc]">
                {OFFICIAL_ATTRIBUTION.founderOrganization}
              </p>
            </div>
            <div>
              <p className="text-[#8f88a3]">Founder</p>
              <p className="mt-0.5 font-semibold text-[#f5f3fc]">
                {OFFICIAL_ATTRIBUTION.founderName}
              </p>
            </div>
            <div>
              <p className="text-[#8f88a3]">Engineering Posture</p>
              <p className="mt-0.5 font-semibold text-[#f5f3fc]">
                ₹0 Free-Tier · Web + Native Android · Honest Scope
              </p>
            </div>
          </div>
        </section>

        {/* 2. Aurenyx TrustGrid Vision & Five Core Principles */}
        <section className="rounded-2xl border border-[#1685FF]/30 bg-[#0B1B30] p-6 sm:p-8 space-y-5 text-[#F3F7FF]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TrustGridBrandMark size="md" />
              <div>
                <p className="text-xs font-medium text-[#35C8FF]">
                  {TRUSTGRID_BRAND.productName} · UNDER {TRUSTGRID_BRAND.parentBrand}
                </p>
                <h2 className="text-xl font-bold text-[#F3F7FF]">
                  “{TRUSTGRID_BRAND.aboutVision}”
                </h2>
              </div>
            </div>
            <Link
              to="/trustgrid"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1685FF] px-4 py-2 text-xs font-semibold text-[#F3F7FF] hover:bg-[#2b92ff]"
            >
              <span>Open TrustGrid Suite</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <p className="text-xs leading-relaxed text-[#AEBFD4]">
            {TRUSTGRID_BRAND.productName} helps agencies, small businesses, internal engineering
            teams, and consultants review AI workflows honestly—without claiming company
            registrations, external partnerships, regulatory certifications, or unproven safety
            guarantees.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 text-xs">
            {TRUSTGRID_PRINCIPLES.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-white/10 bg-[#06101F] p-4 space-y-1.5"
              >
                <h3 className="font-semibold text-[#F3F7FF]">{p.title}</h3>
                <p className="leading-relaxed text-[#AEBFD4]">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Transparent Feature & Capability Audit */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[#a58ff8]" />
            <h2 className="text-lg font-bold text-[#f6f4fc]">
              Transparent Platform Capability Audit
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#13111d]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/8 text-[#958ea8]">
                <tr>
                  <th className="px-4 py-3 font-medium">Capability</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Implementation Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-[#ddd8ec]">
                {CAPABILITY_AUDIT.map((row) => (
                  <tr key={row.item} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-[#f5f3fc] whitespace-nowrap">
                      {row.item}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-[11px] whitespace-nowrap ${
                        row.status === 'Implemented'
                          ? 'text-emerald-300'
                          : row.status.startsWith('Partial') || row.status.startsWith('Local')
                            ? 'text-[#c5b3fc]'
                            : 'text-amber-300'
                      }`}
                    >
                      {row.status}
                    </td>
                    <td className="px-4 py-3 text-[#b5add0]">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Security & Native Android Summary */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#f5f3fc]">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <h2>Security & Privacy Guardrails</h2>
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-[#b5add0]">
              <li>
                • <strong className="text-[#ece8f6]">Zero Client Secrets:</strong>{' '}
                <code className="font-mono">GEMINI_API_KEY</code> lives strictly on the backend;
                neither web bundles nor Android Kotlin/APK files contain server secrets.
              </li>
              <li>
                • <strong className="text-[#ece8f6]">Server Rate Limits & Sanitized Errors:</strong>{' '}
                Sliding-window rate limits, Zod input validation, per-agent tool allowlists, and
                redacted error responses.
              </li>
              <li>
                • <strong className="text-[#ece8f6]">User-Controlled Deletion:</strong> One-tap
                session purge in Web Settings, JSON export/delete in TrustGrid Reports, and private
                on-device wipe in the Android app.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#f5f3fc]">
              <Smartphone className="h-4 w-4 text-[#a58ff8]" />
              <h2>Native Android Kotlin + Compose Edition</h2>
            </div>
            <p className="text-xs leading-relaxed text-[#b5add0]">
              Inspect the native Kotlin &amp; Jetpack Compose Android application (
              <code className="font-mono">org.aethervanguard.aurenyxvaelor</code>), verify its
              security checks, simulate mobile states, and download the complete Android Studio
              source bundle.
            </p>
            <Link
              to="/android"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#8b6ff7] px-4 py-2 text-xs font-semibold text-[#0b0a10]"
            >
              <span>Open Native Android &amp; Play Hub</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>

      <OfficialFooter />
    </div>
  );
};
