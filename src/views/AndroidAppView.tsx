import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileCode2,
  Loader2,
  ShieldCheck,
  Smartphone,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { OFFICIAL_ATTRIBUTION } from '../shared/types';
import { OfficialFooter } from '../components/OfficialFooter';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

interface AndroidSecurityCheckItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

interface AndroidSourceFileSummary {
  relativePath: string;
  sizeBytes: number;
  lineCount: number;
  category: 'gradle' | 'manifest-xml' | 'kotlin' | 'test' | 'ci-docs';
}

interface AndroidAuditStatus {
  applicationId: string;
  appName: string;
  versionCode: number;
  versionName: string;
  minSdk: number;
  targetSdk: number;
  compileSdk: number;
  projectPresent: boolean;
  debugApkBuilt: boolean;
  debugApkSizeBytes?: number;
  totalSourceFiles: number;
  totalLinesOfCode: number;
  secretScanPassed: boolean;
  securityChecks: AndroidSecurityCheckItem[];
  files: AndroidSourceFileSummary[];
}

type SimulatedMobileState =
  | 'ready'
  | 'loading'
  | 'offline'
  | 'timeout'
  | 'quota'
  | 'error';

export const AndroidAppView: React.FC = () => {
  useDocumentMeta({
    title: 'Native Android App (Kotlin + Compose) — AURENYX VAELOR',
    description:
      'Inspect and download the secure native Kotlin and Jetpack Compose Android application for AURENYX VAELOR & TRUSTGRID, prepared for Google Play Internal Testing.',
  });

  const [audit, setAudit] = useState<AndroidAuditStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>(
    'android/app/src/main/java/org/aethervanguard/aurenyxvaelor/MainActivity.kt'
  );
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Interactive Compose State & Private History Harness
  const [simState, setSimState] = useState<SimulatedMobileState>('ready');
  const [simThreads, setSimThreads] = useState<string[]>([
    'Multi-agent architecture review',
    'TrustGrid invoice workflow check',
  ]);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/android/status');
        if (res.ok) {
          const data = (await res.json()) as AndroidAuditStatus;
          setAudit(data);
          if (data.files.length > 0 && !data.files.some((f) => f.relativePath === selectedFile)) {
            setSelectedFile(data.files[0].relativePath);
          }
        }
      } catch {
        // Handled gracefully
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    setLoadingFile(true);
    void (async () => {
      try {
        const res = await fetch(`/api/android/file?path=${encodeURIComponent(selectedFile)}`);
        if (res.ok) {
          const json = (await res.json()) as { content: string };
          setFileContent(json.content);
        }
      } finally {
        setLoadingFile(false);
      }
    })();
  }, [selectedFile]);

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-10">
        {/* Header & Archive Download */}
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#13111d] p-6 sm:p-8">
          <div className="space-y-2 max-w-3xl">
            <p className="font-mono text-xs text-[#a58ff8]">
              KOTLIN 2.0 · JETPACK COMPOSE MATERIAL 3 · TARGET SDK 35
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc] sm:text-3xl">
              Native Android Application &amp; Play Release Hub
            </h1>
            <p className="text-xs leading-relaxed text-[#b5add0]">
              {OFFICIAL_ATTRIBUTION.statement} Includes multi-agent backend orchestration, optional
              Firebase AI Logic + Play Integrity App Check gate, embedded TrustGrid provisional risk
              engine, private internal history deletion, and Google Play Internal Testing setup.
            </p>
            {audit && (
              <p className="font-mono text-xs text-[#d6d0e8]">
                App ID: {audit.applicationId} · v{audit.versionName} (code {audit.versionCode}) ·
                Min SDK {audit.minSdk} / Target SDK {audit.targetSdk} · {audit.totalSourceFiles}{' '}
                files ({audit.totalLinesOfCode} lines)
              </p>
            )}
          </div>

          <a
            href="/api/android/source-bundle.tar.gz"
            download="aurenyx-vaelor-android-project.tar.gz"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#8b6ff7] px-5 py-2.5 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Download Android Studio Project (.tar.gz)</span>
          </a>
        </section>

        {/* Live Security & Play Readiness Audit */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#13111d] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <h2 className="text-base font-bold text-[#f6f4fc]">
                Automated Android Source &amp; Security Audit
              </h2>
            </div>

            {!audit ? (
              <p className="text-xs text-[#958ea8]">Loading live file-system security scan…</p>
            ) : (
              <ul className="space-y-3 text-xs">
                {audit.securityChecks.map((chk) => (
                  <li
                    key={chk.id}
                    className="rounded-xl border border-white/8 bg-[#0b0a10] p-3.5 space-y-1"
                  >
                    <div className="flex items-center gap-2 font-semibold text-[#f5f3fc]">
                      {chk.passed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                      )}
                      <span>{chk.label}</span>
                    </div>
                    <p className="text-[#9e97b0] pl-6">{chk.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Interactive Mobile UX State & Private History Harness */}
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#13111d] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[#a58ff8]" />
              <h2 className="text-base font-bold text-[#f6f4fc]">
                Android UX State &amp; Privacy Preview
              </h2>
            </div>
            <p className="text-xs text-[#9e97b0]">
              Preview the exact sealed <code className="font-mono">RequestUiState</code> banners and
              private <code className="font-mono">filesDir</code> deletion flow implemented in
              Jetpack Compose:
            </p>

            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {(
                [
                  ['ready', 'Ready'],
                  ['loading', 'Loading'],
                  ['offline', 'Offline'],
                  ['timeout', 'Timeout'],
                  ['quota', 'Quota 429'],
                  ['error', 'Error'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSimState(key)}
                  className={`min-h-[38px] rounded-lg border px-2.5 py-1.5 font-medium transition-colors ${
                    simState === key
                      ? 'border-[#a58ff8] bg-[#8b6ff7]/25 text-white'
                      : 'border-white/10 bg-[#0b0a10] text-[#a39cb8] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Simulated Compose Viewport */}
            <div className="rounded-2xl border border-white/15 bg-[#0b0a10] p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="font-bold text-[#f6f4fc]">AURENYX VAELOR (Compose)</span>
                <span className="font-mono text-[11px] text-[#a58ff8]">TLS · No Hardcoded Key</span>
              </div>

              {simState === 'ready' && (
                <div role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-200">
                  Secure Backend Orchestrator connected. Direct Firebase AI Logic labeled Unavailable
                  until google-services.json &amp; Play Integrity App Check are registered.
                </div>
              )}
              {simState === 'loading' && (
                <div role="status" className="flex items-center gap-2 rounded-lg border border-[#a58ff8]/35 bg-[#8b6ff7]/15 p-3 text-[#e3dbfc]">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Orchestrating specialist agent &amp; Sentinel verification…</span>
                </div>
              )}
              {simState === 'offline' && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-amber-200">
                  <WifiOff className="h-4 w-4 shrink-0" />
                  <span>Device offline (ConnectivityManager). Local math, TrustGrid scoring &amp; private history remain usable.</span>
                </div>
              )}
              {simState === 'timeout' && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-amber-200">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Request timed out after 35s (HTTP 504 / SocketTimeout). Tap Retry to resend safely.</span>
                </div>
              )}
              {simState === 'quota' && (
                <div role="alert" className="rounded-lg border border-rose-400/35 bg-rose-400/10 p-3 text-rose-200">
                  Rate or quota limit reached (HTTP 429 · Retry-After: 42s). Server sliding-window guard active.
                </div>
              )}
              {simState === 'error' && (
                <div role="alert" className="rounded-lg border border-rose-400/35 bg-rose-400/10 p-3 text-rose-200">
                  Sanitized server error (ORCHESTRATOR_FAILURE). Internal stack traces and keys are never exposed.
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[#9e97b0]">
                  <span>Private On-Device Threads (allowBackup=false)</span>
                  <span className="font-mono">{simThreads.length}</span>
                </div>
                {simThreads.length === 0 ? (
                  <p className="rounded-lg border border-white/8 bg-[#13111d] p-2.5 text-[#958ea8]">
                    Private internal storage wiped (0 conversations on device).
                  </p>
                ) : (
                  simThreads.map((t) => (
                    <div
                      key={t}
                      className="rounded-lg border border-white/8 bg-[#13111d] px-3 py-2 text-[#e6e1f4]"
                    >
                      {t}
                    </div>
                  ))
                )}

                <div className="pt-1 flex items-center justify-between">
                  {!confirmWipe ? (
                    <button
                      type="button"
                      disabled={simThreads.length === 0}
                      onClick={() => setConfirmWipe(true)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-rose-400/35 px-3 py-1.5 text-rose-300 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Private History</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSimThreads([]);
                          setConfirmWipe(false);
                        }}
                        className="min-h-[36px] rounded-lg bg-rose-400 px-3 py-1 font-semibold text-[#0b0a10]"
                      >
                        Confirm Wipe
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmWipe(false)}
                        className="text-[#9e97b0]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {simThreads.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setSimThreads(['Restored local sample thread'])}
                      className="text-[#a58ff8] hover:underline"
                    >
                      Add sample thread
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Source Code Inspector */}
        <section className="rounded-2xl border border-white/10 bg-[#13111d] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[#a58ff8]" />
              <h2 className="text-base font-bold text-[#f6f4fc]">
                Inspect Native Kotlin, Jetpack Compose &amp; Play Release Files
              </h2>
            </div>

            {audit && (
              <label className="flex items-center gap-2 text-xs">
                <span className="text-[#9e97b0]">File:</span>
                <select
                  aria-label="Select Android project file to inspect"
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="max-w-full rounded-lg border border-white/15 bg-[#0b0a10] px-3 py-2 font-mono text-xs text-[#f6f4fc]"
                >
                  {audit.files.map((f) => (
                    <option key={f.relativePath} value={f.relativePath}>
                      {f.relativePath} ({f.lineCount} lines)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <pre className="max-h-[420px] overflow-auto rounded-xl border border-white/10 bg-[#0b0a10] p-4 font-mono text-xs leading-relaxed text-[#dfd9f2]">
            {loadingFile ? 'Loading source file…' : fileContent}
          </pre>
        </section>

        {/* Manual Steps Remaining for Google Play Internal Testing */}
        <section className="rounded-2xl border border-white/10 bg-[#13111d] p-6 space-y-3 text-xs leading-relaxed text-[#b5add0]">
          <h2 className="text-base font-bold text-[#f6f4fc]">
            Manual Steps Required for Google Play Console Internal Testing
          </h2>
          <p>
            Automated builds can compile and unit-test the Android project, but publishing to Google
            Play Internal Testing requires account-level credentials and manual Play Console actions:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              <strong className="text-[#f6f4fc]">Google Play Developer Account:</strong> Register and
              complete developer identity verification in Google Play Console (one-time $25 USD
              Google Play registration fee applies externally if you do not already hold an account).
            </li>
            <li>
              <strong className="text-[#f6f4fc]">Generate Upload Keystore Locally:</strong> Run{' '}
              <code className="font-mono">
                keytool -genkeypair -v -keystore aurenyx-vaelor-upload.jks -keyalg RSA -keysize 2048
                -validity 10000 -alias vaelor-upload
              </code>{' '}
              and reference it in untracked <code className="font-mono">android/keystore.properties</code>{' '}
              (or GitHub Actions Secrets).
            </li>
            <li>
              <strong className="text-[#f6f4fc]">Deploy Production HTTPS Backend:</strong> Host{' '}
              <code className="font-mono">server.ts</code> with <code className="font-mono">GEMINI_API_KEY</code>{' '}
              in server environment variables and pass{' '}
              <code className="font-mono">-PVAELOR_BACKEND_URL=https://your-production-host</code>{' '}
              during <code className="font-mono">./gradlew bundleRelease</code>.
            </li>
            <li>
              <strong className="text-[#f6f4fc]">Optional Firebase AI Logic + App Check:</strong> If
              enabling direct client Gemini calls, download <code className="font-mono">google-services.json</code>{' '}
              into <code className="font-mono">android/app/</code> and register Play App Signing’s
              SHA-256 certificate in Firebase App Check (Play Integrity).
            </li>
            <li>
              <strong className="text-[#f6f4fc]">Upload Signed .aab &amp; Add Internal Testers:</strong>{' '}
              In Play Console → <em>Testing → Internal testing</em>, upload{' '}
              <code className="font-mono">app/build/outputs/bundle/release/app-release.aab</code>,
              complete the Data Safety &amp; Content Rating declarations truthfully, add up to 100
              tester email addresses, and share the opt-in link.
            </li>
          </ol>
        </section>
      </div>

      <OfficialFooter />
    </div>
  );
};
