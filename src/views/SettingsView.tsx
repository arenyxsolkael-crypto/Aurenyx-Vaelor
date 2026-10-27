import React, { useState } from 'react';
import {
  CheckCircle2,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { OfficialFooter } from '../components/OfficialFooter';

export const SettingsView: React.FC = () => {
  const {
    theme,
    setTheme,
    localPersistenceEnabled,
    setLocalPersistenceEnabled,
    streamingEnabled,
    setStreamingEnabled,
    gatewayState,
    health,
    refreshHealth,
    conversations,
    documents,
    memories,
    projects,
    tasks,
    purgeSessionData,
  } = useWorkspace();

  const [purgeFeedback, setPurgeFeedback] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshHealth();
    setRefreshing(false);
  };

  const handlePurge = async (
    scope: 'conversations' | 'memories' | 'documents' | 'tasks' | 'all',
    label: string
  ) => {
    await purgeSessionData(scope);
    setPurgeFeedback(`Cleared ${label}.`);
    setTimeout(() => setPurgeFeedback(null), 3000);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
          Settings, Security & Deployment
        </h1>
        <p className="text-sm text-[#9e97b0]">
          Inspect server-side model gateway readiness, manage temporary session memory, install the
          PWA, and review Android-friendly ₹0 setup guidelines.
        </p>
      </div>

      {/* 0. Appearance, Streaming & Local Persistence Preferences */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#f5f3fc]">
            Workspace Preferences & Appearance
          </h2>
          <p className="text-xs text-[#958ea8]">
            Customize theme contrast, real-time Server-Sent Events streaming, and opt-in local
            browser conversation storage.
          </p>
        </div>

        <div className="divide-y divide-white/8 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div>
              <p className="font-semibold text-[#f1eef9]">Appearance Theme</p>
              <p className="text-[#958ea8]">
                Switch between Midnight Obsidian dark mode and high-contrast daylight mode.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#0e0c16] p-1">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  theme === 'dark'
                    ? 'bg-[#7c5dfa] text-white'
                    : 'text-[#a59ec0] hover:text-[#f5f3fc]'
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  theme === 'light'
                    ? 'bg-[#7c5dfa] text-white'
                    : 'text-[#a59ec0] hover:text-[#f5f3fc]'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                <span>Light</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div>
              <p className="font-semibold text-[#f1eef9]">Real-Time SSE Token Streaming</p>
              <p className="text-[#958ea8]">
                Stream incremental specialist tokens and live stage events over /api/chat/stream.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#0e0c16] p-1">
              <button
                type="button"
                onClick={() => setStreamingEnabled(true)}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  streamingEnabled
                    ? 'bg-[#7c5dfa] text-white'
                    : 'text-[#a59ec0] hover:text-[#f5f3fc]'
                }`}
              >
                SSE Stream
              </button>
              <button
                type="button"
                onClick={() => setStreamingEnabled(false)}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  !streamingEnabled
                    ? 'bg-[#7c5dfa] text-white'
                    : 'text-[#a59ec0] hover:text-[#f5f3fc]'
                }`}
              >
                Standard JSON
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div className="max-w-lg">
              <p className="font-semibold text-[#f1eef9]">Opt-In Local Browser Persistence</p>
              <p className="text-[#958ea8]">
                Keep conversation threads in local browser storage across page reloads on your
                device. Turning this off immediately wipes saved local browser threads.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#0e0c16] p-1">
              <button
                type="button"
                onClick={() => setLocalPersistenceEnabled(false)}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  !localPersistenceEnabled
                    ? 'bg-[#7c5dfa] text-white'
                    : 'text-[#a59ec0] hover:text-[#f5f3fc]'
                }`}
              >
                Session Only
              </button>
              <button
                type="button"
                onClick={() => setLocalPersistenceEnabled(true)}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  localPersistenceEnabled
                    ? 'bg-[#7c5dfa] text-white'
                    : 'text-[#a59ec0] hover:text-[#f5f3fc]'
                }`}
              >
                Persist Locally
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 1. Model Gateway Status */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#f5f3fc]">Model Gateway Status</h2>
            <p className="text-xs text-[#958ea8]">
              Credentials are read exclusively on the backend via server environment variables.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/12 bg-[#0e0c16] px-3 py-1.5 text-xs font-medium text-[#e4dff2] hover:border-white/25 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh status</span>
          </button>
        </div>

        <div className="divide-y divide-white/8 text-xs">
          <div className="flex items-center justify-between py-3">
            <span className="text-[#a59ec0]">Gateway Connection</span>
            <span className="font-medium text-[#f5f3fc]">
              {gatewayState === 'ready'
                ? 'Connected & Configured'
                : gatewayState === 'setup'
                  ? 'Backend Online · Missing GEMINI_API_KEY'
                  : gatewayState === 'offline'
                    ? 'Backend Offline'
                    : 'Checking…'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-[#a59ec0]">Provider Adapter</span>
            <span className="font-mono text-[#e4dff2]">
              {health?.provider || 'Gemini API (@google/genai)'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-[#a59ec0]">Primary Specialist Model</span>
            <span className="font-mono text-[#e4dff2]">
              {health?.primaryModel || 'gemini-3.1-flash-lite (Free-Tier Verified)'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-[#a59ec0]">Fast Sentinel / Classifier Model</span>
            <span className="font-mono text-[#e4dff2]">
              {health?.fastModel || 'gemini-3.1-flash-lite (Free-Tier Eligible)'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-[#a59ec0]">₹0 Budget Guardrail</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              <span>
                {health?.paidModelsEnabled
                  ? 'Paid Models Enabled'
                  : 'Active (Paid Models Disabled)'}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-[#a59ec0]">Execution & Rate Ceilings</span>
            <span className="font-mono tabular-nums text-[#e4dff2]">
              Max {health?.maxStepsPerRequest ?? 4} calls/task · {health?.rateLimitPerMinute ?? 20}{' '}
              req/min
            </span>
          </div>
        </div>
      </section>

      {/* 2. Privacy & Separated Data Controls */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#f5f3fc]">
            Privacy & Session Memory Controls
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#958ea8]">
            {health?.storageNotice ||
              'Temporary in-memory session state is active. Records are not persisted to an external database yet.'}
          </p>
        </div>

        {purgeFeedback && (
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>{purgeFeedback}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-[#0e0c16] p-3.5">
            <div>
              <p className="text-xs font-semibold text-[#f1eef9]">Conversations</p>
              <p className="font-mono text-xs tabular-nums text-[#958ea8]">
                {conversations.length} active threads
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handlePurge('conversations', 'conversation history')}
              className="min-h-[40px] rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#cfc8e2] hover:border-rose-500/40 hover:text-rose-300"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-[#0e0c16] p-3.5">
            <div>
              <p className="text-xs font-semibold text-[#f1eef9]">Saved User Memories</p>
              <p className="font-mono text-xs tabular-nums text-[#958ea8]">
                {memories.length} explicit notes
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handlePurge('memories', 'saved user memories')}
              className="min-h-[40px] rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#cfc8e2] hover:border-rose-500/40 hover:text-rose-300"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-[#0e0c16] p-3.5">
            <div>
              <p className="text-xs font-semibold text-[#f1eef9]">Indexed Documents</p>
              <p className="font-mono text-xs tabular-nums text-[#958ea8]">
                {documents.length} session documents
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handlePurge('documents', 'indexed documents')}
              className="min-h-[40px] rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#cfc8e2] hover:border-rose-500/40 hover:text-rose-300"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-[#0e0c16] p-3.5">
            <div>
              <p className="text-xs font-semibold text-[#f1eef9]">Task Logs & Projects</p>
              <p className="font-mono text-xs tabular-nums text-[#958ea8]">
                {tasks.length} runs · {projects.length} projects
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handlePurge('tasks', 'task execution logs')}
              className="min-h-[40px] rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#cfc8e2] hover:border-rose-500/40 hover:text-rose-300"
            >
              Clear Logs
            </button>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => void handlePurge('all', 'all session data')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900/40"
          >
            <Trash2 className="h-4 w-4" />
            <span>Purge All Session Data</span>
          </button>
        </div>
      </section>

      {/* 3. PWA & Multiplatform Support */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#f5f3fc]">
              Progressive Web App (Android & Desktop)
            </h2>
            <p className="text-xs text-[#958ea8]">
              Manifest: Aurenyx Vaelor (Vaelor) · Standalone display · Static-only asset caching
            </p>
          </div>
          <PWAInstallButton alwaysShowGuideFallback />
        </div>
        <p className="text-xs leading-relaxed text-[#a8a1bd]">
          The service worker caches static UI bundles, fonts, and icons for fast startup and offline
          shell viewing, while enforcing <code className="font-mono">NetworkOnly</code> rules on all{' '}
          <code className="font-mono">/api/*</code> routes so private chat messages are never stored
          in shared browser caches.
        </p>
      </section>

      {/* 4. Beginner Android Phone & ₹0 Deployment Reference */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold text-[#f5f3fc]">
          <Smartphone className="h-4 w-4 text-[#a58ff8]" />
          <h2>Beginner Android Workflow & ₹0 Free-Tier Notes</h2>
        </div>
        <ul className="space-y-2 text-xs leading-relaxed text-[#b5add0]">
          <li>
            • <strong className="text-[#ece8f6]">Secrets on Android:</strong> Manage{' '}
            <code className="font-mono">GEMINI_API_KEY</code> strictly via your workspace Secrets
            panel—never type real keys into chat prompts, frontend files, or public GitHub commits.
          </li>
          <li>
            • <strong className="text-[#ece8f6]">Free-Tier Persistence Next Step:</strong> When
            ready for durable accounts and storage, connect Supabase Free PostgreSQL with Row-Level
            Security (<code className="font-mono">auth.uid() = user_id</code>) verified server-side.
          </li>
          <li>
            • <strong className="text-[#ece8f6]">Honest Version 0.1 Scope:</strong> Live web search
            providers, binary scanned PDF OCR, and paid studio raster image models are intentionally
            disconnected to preserve your ₹0 budget without fabricated results.
          </li>
        </ul>
      </section>

      <OfficialFooter />
    </div>
  );
};
