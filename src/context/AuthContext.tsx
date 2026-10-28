import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  auth,
  BLUEPRINT_CONSTRAINTS,
  deleteAllUserFirestoreData,
  syncVerifiedUserToFirestore,
} from '../lib/firebase';
import type { AuthConfigResponse, AuthenticatedAccountSummary } from '../shared/types';

const MAGIC_LINK_EMAIL_STORAGE_KEY = 'vaelor_magic_link_pending_email_v1';

export function mapFirebaseAuthError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : '';
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (rawMessage.includes('Quota exceeded')) {
    return 'Cloud Firestore free-tier daily quota was reached. Quota resets tomorrow on the Firebase Spark plan.';
  }

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing authentication. Try again when ready.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups for this site and tap Continue with Google again.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in window is already open. Complete or close that window first.';
    case 'auth/unauthorized-domain':
      return `This preview domain (${window.location.hostname}) is not yet listed under Firebase Authorized Domains. Open Firebase Console -> Authentication -> Settings -> Authorized domains and add ${window.location.hostname}.`;
    case 'auth/operation-not-allowed':
      return 'This sign-in provider is not toggled ON yet in Firebase Console. Open Firebase Console -> Authentication -> Sign-in method and enable Email/Password (and Email link if using Magic Link).';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Verify your credentials or use Reset Password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Sign in instead or reset your password.';
    case 'auth/weak-password':
      return 'Choose a stronger password with at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many sign-in attempts detected. Wait a minute before trying again, or reset your password.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Authentication. Check your internet connection and retry.';
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return 'This sign-in or verification link has expired or was already used. Request a fresh link.';
    case 'auth/requires-recent-login':
      return 'For security, account deletion requires recent authentication. Confirm your sign-in below and retry.';
    case 'auth/user-disabled':
      return 'This account has been disabled by an administrator.';
    default:
      return 'Authentication action could not be completed. Check your sign-in details or provider settings and retry.';
  }
}

export interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  authNotice: string | null;
  authConfig: AuthConfigResponse | null;
  serverAccount: AuthenticatedAccountSummary | null;
  pendingMagicLinkUrl: string | null;
  savedMagicLinkEmail: string;

  clearAuthMessages: () => void;
  getFreshIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshAccountSummary: () => Promise<void>;

  signInWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (params: {
    displayName: string;
    email: string;
    password: string;
  }) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
  refreshVerificationStatus: () => Promise<boolean>;
  sendMagicLink: (email: string) => Promise<boolean>;
  completeMagicLink: (email: string) => Promise<boolean>;
  updateAccountDisplayName: (displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  cancelAccount: (options?: {
    reauthPassword?: string;
    reauthWithGoogle?: boolean;
  }) => Promise<{ ok: boolean; requiresRecentLogin?: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfigResponse | null>(null);
  const [serverAccount, setServerAccount] = useState<AuthenticatedAccountSummary | null>(null);
  const [pendingMagicLinkUrl, setPendingMagicLinkUrl] = useState<string | null>(null);
  const [savedMagicLinkEmail, setSavedMagicLinkEmail] = useState<string>(() => {
    try {
      return window.localStorage.getItem(MAGIC_LINK_EMAIL_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const clearAuthMessages = useCallback(() => {
    setAuthError(null);
    setAuthNotice(null);
  }, []);

  // Load public Firebase Auth readiness & recommended Authorized Domains from backend
  useEffect(() => {
    void fetch('/api/auth/config')
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as AuthConfigResponse;
        setAuthConfig(json);
      })
      .catch(() => {});
  }, []);

  // Detect incoming passwordless Email Magic Link URLs on page load
  useEffect(() => {
    try {
      const currentHref = window.location.href;
      if (isSignInWithEmailLink(auth, currentHref)) {
        setPendingMagicLinkUrl(currentHref);
      }
    } catch {
      // Ignore URL parse issues
    }
  }, []);

  const getFreshIdToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    const current = auth.currentUser;
    if (!current) return null;
    try {
      return await current.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  }, []);

  const refreshAccountSummary = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setServerAccount(null);
      return;
    }
    try {
      const token = await current.getIdToken();
      const res = await fetch('/api/account/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as { account?: AuthenticatedAccountSummary };
        if (json.account) {
          setServerAccount(json.account);
        }
      }
    } catch {
      // Offline or unconfigured fallback
    }
  }, []);

  // Subscribe to Firebase ID token & auth state changes
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        if (nextUser.emailVerified) {
          void syncVerifiedUserToFirestore(nextUser).catch(() => {});
        }
        void refreshAccountSummary();
      } else {
        setServerAccount(null);
      }
    });
    return () => unsubscribe();
  }, [refreshAccountSummary]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      if (cred.user.emailVerified) {
        await syncVerifiedUserToFirestore(cred.user).catch(() => {});
      }
      setAuthNotice('Signed in with Google.');
      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setAuthError('Enter both your email address and password.');
      return false;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      if (cred.user.emailVerified) {
        await syncVerifiedUserToFirestore(cred.user).catch(() => {});
      }
      setAuthNotice(
        cred.user.emailVerified
          ? 'Signed in cleanly.'
          : 'Signed in. Verify your email address in Account Settings to enable Cloud Firestore sync.'
      );
      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (params: { displayName: string; email: string; password: string }): Promise<boolean> => {
      const cleanName = params.displayName
        .trim()
        .slice(0, BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX_LEN);
      const cleanEmail = params.email.trim().slice(0, BLUEPRINT_CONSTRAINTS.EMAIL_MAX_LEN);

      if (!cleanName) {
        setAuthError('Enter a display name (1–80 characters).');
        return false;
      }
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setAuthError('Enter a valid email address.');
        return false;
      }
      if (params.password.length < 8) {
        setAuthError('Password must be at least 8 characters long.');
        return false;
      }

      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
        await updateProfile(cred.user, { displayName: cleanName });
        await sendEmailVerification(cred.user);
        setAuthNotice(
          `Account created for ${cleanEmail}. A verification email has been sent—verify your inbox to unlock Cloud Firestore sync.`
        );
        return true;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err));
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const requestPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('Enter the email address associated with your account.');
      return false;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setAuthNotice(
        `If an account exists for ${cleanEmail}, a password reset link has been sent to that inbox.`
      );
      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const resendVerificationEmail = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) {
      setAuthError('Sign in first to request a verification email.');
      return false;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setAuthNotice(`Verification email sent to ${auth.currentUser.email || 'your inbox'}.`);
      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const refreshVerificationStatus = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    setAuthBusy(true);
    setAuthError(null);
    try {
      await reload(auth.currentUser);
      await auth.currentUser.getIdToken(true);
      const refreshed = auth.currentUser;
      setUser(refreshed);
      if (refreshed?.emailVerified) {
        await syncVerifiedUserToFirestore(refreshed).catch(() => {});
        setAuthNotice('Email verified. Cloud Firestore account sync is now active.');
        await refreshAccountSummary();
        return true;
      }
      setAuthNotice('Email is not marked verified yet. Click the link in your inbox, then check again.');
      return false;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [refreshAccountSummary]);

  const sendMagicLink = useCallback(async (email: string): Promise<boolean> => {
    const cleanEmail = email.trim().slice(0, BLUEPRINT_CONSTRAINTS.EMAIL_MAX_LEN);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('Enter a valid email address to receive a sign-in link.');
      return false;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth?mode=magic-complete`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
      try {
        window.localStorage.setItem(MAGIC_LINK_EMAIL_STORAGE_KEY, cleanEmail);
      } catch {
        // Ignore storage errors
      }
      setSavedMagicLinkEmail(cleanEmail);
      setAuthNotice(
        `Passwordless sign-in link sent to ${cleanEmail}. Open the link from your email on this device.`
      );
      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const completeMagicLink = useCallback(
    async (email: string): Promise<boolean> => {
      const cleanEmail = email.trim();
      const linkUrl = pendingMagicLinkUrl || window.location.href;
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setAuthError('Confirm the email address where you received the sign-in link.');
        return false;
      }
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      try {
        const cred = await signInWithEmailLink(auth, cleanEmail, linkUrl);
        try {
          window.localStorage.removeItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
          window.history.replaceState({}, document.title, '/');
        } catch {
          // Ignore history/storage error
        }
        setPendingMagicLinkUrl(null);
        setSavedMagicLinkEmail('');
        if (cred.user.emailVerified) {
          await syncVerifiedUserToFirestore(cred.user).catch(() => {});
        }
        setAuthNotice('Signed in via passwordless email link.');
        return true;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err));
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [pendingMagicLinkUrl]
  );

  const updateAccountDisplayName = useCallback(
    async (displayName: string): Promise<boolean> => {
      const current = auth.currentUser;
      if (!current) return false;
      const cleanName = displayName.trim().slice(0, BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX_LEN);
      if (!cleanName) {
        setAuthError('Display name must be between 1 and 80 characters.');
        return false;
      }
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      try {
        await updateProfile(current, { displayName: cleanName });
        await current.getIdToken(true);
        if (current.emailVerified) {
          await syncVerifiedUserToFirestore(current).catch(() => {});
        }
        await refreshAccountSummary();
        setAuthNotice('Display name updated.');
        return true;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err));
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [refreshAccountSummary]
  );

  const logout = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signOut(auth);
      setServerAccount(null);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const cancelAccount = useCallback(
    async (options?: {
      reauthPassword?: string;
      reauthWithGoogle?: boolean;
    }): Promise<{ ok: boolean; requiresRecentLogin?: boolean; error?: string }> => {
      const current = auth.currentUser;
      if (!current) {
        return { ok: false, error: 'No signed-in account to delete.' };
      }

      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);

      try {
        if (options?.reauthWithGoogle) {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await reauthenticateWithPopup(current, provider);
        } else if (options?.reauthPassword && current.email) {
          const credential = EmailAuthProvider.credential(current.email, options.reauthPassword);
          await reauthenticateWithCredential(current, credential);
        }

        const freshToken = await current.getIdToken(true);

        // 1. Delete server-side private projects, chats, documents, memories, and task traces
        await fetch('/api/account/data', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${freshToken}` },
        });

        // 2. Delete Cloud Firestore user subcollections & profile document
        if (current.emailVerified) {
          await deleteAllUserFirestoreData(current);
        }

        // 3. Wipe user-namespaced local browser conversation & TrustGrid caches
        try {
          window.localStorage.removeItem(`vaelor_saved_conversations_v2_${current.uid}`);
          window.localStorage.removeItem(`aurenyx_trustgrid_store_v1_uid_${current.uid}`);
        } catch {
          // Ignore storage error
        }

        // 4. Delete Firebase Auth account credential record
        await deleteUser(current);
        setServerAccount(null);
        return { ok: true };
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code?: unknown }).code)
            : '';
        const friendly = mapFirebaseAuthError(err);
        setAuthError(friendly);
        return {
          ok: false,
          requiresRecentLogin: code === 'auth/requires-recent-login',
          error: friendly,
        };
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authReady,
      authBusy,
      authError,
      authNotice,
      authConfig,
      serverAccount,
      pendingMagicLinkUrl,
      savedMagicLinkEmail,
      clearAuthMessages,
      getFreshIdToken,
      refreshAccountSummary,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      resendVerificationEmail,
      refreshVerificationStatus,
      sendMagicLink,
      completeMagicLink,
      updateAccountDisplayName,
      logout,
      cancelAccount,
    }),
    [
      user,
      authReady,
      authBusy,
      authError,
      authNotice,
      authConfig,
      serverAccount,
      pendingMagicLinkUrl,
      savedMagicLinkEmail,
      clearAuthMessages,
      getFreshIdToken,
      refreshAccountSummary,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      resendVerificationEmail,
      refreshVerificationStatus,
      sendMagicLink,
      completeMagicLink,
      updateAccountDisplayName,
      logout,
      cancelAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
