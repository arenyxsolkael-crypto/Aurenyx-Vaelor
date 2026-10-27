# Beginner Android-Browser Development & ₹0 Deployment Guide

> **Official Founding Attribution:**  
> *“AURENYX VAELOR — Founded by The Aether Vanguard, founded by Arenyx Sol Kael.”*

This guide is tailored for a solo beginner developing, testing, and deploying **AURENYX VAELOR (Version 0.1)** primarily from an **Android phone** with a **₹0 software budget**.

---

## Part 1: Developing & Operating from an Android Phone

Because Android browsers do not run a local Node.js backend directly inside browser tabs, use a cloud workspace (Google AI Studio Build, GitHub Codespaces Free Tier, or Gitpod Free Tier):

1. **Keep Secrets in the Server Panel Only:**
   - Open your workspace **Settings → Secrets** (or environment variables panel) and set `GEMINI_API_KEY`.
   - Never paste real keys into chat prompts, `src/` files, screenshots, or `.env.example`.
   - Never rename `GEMINI_API_KEY` to `VITE_GEMINI_API_KEY` (variables prefixed with `VITE_` are bundled into public browser code).
2. **Mobile Navigation, Attachments & Voice Dictation:**
   - Tap the top-left menu button (`44×44px` touch target) to open the slide-over drawer (`Chat`, `Overview`, `Research`, `Projects`, `Agents`, `Knowledge`, `Tasks`, `About`, `Settings`), search conversations, rename threads, or switch **Light / Dark** themes.
   - In **Chat**, tap the attachment icon to upload `.txt`, `.md`, `.csv`, `.json`, or images (`PNG`/`JPEG`/`WEBP` ≤ 1 MB) from your Android storage for instant server-side analysis.
   - Tap the microphone button on Chrome for Android to dictate prompts via the browser Web Speech API (zero server cost).
3. **Installing AURENYX VAELOR as an Android PWA:**
   - Open the deployed HTTPS URL directly in Chrome on Android (outside any preview `<iframe>`).
   - Tap **Install Vaelor App** inside **Settings** or the sidebar, or tap Chrome's `⋮` menu → **Install app / Add to Home screen**.
   - Static shell assets cache locally while `/api/*` enforces `NetworkOnly` privacy rules.

---

## Part 2: Free-Tier Hosting & Deployment Options (₹0 Budget Check)

Because AURENYX VAELOR uses a **server-side Express API** (`/api/*`) to protect `GEMINI_API_KEY` and run the Stage A–D Tool Gateway, pure static hosts (such as GitHub Pages alone) cannot host the backend by themselves. Use one of these verified ₹0 paths:

### Option A: Built-in AI Studio Applet Hosting (Recommended Zero-Setup)
- Runs `npm run build` and `node server.ts` directly with automatic `GEMINI_API_KEY` injection.
- Cost: ₹0 using verified free-tier Gemini models (`gemini-3.1-flash-lite`, configurable via `GEMINI_MODEL`).

### Option B: Render.com Free Web Service (Node.js Full-Stack)
- **Free-Tier Limits:**
  - ₹0 / $0 monthly cost; spins down after ~15 minutes of idle time (~30–50s cold-start wake).
  - Ephemeral disk: server RAM resets on restart.
- **Setup:**
  1. Push your code to a private GitHub repository from your Android browser.
  2. Create a Render **Web Service** (`Free` plan).
  3. Build Command: `npm install && npm run build`
  4. Start Command: `NODE_ENV=production npm start`
  5. Environment Variables: `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.1-flash-lite`, `GEMINI_FAST_MODEL=gemini-3.1-flash-lite`, `ENABLE_PAID_MODELS=false`.

### Option C: Connecting Supabase Free for Durable Multi-Device Sync (Future Stage D)
1. Create a free **Supabase** project (500 MB PostgreSQL + Auth; pauses after 7 days of inactivity).
2. Create user-scoped tables (`projects`, `conversations`, `messages`, `saved_memories`, `task_runs`) with `user_id uuid references auth.users(id) not null`.
3. Enable **Row-Level Security (RLS)** (`auth.uid() = user_id`) on every table and verify the Supabase JWT server-side in Express before any database read/write.

---

## Part 3: Beginner Troubleshooting Quick Reference

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| **Gateway shows "Missing GEMINI_API_KEY"** | Key not injected into server environment | Add `GEMINI_API_KEY` in AI Studio **Secrets** or `.env`, restart server, and tap **Refresh status** in `/settings`. |
| **HTTP 429 Rate Limit / Quota** | Sliding-window rate limit (20 req/min) or Gemini free quota | Wait 30–60 seconds and tap **Retry Request** in Chat. |
| **Attachment Rejected** | File > 1 MB or unsupported binary PDF | Keep files under 1 MB; for PDFs, copy/paste text into **Knowledge** or attach `.txt`/`.md`/`.csv`/`.json`. |
| **Conversations Reset on Refresh** | Default privacy mode is Session Only | Enable **Persist Locally** under **Settings → Opt-In Local Browser Persistence** if you want local browser retention. |

---

**AURENYX VAELOR**  
An intelligent platform by The Aether Vanguard.  
Founded by The Aether Vanguard, founded by Arenyx Sol Kael.
