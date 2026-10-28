import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { VaelorEmblem } from '../components/VaelorEmblem';
import { OfficialFooter } from '../components/OfficialFooter';
import { OFFICIAL_ATTRIBUTION } from '../shared/types';
import { BLUEPRINT_CONSTRAINTS } from '../lib/firebase';

type AuthModeTab = 'signin' | 'signup' | 'reset' | 'magic';

interface AuthViewProps {
  /**
   * Optional destination message when rendered inline by ProtectedRoute
   */
  protectedFeatureLabel?: string;
}

export const AuthView: React.FC<AuthViewProps> = ({ protectedFeatureLabel }) => {
  const {
    user,
    authBusy,
    authError,
    authNotice,
    authConfig,
    pendingMagicLinkUrl,
    savedMagicLinkEmail,
    clearAuthMessages,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    sendMagicLink,
    completeMagicLink,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthModeTab>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [magicConfirmEmail, setMagicConfirmEmail] = useState(savedMagicLinkEmail);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);
  const [setupGuideOpen, setSetupGuideOpen] = useState(false);

  useEffect(() => {
    if (savedMagicLinkEmail && !magicConfirmEmail) {
      setMagicConfirmEmail(savedMagicLinkEmail);
    }
  }, [savedMagicLinkEmail, magicConfirmEmail]);

  // Redirect signed-in users visiting /auth directly back to workspace
  useEffect(() => {
    if (user && location.pathname === '/auth' && !pendingMagicLinkUrl) {
      void navigate('/chat', { replace: true });
    }
  }, [user, location.pathname, navigate, pendingMagicLinkUrl]);

  const switchTab = (nextMode: AuthModeTab) => {
    setMode(nextMode);
    setLocalValidationError(null);
    clearAuthMessages();
  };

  const handleGoogleClick = async () => {
    setLocalValidationError(null);
    const ok = await signInWithGoogle();
    if (ok && location.pathname === '/auth') {
      void navigate('/chat', { replace: true });
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalValidationError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setLocalValidationError('Enter your password.');
      return;
    }
    const ok = await signInWithEmail(cleanEmail, password);
    if (ok && location.pathname === '/auth') {
      void navigate('/chat', { replace: true });
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationError(null);
    const cleanName = displayName.trim();
    const cleanEmail = email.trim();
    if (!cleanName || cleanName.length > BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX_LEN) {
      setLocalValidationError('Enter a display name between 1 and 80 characters.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalValidationError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setLocalValidationError('Choose a password with at least 8 characters.');
      return;
    }
    const ok = await signUpWithEmail({
      displayName: cleanName,
      email: cleanEmail,
      password,
    });
    if (ok && location.pathname === '/auth') {
      void navigate('/chat', { replace: true });
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalValidationError('Enter the email address for your account.');
      return;
    }
    await requestPasswordReset(cleanEmail);
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalValidationError('Enter a valid email address to receive your sign-in link.');
      return;
    }
    await sendMagicLink(cleanEmail);
  };

  const handleCompleteMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationError(null);
    const ok = await completeMagicLink(magicConfirmEmail);
    if (ok && location.pathname === '/auth') {
      void navigate('/chat', { replace: true });
    }
  };

  const activeError = localValidationError || authError;

  return (
    <div className="flex min-h-full flex-col justify-between bg-[#0b0a10] text-[#f1eef9]">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left Column: Context & Security Architecture */}
          <div className="space-y-6 lg:col-span-5">
            <div className="flex items-center gap-3 text-xs text-[#a59ec0]">
              <VaelorEmblem size="sm" />
              <span>
                {OFFICIAL_ATTRIBUTION.productName} v{OFFICIAL_ATTRIBUTION.version}
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f6f4fc] [text-wrap:balance]">
                {protectedFeatureLabel
                  ? `Sign in to access ${protectedFeatureLabel}`
                  : 'Sign in to your private Vaelor workspace'}
              </h1>
              <p className="text-sm leading-relaxed text-[#a8a1bd]">
                Your projects, conversation threads, indexed documents, saved memories, and task
                logs are isolated strictly to your verified account UID. Public product overviews
                remain open without sign-in.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[#f5f3fc]">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Account Security Guarantees</span>
              </div>
              <ul className="space-y-2 text-[#b5add0] leading-relaxed">
                <li>
                  • <strong className="text-[#ece8f6]">Real Firebase Auth SDK:</strong> Zero
                  homemade password storage or plaintext credentials.
                </li>
                <li>
                  • <strong className="text-[#ece8f6]">Server-Verified Bearer Tokens:</strong> Every
                  protected <code className="font-mono">/api/*</code> request verifies your RS256
                  Firebase ID token before accessing data.
                </li>
                <li>
                  • <strong className="text-[#ece8f6]">Anti-IDOR Isolation:</strong> Changing a
                  project, chat, or task ID in a request is blocked with HTTP 403.
                </li>
                <li>
                  • <strong className="text-[#ece8f6]">Protected Gemini Key:</strong>{' '}
                  <code className="font-mono">GEMINI_API_KEY</code> stays strictly on the server and
                  is never exposed to signed-in users.
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#9e97b0]">
              <Link
                to="/overview"
                className="underline decoration-white/25 underline-offset-4 hover:text-[#f5f3fc] whitespace-nowrap"
              >
                Explore public platform overview
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                to="/about"
                className="underline decoration-white/25 underline-offset-4 hover:text-[#f5f3fc] whitespace-nowrap"
              >
                Capability & architecture audit
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive Firebase Authentication Card */}
          <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 sm:p-7 space-y-5 lg:col-span-7">
            {/* Incoming Magic Link Completion Prompt */}
            {pendingMagicLinkUrl && (
              <form
                onSubmit={(e) => void handleCompleteMagicLink(e)}
                className="rounded-xl border border-[#8b6ff7]/40 bg-[#19152b] p-4 space-y-3"
              >
                <p className="text-xs font-semibold text-[#f5f3fc]">
                  Complete Passwordless Email Link Sign-In
                </p>
                <p className="text-xs text-[#b5add0]">
                  Confirm the email address that received this sign-in link to finish signing in.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={magicConfirmEmail}
                    onChange={(e) => setMagicConfirmEmail(e.target.value)}
                    aria-label="Confirm email address for magic link"
                    placeholder="you@example.com"
                    required
                    className="min-h-[42px] flex-1 rounded-xl border border-white/12 bg-[#0e0c16] px-3 py-2 text-xs text-[#f1eef9] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#8b6ff7] px-4 py-2 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
                  >
                    <span>Complete Sign-In</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* Priority 1: Continue with Google */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleGoogleClick()}
                disabled={authBusy}
                className="flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#f6f4fc] px-4 py-2.5 text-sm font-semibold text-[#0b0a10] transition-colors hover:bg-white disabled:opacity-50 whitespace-nowrap"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.88c2.27-2.09 3.54-5.17 3.54-8.8z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-2.98c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.99-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94z"
                  />
                </svg>
                <span>{authBusy ? 'Connecting to Firebase…' : 'Continue with Google'}</span>
              </button>
              <p className="text-center text-[11px] text-[#8f88a3]">
                Recommended · Provisioned for Firebase project{' '}
                <code className="font-mono text-[#cfc8e2]">
                  {authConfig?.projectId || 'focal-zucchini-5lcf1'}
                </code>
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#6f6884]">
              <div className="h-px flex-1 bg-white/8" />
              <span>or use email authentication</span>
              <div className="h-px flex-1 bg-white/8" />
            </div>

            {/* Segmented Mode Tabs: Sign In | Create Account | Reset Password | Magic Link */}
            <div
              role="tablist"
              aria-label="Email authentication modes"
              className="grid grid-cols-2 gap-1 rounded-xl bg-[#0e0c16] p-1 sm:grid-cols-4"
            >
              {(
                [
                  { id: 'signin', label: 'Sign In' },
                  { id: 'signup', label: 'Create Account' },
                  { id: 'reset', label: 'Reset Password' },
                  { id: 'magic', label: 'Magic Link' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab.id}
                  onClick={() => switchTab(tab.id)}
                  className={`min-h-[38px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === tab.id
                      ? 'bg-[#231d38] text-[#f5f3fc]'
                      : 'text-[#958ea8] hover:text-[#e4dff2]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Status / Error Banner */}
            {activeError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-500/35 bg-rose-950/30 p-3.5 text-xs text-rose-200 leading-relaxed"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <span>{activeError}</span>
              </div>
            )}

            {authNotice && !activeError && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-3.5 text-xs text-emerald-200 leading-relaxed"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{authNotice}</span>
              </div>
            )}

            {/* Tab 1: Email & Password Sign In */}
            {mode === 'signin' && (
              <form onSubmit={(e) => void handleEmailSignIn(e)} noValidate className="space-y-4">
                <div>
                  <label htmlFor="auth-signin-email" className="mb-1.5 block text-xs text-[#cfc8e2]">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7f7894]" />
                    <input
                      id="auth-signin-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={BLUEPRINT_CONSTRAINTS.EMAIL_MAX_LEN}
                      placeholder="you@example.com"
                      className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0e0c16] py-2.5 pl-9 pr-3 text-xs text-[#f1eef9] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <label htmlFor="auth-signin-password" className="text-[#cfc8e2]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => switchTab('reset')}
                      className="text-[#c5b3fc] hover:underline whitespace-nowrap"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7f7894]" />
                    <input
                      id="auth-signin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0e0c16] py-2.5 pl-9 pr-10 text-xs text-[#f1eef9] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1.5 inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-[#958ea8] hover:text-[#f5f3fc]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authBusy}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
                >
                  <span>{authBusy ? 'Signing in…' : 'Sign In with Email'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* Tab 2: Create Account (Email & Password + Verification Email) */}
            {mode === 'signup' && (
              <form onSubmit={(e) => void handleEmailSignUp(e)} noValidate className="space-y-4">
                <div>
                  <label htmlFor="auth-signup-name" className="mb-1.5 block text-xs text-[#cfc8e2]">
                    Display Name
                  </label>
                  <input
                    id="auth-signup-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX_LEN}
                    placeholder="Arenyx Builder"
                    className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0e0c16] px-3 py-2.5 text-xs text-[#f1eef9] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="auth-signup-email" className="mb-1.5 block text-xs text-[#cfc8e2]">
                    Email Address
                  </label>
                  <input
                    id="auth-signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={BLUEPRINT_CONSTRAINTS.EMAIL_MAX_LEN}
                    placeholder="you@example.com"
                    className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0e0c16] px-3 py-2.5 text-xs text-[#f1eef9] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-signup-password"
                    className="mb-1.5 block text-xs text-[#cfc8e2]"
                  >
                    Password (minimum 8 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="auth-signup-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0e0c16] py-2.5 pl-3 pr-10 text-xs text-[#f1eef9] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1.5 inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-[#958ea8] hover:text-[#f5f3fc]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authBusy}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
                >
                  <span>{authBusy ? 'Creating account…' : 'Create Account & Send Verification'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* Tab 3: Password Reset */}
            {mode === 'reset' && (
              <form onSubmit={(e) => void handleResetSubmit(e)} noValidate className="space-y-4">
                <p className="text-xs leading-relaxed text-[#b5add0]">
                  Enter your account email address and Firebase Authentication will send a secure
                  password reset link.
                </p>
                <div>
                  <label htmlFor="auth-reset-email" className="mb-1.5 block text-xs text-[#cfc8e2]">
                    Account Email Address
                  </label>
                  <input
                    id="auth-reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={BLUEPRINT_CONSTRAINTS.EMAIL_MAX_LEN}
                    placeholder="you@example.com"
                    className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0e0c16] px-3 py-2.5 text-xs text-[#f1eef9] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
                >
                  <span>{authBusy ? 'Sending reset link…' : 'Send Password Reset Email'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* Tab 4: Optional Passwordless Email Magic Link */}
            {mode === 'magic' && (
              <form onSubmit={(e) => void handleSendMagicLink(e)} noValidate className="space-y-4">
                <p className="text-xs leading-relaxed text-[#b5add0]">
                  Receive a one-time passwordless sign-in link in your inbox. Requires{' '}
                  <strong className="text-[#ece8f6]">Email link (passwordless sign-in)</strong> to
                  be toggled ON under Firebase Console → Authentication → Sign-in method.
                </p>
                <div>
                  <label htmlFor="auth-magic-email" className="mb-1.5 block text-xs text-[#cfc8e2]">
                    Email Address
                  </label>
                  <input
                    id="auth-magic-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={BLUEPRINT_CONSTRAINTS.EMAIL_MAX_LEN}
                    placeholder="you@example.com"
                    className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0e0c16] px-3 py-2.5 text-xs text-[#f1eef9] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
                >
                  <span>{authBusy ? 'Sending magic link…' : 'Email Me a Sign-In Link'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* Future Providers (Non-Interactive Honest Roadmap — Never Fake Buttons) */}
            <div className="border-t border-white/8 pt-4 space-y-2 text-xs">
              <p className="font-medium text-[#cfc8e2]">Planned Future Providers</p>
              <p className="text-[#8f88a3] leading-relaxed">
                Apple Sign-In (requires paid Apple Developer Program membership) and GitHub /
                Enterprise OIDC SSO are reserved as future provider slots and intentionally not
                shown as active buttons under the ₹0 free-tier configuration.
              </p>
            </div>

            {/* Expandable Android-Friendly Firebase Console Checklist */}
            <div className="border-t border-white/8 pt-3">
              <button
                type="button"
                onClick={() => setSetupGuideOpen((v) => !v)}
                aria-expanded={setupGuideOpen}
                className="flex w-full items-center justify-between py-1.5 text-left text-xs font-medium text-[#c5b3fc] hover:text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5 shrink-0" />
                  <span>Android Browser Setup: Enabling Email Providers & Authorized Domains</span>
                </span>
                {setupGuideOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                )}
              </button>

              {setupGuideOpen && (
                <div className="mt-3 rounded-xl border border-white/8 bg-[#0e0c16] p-4 space-y-2.5 text-xs text-[#b5add0] leading-relaxed">
                  <p>
                    <strong className="text-[#f1eef9]">1. Google Sign-In:</strong> Provisioned
                    automatically for project{' '}
                    <code className="font-mono text-[#e4dff2]">
                      {authConfig?.projectId || 'focal-zucchini-5lcf1'}
                    </code>
                    .
                  </p>
                  <p>
                    <strong className="text-[#f1eef9]">2. Enable Email/Password & Magic Link:</strong>{' '}
                    On your Android browser, open{' '}
                    <code className="font-mono text-[#e4dff2]">console.firebase.google.com</code> →
                    select project{' '}
                    <code className="font-mono text-[#e4dff2]">
                      {authConfig?.projectId || 'focal-zucchini-5lcf1'}
                    </code>{' '}
                    → <strong>Build → Authentication → Sign-in method</strong> → tap{' '}
                    <strong>Email/Password</strong> → toggle <strong>Enable</strong> ON (and toggle{' '}
                    <strong>Email link</strong> ON if you want passwordless links) → tap{' '}
                    <strong>Save</strong>.
                  </p>
                  <p>
                    <strong className="text-[#f1eef9]">3. Authorized Domains Check:</strong> Under{' '}
                    <strong>Authentication → Settings → Authorized domains</strong>, ensure your
                    active app hostnames are listed:{' '}
                    <code className="font-mono text-[#e4dff2]">
                      {(authConfig?.recommendedAuthorizedDomains || [window.location.hostname]).join(
                        ', '
                      )}
                    </code>
                    .
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <OfficialFooter />
    </div>
  );
};
