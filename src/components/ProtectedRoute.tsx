import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthView } from '../views/AuthView';

interface ProtectedRouteProps {
  children: React.ReactNode;
  featureLabel?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, featureLabel }) => {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-white/10 bg-[#13111d] p-6 space-y-3"
        >
          <div className="h-4 w-44 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-72 rounded bg-white/6 animate-pulse" />
          <p className="text-xs text-[#9e97b0]">Restoring your authenticated session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView protectedFeatureLabel={featureLabel} />;
  }

  return <>{children}</>;
};
