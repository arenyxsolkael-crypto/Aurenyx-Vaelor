import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Mail,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { OfficialFooter } from '../components/OfficialFooter';
import { BLUEPRINT_CONSTRAINTS } from '../lib/firebase';

export const SettingsView: React.FC = () => {
  const {
    user,
    authBusy,
    authError,
    authNotice,
    authConfig,
    serverAccount,
    resendVerificationEmail,
    refreshVerificationStatus,
    requestPasswordReset,
    updateAccountDisplayName,
    logout,
    cancelAccount,
  } = useAuth();

  const {
    theme,
    setTheme,
    localPersistenceEnabled,
    setLocalPersistenceEnabled,
    streamingEnabled,
    setStreamingEnabled,
    mockMode,
    setMockMode,
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

  const navigate = useNavigate();

  const [displayNameDraft, setDisplayNameDraft] = useState(() => user?.displayName || '');
  const [purgeFeedback, setPurgeFeedback] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Inline 2-step Account Cancellation state (never uses window.confirm / window.alert)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');

  const hasPasswordProvider = Boolean(
    user?.providerData?.some((p) => p.providerId === 'password')
  );
  const hasGoogleProvider = Boolean(
    user?.providerData?.some((p) => p.providerId === 'google.com')
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshHealth();
    setRefreshing(false);
  };

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateAccountDisplayName(displayNameDraft);
  };

  const handlePurge = async (
    scope: 'conversations' | 'memories' | 'documents' | 'tasks' | 'all',
    label: string
  ) => {
    await purgeSessionData(scope);
    setPurgeFeedback(`Cleared ${label}.`);
    setTimeout(() => setPurgeFeedback(null), 3000);
  };

  const handleLogoutClick = async () => {
    await logout();
    void navigate('/overview');
  };

  const handleAccountCancellation = async (opts?: {
    reauthPassword?: string;
    reauthWithGoogle?: boolean;
  }) => {
    const res = await cancelAccount(opts);
    if (res.ok) {
      void navigate('/overview', { replace: true });
      return;
    }
    if (res.requiresRecentLogin) {
      setNeedsReauth(true);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
          Account, Privacy & System Settings
        </h1>
        <p className="text-sm text-[#9e97b0]">
          Manage your Firebase-authenticated account, verify email status, control private workspace
          data, inspect server-side Gemini gateway readiness, and review Android setup steps.
        </p>
      </div>

      {/* 1. Authenticated Account, Providers & Account Cancellation */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-base font-semibold text-[#f5f3fc]">
              <UserCheck className="h-4 w-4 text-emerald-400" />
              <h2>Authenticated Account & Identity</h2>
            </div>
            <p className="text-xs text-[#958ea8]">
              Verified on server via RS256 Firebase ID tokens ·{' '}
              <code className="font-mono text-[#cfc8e2]">
                geminiKeyExposedToUser: {String(serverAccount?.geminiKeyExposedToUser ?? false)}
              </code>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleLogoutClick()}
            disabled={authBusy}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/12 bg-[#0e0c16] px-3.5 py-1.5 text-xs font-medium text-[#e4dff2] hover:border-white/25 whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>

        {authError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-950/30 p-3 text-xs text-rose-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <span>{authError}</span>
          </div>
        )}

        {authNotice && !authError && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-3 text-xs text-emerald-200"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span>{authNotice}</span>
          </div>
        )}

        <div className="divide-y divide-white/8 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="text-[#a59ec0]">Account Email</span>
            <span className="font-mono text-[#f5f3fc]">{user?.email || 'No email attached'}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="text-[#a59ec0]">Account UID (Server Ownership Key)</span>
            <span className="font-mono text-[#cfc8e2]">{user?.uid || '—'}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="text-[#a59ec0]">Linked Sign-In Providers</span>
            <span className="font-mono text-[#e4dff2]">
              {user?.providerData?.map((p) => p.providerId).join(' · ') ||
                serverAccount?.signInProvider ||
                'firebase'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <span className="text-[#a59ec0]">Email Verification & Firestore Sync</span>
              <p className="text-[11px] text-[#87809b]">
                Cloud Firestore rules require <code className="font-mono">email_verified == true</code>{' '}
                before writing cloud projects or memories.
              </p>
            </div>
            {user?.emailVerified ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300 whitespace-nowrap">
                <CheckCircle2 className="h-4 w-4" />
                <span>Verified · Cloud Sync Active</span>
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-amber-300">Unverified</span>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void resendVerificationEmail()}
                  className="min-h-[36px] rounded-lg border border-white/12 bg-[#0e0c16] px-2.5 py-1 text-xs text-[#e4dff2] hover:border-white/25 whitespace-nowrap"
                >
                  Send Verification
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void refreshVerificationStatus()}
                  className="min-h-[36px] rounded-lg bg-[#8b6ff7] px-2.5 py-1 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] whitespace-nowrap"
                >
                  I Verified · Refresh
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Display Name & Password Reset Actions */}
        <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
          <form
            onSubmit={(e) => void handleSaveDisplayName(e)}
            className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 space-y-2.5"
          >
            <label htmlFor="settings-display-name" className="block text-xs font-semibold text-[#f1eef9]">
              Display Name
            </label>
            <div className="flex items-center gap-2">
              <input
                id="settings-display-name"
                type="text"
                value={displayNameDraft}
                onChange={(e) => setDisplayNameDraft(e.target.value)}
                maxLength={BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX_LEN}
                placeholder="Your workspace name"
                className="min-h-[38px] min-w-0 flex-1 rounded-lg border border-white/12 bg-[#13111d] px-3 py-1.5 text-xs text-[#f1eef9] focus:border-[#8b6ff7] focus:outline-none"
              />
              <button
                type="submit"
                disabled={authBusy}
                className="min-h-[38px] rounded-lg bg-[#8b6ff7] px-3 py-1.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
              >
                Save
              </button>
            </div>
          </form>

          <div className="flex flex-col justify-between rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 space-y-2">
            <div>
              <p className="text-xs font-semibold text-[#f1eef9]">Password Recovery</p>
              <p className="text-[11px] text-[#958ea8]">
                Send a password reset link to <code className="font-mono">{user?.email || 'your email'}</code>.
              </p>
            </div>
            <div>
              <button
                type="button"
                disabled={authBusy || !user?.email}
                onClick={() => user?.email && void requestPasswordReset(user.email)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/12 bg-[#13111d] px-3 py-1.5 text-xs font-medium text-[#e4dff2] hover:border-white/25 disabled:opacity-50 whitespace-nowrap"
              >
                <Mail className="h-3.5 w-3.5 text-[#c5b3fc]" />
                <span>Send Password Reset Email</span>
              </button>
            </div>
          </div>
        </div>

        {/* Provider Readiness Matrix */}
        {authConfig && (
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-semibold text-[#f5f3fc]">
              Authentication Providers & Roadmap Status
            </h3>
            <div className="overflow-x-auto rounded-xl border border-white/8 bg-[#0e0c16]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/8 text-[#958ea8]">
                  <tr>
                    <th className="px-3.5 py-2.5 font-medium">Provider</th>
                    <th className="px-3.5 py-2.5 font-medium">Status</th>
                    <th className="px-3.5 py-2.5 font-medium">Configuration Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-[#ddd8ec]">
                  {authConfig.providers.map((prov) => (
                    <tr key={prov.id}>
                      <td className="px-3.5 py-2.5 font-medium text-[#f5f3fc] whitespace-nowrap">
                        {prov.label}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {prov.status === 'configured' && (
                          <span className="text-emerald-300">Active & Provisioned</span>
                        )}
                        {prov.status === 'console_enable_required' && (
                          <span className="text-amber-300">SDK Ready · Console Toggle</span>
                        )}
                        {prov.status === 'planned_future' && (
                          <span className="text-[#958ea8]">Planned Future Option</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-[#9e97b0]">{prov.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Account Cancellation (Delete Account + Wipe Server, Firestore & Local Data) */}
        <div className="border-t border-white/8 pt-4 space-y-3">
          {!confirmCancelOpen ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-rose-200">Account Cancellation</p>
                <p className="text-xs text-[#958ea8]">
                  Permanently deletes your Firebase Auth account along with all private projects,
                  conversations, documents, and memories.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmCancelOpen(true);
                  setNeedsReauth(false);
                }}
                className="min-h-[40px] rounded-xl border border-rose-500/35 bg-rose-950/30 px-3.5 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900/40 whitespace-nowrap"
              >
                Cancel & Delete Account
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 p-4 space-y-3 text-xs">
              <p className="font-semibold text-rose-200">
                Confirm Permanent Account & Data Deletion
              </p>
              <p className="text-rose-100/85 leading-relaxed">
                This action erases your private projects, chat history, indexed documents, saved
                memories, Cloud Firestore records, and Firebase Authentication login. It cannot be
                undone.
              </p>

              {(needsReauth || hasPasswordProvider) && hasPasswordProvider && (
                <div className="space-y-1.5">
                  <label htmlFor="cancel-reauth-password" className="block text-rose-100">
                    Confirm your password to authorize deletion
                  </label>
                  <input
                    id="cancel-reauth-password"
                    type="password"
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.target.value)}
                    placeholder="Current account password"
                    className="min-h-[40px] w-full max-w-sm rounded-lg border border-rose-400/35 bg-[#0e0c16] px-3 py-1.5 text-xs text-[#f1eef9] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                {hasGoogleProvider && needsReauth ? (
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => void handleAccountCancellation({ reauthWithGoogle: true })}
                    className="min-h-[40px] rounded-lg bg-rose-500 px-3.5 py-1.5 text-xs font-semibold text-[#0b0a10] hover:bg-rose-400 disabled:opacity-50 whitespace-nowrap"
                  >
                    Re-authenticate with Google & Delete
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() =>
                      void handleAccountCancellation(
                        reauthPassword ? { reauthPassword } : undefined
                      )
                    }
                    className="min-h-[40px] rounded-lg bg-rose-500 px-3.5 py-1.5 text-xs font-semibold text-[#0b0a10] hover:bg-rose-400 disabled:opacity-50 whitespace-nowrap"
                  >
                    {authBusy ? 'Deleting account & data…' : 'Permanently Delete My Account'}
                  </button>
                )}

                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => {
                    setConfirmCancelOpen(false);
                    setNeedsReauth(false);
                    setReauthPassword('');
                  }}
                  className="min-h-[40px] rounded-lg border border-white/15 bg-[#0e0c16] px-3.5 py-1.5 text-xs text-[#e4dff2] hover:border-white/30 whitespace-nowrap"
                >
                  Keep Account
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. Appearance, Streaming & Local Persistence Preferences */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#f5f3fc]">
            Workspace Preferences & Appearance
          </h2>
          <p className="text-xs text-[#958ea8]">
            Customize theme contrast, real-time Server-Sent Events streaming, and UID-namespaced
            local browser conversation storage.
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
                Keep conversation threads in UID-isolated local browser storage across reloads on
                this device. Turning this off immediately wipes local browser threads.
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

          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div className="max-w-lg">
              <p className="font-semibold text-[#f1eef9]">Local Mock Mode (₹0 UI Testing)</p>
              <p className="text-[#958ea8]">
                Simulate clearly labeled assistant responses locally without consuming Gemini API
                free-tier quota. Deterministic tools still execute normally.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#0e0c16] p-1">
              <button
                type="button"
                onClick={() => setMockMode(false)}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  !mockMode ? 'bg-[#7c5dfa] text-white' : 'text-[#a59ec0] hover:text-[#f5f3fc]'
                }`}
              >
                Live Gemini API
              </button>
              <button
                type="button"
                onClick={() => setMockMode(true)}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mockMode ? 'bg-amber-600 text-white' : 'text-[#a59ec0] hover:text-[#f5f3fc]'
                }`}
              >
                Mock Mode
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Model Gateway Status */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#f5f3fc]">Model Gateway Status</h2>
            <p className="text-xs text-[#958ea8]">
              Gemini API credentials stay strictly on the server and are never exposed to signed-in
              users.
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
              Max {health?.maxStepsPerRequest ?? 4} calls/task ·{' '}
              {health?.maxConcurrentRequests ?? 4} concurrent · {health?.rateLimitPerMinute ?? 20}{' '}
              req/min
            </span>
          </div>
        </div>
      </section>

      {/* 4. Privacy & Per-User Data Purge Controls */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#f5f3fc]">
            Privacy & Private Workspace Data Controls
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#958ea8]">
            {health?.storageNotice ||
              'Your workspace records are isolated to your verified Firebase account UID.'}
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
            onClick={() => void handlePurge('all', 'all private workspace data')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900/40"
          >
            <Trash2 className="h-4 w-4" />
            <span>Purge All Workspace Data</span>
          </button>
        </div>
      </section>

      {/* 5. PWA & Android Firebase Setup Reference */}
      <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-semibold text-[#f5f3fc]">
            <Smartphone className="h-4 w-4 text-[#a58ff8]" />
            <h2>Android Mobile Setup & Authorized Domains</h2>
          </div>
          <PWAInstallButton alwaysShowGuideFallback />
        </div>
        <ul className="space-y-2 text-xs leading-relaxed text-[#b5add0]">
          <li>
            • <strong className="text-[#ece8f6]">Firebase Console on Android:</strong> Visit{' '}
            <code className="font-mono">console.firebase.google.com</code> → project{' '}
            <code className="font-mono">{authConfig?.projectId || 'focal-zucchini-5lcf1'}</code> →{' '}
            <strong>Authentication → Sign-in method</strong> to toggle{' '}
            <strong>Email/Password</strong> and <strong>Email link</strong> ON alongside Google.
          </li>
          <li>
            • <strong className="text-[#ece8f6]">Authorized Domains:</strong> Ensure{' '}
            <code className="font-mono">
              {(authConfig?.recommendedAuthorizedDomains || ['localhost']).join(', ')}
            </code>{' '}
            are listed under <strong>Authentication → Settings → Authorized domains</strong>.
          </li>
          <li>
            • <strong className="text-[#ece8f6]">PWA Cache Isolation:</strong> Service worker rules
            enforce <code className="font-mono">NetworkOnly</code> on all{' '}
            <code className="font-mono">/api/*</code> routes so authenticated responses are never
            cached in shared browser storage.
          </li>
        </ul>
      </section>

      <OfficialFooter />
    </div>
  );
};
