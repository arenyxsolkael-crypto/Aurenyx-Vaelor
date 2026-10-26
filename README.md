# AURENYX VAELOR 0.1
**Intelligence, Orchestrated.**

A mobile-first React + TypeScript PWA-ready AI assistant prototype with an Express backend, server-side Gemini model gateway, bounded task routing, specialist agent roles, and a second-pass answer review.

## What works in this starter
- Responsive chat interface and navigation.
- Backend health check and configuration state.
- Server-side Gemini API integration.
- Simple task classification into Core, Research, Forge, or Knowledge.
- Bounded two-call response + review workflow (maximum four calls is the intended ceiling; current implementation uses two).
- Request validation, 12 requests/minute per IP prototype limiter, timeouts, and safe provider error handling.
- PWA manifest, icon, and conservative static-asset service worker.

## Honest limitations
- No live web search integration.
- No persistent database, accounts, file uploads, or long-term memory yet.
- Agent roles currently route to one provider model; they are not independent autonomous models.
- The critic pass is not a guarantee of factual accuracy.
- The in-memory rate limiter is for prototypes only.
- The default model name may need to be changed to one currently available to your API key.
- PWA installability depends on secure hosting and browser support.
- This is a starter project, not a production-certified service.

## Requirements
Node.js 20+ is recommended. If you only have an Android phone, use a browser-based development workspace that supports importing a ZIP/repository, running Node.js, and setting server-side environment variables.

## Local setup
1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env`.
3. Add your API key to `GEMINI_API_KEY` and select a currently supported model in `GEMINI_MODEL`.
4. Run the frontend in one terminal:
   `npm run dev`
5. Run the API in another terminal:
   `npm run server`

The Vite development server runs on port 5173 and the API runs on port 8787. For local development, configure a Vite proxy or use the hosting environment's API routing. See `vite.config.ts` for the frontend setup; the API proxy is intentionally not silently assumed.

## Add a Vite API proxy for local development
Add this to `vite.config.ts` inside the `defineConfig` object:
```ts
server: {
  host: '0.0.0.0',
  proxy: { '/api': 'http://localhost:8787' }
}
```
If editing the existing `server` property, merge both `host` and `proxy`.

## Secret handling
- Never place a real API key in `src/`, `public/`, frontend environment variables, screenshots, or a public repository.
- Configure `GEMINI_API_KEY` using the backend's secret manager or local `.env`.
- Do not commit `.env`.
- Use non-sensitive test data with free-tier APIs and review provider data-use terms.
- The API currently uses CORS origin configuration, request limits, a timeout, and a lightweight in-memory rate limiter. Add authentication, durable rate limiting, and database access policies before external multi-user use.

## Build check
Run:
`npm run build`

## Android-first workflow
1. Download this ZIP on your Android device.
2. Open your preferred browser-based IDE or full-stack app builder.
3. Import/upload the ZIP or extract it and import the project.
4. Ask the builder to run the build and resolve any TypeScript/runtime issues.
5. Configure `GEMINI_API_KEY` as a backend secret, not in chat messages or frontend files.
6. Configure `/api/*` routing to the Express backend.
7. Test missing-key and invalid-key behavior before connecting real usage.
8. Deploy only on a free tier that supports the required backend runtime and secret management.

## Suggested next milestones
1. Add a proper Vite proxy and test scripts.
2. Add authentication and Supabase RLS before persistent personal data.
3. Add safe document text extraction.
4. Add a real web-search integration only after selecting a provider.
5. Add structured tool calling and approval gates.
6. Add automated evaluation tests and durable rate limits.
