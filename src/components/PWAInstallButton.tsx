import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface PWAInstallButtonProps {
  alwaysShowGuideFallback?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  alwaysShowGuideFallback = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return alwaysShowGuideFallback ? (
      <span className="text-xs text-[#9e97b0]">Installed in standalone mode</span>
    ) : null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#8b6ff7] px-4 py-2 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f87fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6ff7] whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" />
        Install Vaelor App
      </button>
    );
  }

  if (isIOS || alwaysShowGuideFallback) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/12 bg-[#161321] px-3.5 py-2 text-xs font-medium text-[#e4dff2] transition-colors hover:border-white/25 hover:bg-[#1e1a2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6ff7] whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-4 w-4 text-[#a992fa]" />
          {isIOS ? 'Install on iOS' : 'How to Install PWA'}
        </button>

        {showGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-guide-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#14121d] p-6 text-left">
              <div className="flex items-start justify-between gap-4">
                <h3 id="pwa-install-guide-title" className="text-base font-semibold text-[#f1eef9]">
                  Install Aurenyx Vaelor
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close installation guide"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#9e97b0] hover:bg-white/5 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#b9b2cb]">
                <p>
                  <strong className="text-[#f1eef9]">Android (Chrome / Edge):</strong> Open the app
                  directly in a top-level browser tab (outside an embedded preview frame), tap the
                  browser menu, and choose <strong>Install app</strong> or{' '}
                  <strong>Add to Home screen</strong>.
                </p>
                <p>
                  <strong className="text-[#f1eef9]">iOS (Safari):</strong> Tap the{' '}
                  <strong>Share</strong> icon in the toolbar and choose{' '}
                  <strong>Add to Home Screen</strong>.
                </p>
                <p className="text-xs text-[#8f88a3]">
                  Note: Static interface assets work offline once cached, while AI model requests
                  require an active network and backend connection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 min-h-[44px] w-full rounded-lg bg-[#221d33] px-4 py-2 text-xs font-semibold text-[#f1eef9] hover:bg-[#2c2542]"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-950/60 px-4 py-2 text-xs text-amber-200"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        Offline mode: Static workspace assets remain accessible, but AI orchestration requires a live
        network and backend connection.
      </span>
    </div>
  );
};
