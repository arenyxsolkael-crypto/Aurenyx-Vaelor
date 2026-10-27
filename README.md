# AURENYX VAELOR & AURENYX TRUSTGRID (Version 0.1)

**Intelligence, Orchestrated.** • **Intelligence. Integrity. Infinity.**

> **Official Founding Attribution:**  
> *“AURENYX VAELOR — Founded by The Aether Vanguard, founded by Arenyx Sol Kael.”*
> - **Parent Platform:** AURENYX VAELOR (`v0.1.0`) — General-Purpose Multi-Agent AI Intelligence Platform
> - **Integrated Governance Feature Suite:** **AURENYX TRUSTGRID** (created under **AURENYX VÆLOR**) — *“Turn AI innovation into trust.”*
> - **Native Android Application:** `org.aethervanguard.aurenyxvaelor` (Kotlin + Jetpack Compose, API 26–35)
> - **Founder Organization:** The Aether Vanguard
> - **Founder of The Aether Vanguard:** Arenyx Sol Kael
> - **Software Budget:** ₹0 (free-tier and open-source tooling only)

---

## 1. Platform Overview & Feature Architecture

This repository delivers three cohesive, security-hardened layers inside one unified workspace:

### A. AURENYX VAELOR Core Assistant (`/`, `/overview`, `/research`, `/agents`, `/knowledge`, `/projects`, `/tasks`, `/settings`)
- **Multi-Agent Orchestrator (`src/server/orchestrator.ts`)**: Routes prompts across **Aurenyx Research**, **Vaelor Forge**, **Vaelor Knowledge**, **Vaelor Sentinel**, and **Vaelor Core** with a bounded 4-step ceiling.
- **Stage A–D Permissioned Tool Gateway (`src/server/tools.ts`)**: Zero-`eval` calculator, CSV analyzer, JSON validator, deterministic SVG chart builder, document chunk retrieval with passage citations, and honest `requires_config` gating for unconfigured external connectors.
- **Server-Side Security (`server.ts`, `src/server/validation.ts`)**: Strict Zod schemas, sliding-window rate limiting, secret-leak blocking, prompt-injection screening, and sanitized JSON error responses.

### B. AURENYX TRUSTGRID — AI Workflow Governance Suite (Integrated Inside App Features)
Accessible directly from the app sidebar and across dedicated routes:
- `/trustgrid` — **TrustGrid Home** (*“Turn AI innovation into trust.”*)
- `/product` & `/solutions` — Product capabilities & role-based governance workflows
- `/risk-rules` — **Transparent Provisional Risk Methodology (`TG-PROVISIONAL-0.1`)** + live interactive rule simulator (`0–3 Low`, `4–6 Moderate`, `7–9 High`, `10+ Critical`, plus explicit **Critical Review Flags**)
- `/assessment` — **15-Question Interactive Workflow Risk Assessment** (5-step wizard with conditional questions, validation, secret-pattern guard, and edit/rescore versioning)
- `/passport` — **25-Field Versioned AI Workflow Passport Generator** (`v1`, `v2`, ... with `.txt` export, `.json` export, clipboard copy, and print-clean `@media print` stylesheet; clearly separates user-entered, rule-generated, self-reported, and unverified items)
- `/testing` — **8 Pre-Built Safety Test Scenarios + Custom Scenario Builder** (Prompt Injection, System Prompt Leakage, PII Disclosure, Hallucinated Citations, Unauthorized Actions, Unsafe Advice, Overconfident Output, Policy Bypass)
- `/safeguards` — **12-Category Safeguard Checklist & Notes Tracker**
- `/dashboard` & `/reports` — **Saved Assessments, Version History, JSON Backup Export/Import & Delete Confirmation** (`localStorage` key `aurenyx.trustgrid.state.v1`)
- `/demo` — **Zero-API-Key Interactive Sandbox** (clearly badged `[SAMPLE DEMO RECORD]`)
- `/implementation`, `/faq`, `/contact` (honest local-draft + `mailto:` fallback), `/privacy` & `/terms` (starter templates labeled *Not legal advice*), `/about`, and custom `*` 404 route.

### C. Native Android Application (`/android` + Web Companion View at `/android`)
- **Kotlin + Jetpack Compose (`android/app/`)**: Package `org.aethervanguard.aurenyxvaelor`, `minSdk = 26`, `targetSdk = 35`.
- **Zero Embedded Secrets**: Verified by automated source audit (`/api/android/status`); supports **Secure Backend Orchestration** over HTTPS plus **Firebase AI Logic + Play Integrity App Check** (`FirebaseAiLogicGateway.kt`).
- **Private On-Device Chat History**: Sandboxed `filesDir` JSON store excluded from cloud auto-backup (`android:allowBackup="false"`) with per-thread and full-history deletion confirmation.
- **Explicit UX States**: Loading, Offline, Timeout, Quota-Limited (`HTTP 429`), and Sanitized Error states with retry controls.

---

## 2. Local Setup & Running (Web + Backend)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and add your free-tier Gemini API key on the server only:
   ```bash
   cp .env.example .env
   ```
   *(Note: AURENYX TRUSTGRID, `/demo`, `/assessment`, `/passport`, `/testing`, `/safeguards`, and `/reports` work 100% offline with zero API keys required.)*
3. Run the server on `http://localhost:3000`:
   ```bash
   npm run dev
   ```

---

## 3. Running Tests & Builds

### Web & Backend Unit + Integration Tests
```bash
npx --yes tsx --test src/server/vaelor.test.ts
npm run lint
npm run build
```

### Native Android Unit Tests & Debug APK Build
```bash
cd android
gradle testDebugUnitTest assembleDebug --no-daemon
```
See [`docs/GOOGLE_PLAY_INTERNAL_TESTING.md`](docs/GOOGLE_PLAY_INTERNAL_TESTING.md) for keystore generation, Firebase App Check registration, and Google Play Internal Testing submission steps.

---

## 4. Free Deployment Options (₹0 Budget)

- **TrustGrid Static / Client Mode**: Deploy `npm run build` (`dist/`) to **Cloudflare Pages**, **Vercel Hobby**, or **Netlify Free** for ₹0 static hosting (all TrustGrid assessments, Passports, and JSON backups run in the browser).
- **Full-Stack Vaelor + TrustGrid + Android Backend**: Deploy `server.ts` on **Google Cloud Run** (free monthly request/CPU tier) or **Render Free Web Service** with `GEMINI_API_KEY` stored strictly in server secret environment variables.

---

**AURENYX VAELOR & AURENYX TRUSTGRID**  
Founded by The Aether Vanguard, founded by Arenyx Sol Kael.
