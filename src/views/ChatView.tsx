import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUp,
  BarChart3,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Compass,
  Copy,
  Download,
  FileText,
  Frame,
  Layers,
  Mic,
  MicOff,
  Paperclip,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Square,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { VaelorEmblem } from '../components/VaelorEmblem';
import { MarkdownView } from '../components/MarkdownView';
import {
  OFFICIAL_ATTRIBUTION,
  type AgentId,
  type ChatMessage,
  type ImageAspectRatio,
  type ImageResolutionSize,
} from '../shared/types';

const SUGGESTED_PROMPTS = [
  {
    title: 'Research a complex topic',
    subtitle: 'Separate verified facts, assumptions, and unknowns',
    prompt:
      'Create a structured research plan to evaluate next-generation geothermal energy systems, explicitly separating established facts, working assumptions, and open unknowns.',
    icon: Compass,
  },
  {
    title: 'Analyze a PDF or document',
    subtitle: 'Retrieve passages with grounded citations',
    prompt:
      'According to the Aurenyx Vaelor 0.1 Architecture & Security Brief in the Knowledge workspace, how are memory layers separated and what security invariants protect API keys?',
    icon: FileText,
  },
  {
    title: 'Design a software project',
    subtitle: 'Modular ₹0 free-tier system blueprint',
    prompt:
      'Design a beginner-friendly, modular TypeScript full-stack architecture for an offline-capable personal study tracker that runs within ₹0 free-tier limits.',
    icon: Layers,
  },
  {
    title: 'Write and review code',
    subtitle: 'Clean implementation plus unit test cases',
    prompt:
      'Write a clean TypeScript sliding-window rate limiter function without external dependencies, review its edge cases, and provide node:test unit tests.',
    icon: Code2,
  },
  {
    title: 'Analyze CSV & generate SVG chart',
    subtitle: 'Deterministic column stats + visual bar chart',
    prompt:
      'Visualize a bar chart for Q1=120, Q2=165, Q3=210, Q4=260 and summarize the quarterly growth trend in a Markdown table.',
    icon: BarChart3,
  },
  {
    title: 'Develop a business strategy',
    subtitle: 'Milestones, risks, and validation metrics',
    prompt:
      'Develop a practical 90-day validation and launch strategy for a solo founder building an open-source developer productivity tool on a ₹0 marketing budget.',
    icon: Briefcase,
  },
];

const ASPECT_RATIOS: ImageAspectRatio[] = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '21:9',
];

const IMAGE_SIZES: ImageResolutionSize[] = ['1K', '2K', '4K'];

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const MessageItem: React.FC<{
  message: ChatMessage;
  onRetry: (prompt: string) => void;
}> = ({ message, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const [traceExpanded, setTraceExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const isUser = message.role === 'user';
  const run = message.taskRun;
  const timeStr = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopy = () => {
    void navigator.clipboard?.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([message.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaelor-response-${message.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="py-5 border-b border-white/[0.06] last:border-b-0">
      <div className="flex items-start gap-3.5">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${
            isUser
              ? 'border-white/12 bg-[#1a1726] text-[#dcd6ec]'
              : 'border-[#8b6ff7]/35 bg-[#1d1632] text-[#cbbaff]'
          }`}
        >
          {isUser ? 'You' : 'V'}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          {/* Unboxed clean metadata line (Zero-Pill Discipline) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#958ea8]">
            <strong className="font-semibold text-[#f1eef9]">
              {isUser ? 'You' : message.agentName || 'Vaelor Core'}
            </strong>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{timeStr}</span>

            {message.isStreaming && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#a58ff8]">Streaming response…</span>
              </>
            )}

            {!isUser && run && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {run.stepCount}/{run.maxSteps} model calls
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{run.durationMs} ms</span>
                {run.sentinelReview && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`inline-flex items-center gap-1 ${
                        run.sentinelReview.status === 'flagged'
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      {run.sentinelReview.status === 'flagged' ? (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {run.sentinelReview.status === 'flagged'
                          ? 'Sentinel flagged'
                          : run.sentinelReview.status === 'verified'
                            ? 'Sentinel reviewed'
                            : 'Deterministic check'}
                      </span>
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          {/* Attached File Metadata */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="text-xs text-[#a59ec0]">
              Attached:{' '}
              {message.attachments
                .map((a) => `${a.name} (${Math.max(1, Math.round(a.sizeBytes / 1024))} KB)`)
                .join(' · ')}
            </div>
          )}

          {/* Message Body or Error State */}
          {message.error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/25 p-4 text-sm text-rose-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div className="space-y-2">
                  <p className="font-medium">{message.error.message}</p>
                  <p className="font-mono text-xs text-rose-300/80">
                    Code: {message.error.code}
                  </p>
                  {message.failedPrompt && (
                    <button
                      type="button"
                      onClick={() => onRetry(message.failedPrompt!)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-950/50 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-900/50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Retry request</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <MarkdownView
              content={message.content || (message.isStreaming ? 'Synthesizing…' : '')}
            />
          )}

          {/* Optional SVG Chart or Architectural Blueprint Preview */}
          {message.generatedSvgBlueprint && (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#0d0b14] p-3">
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(
                  message.generatedSvgBlueprint
                )}`}
                alt="Generated SVG visualization artifact"
                referrerPolicy="no-referrer"
                className="mx-auto max-h-[380px] w-auto rounded-lg border border-white/8"
              />
            </div>
          )}

          {/* Grounded Citations */}
          {!isUser && run && run.citations.length > 0 && (
            <div className="pt-1 space-y-1.5">
              <p className="text-xs font-medium text-[#b5add0]">Supporting Sources</p>
              <div className="space-y-1.5">
                {run.citations.map((cit) => (
                  <div
                    key={cit.id}
                    className="rounded-lg border border-white/8 bg-[#12101c] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 text-[#ded8f0]">
                      <span className="font-medium">{cit.sourceTitle}</span>
                      <Link
                        to="/knowledge"
                        className="text-[#a58ff8] hover:underline whitespace-nowrap shrink-0"
                      >
                        View in Knowledge
                      </Link>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[#968fa9]">{cit.excerpt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar: Copy + Download + Expandable Orchestrator Trace + Expandable Tool Outputs */}
          {!isUser && !message.error && !message.isStreaming && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/8 bg-[#13111d] px-2.5 py-1 text-xs text-[#b5add0] hover:border-white/20 hover:text-white whitespace-nowrap"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copied ? 'Copied' : 'Copy response'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/8 bg-[#13111d] px-2.5 py-1 text-xs text-[#b5add0] hover:border-white/20 hover:text-white whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download .md</span>
              </button>

              {run && (
                <button
                  type="button"
                  aria-expanded={traceExpanded}
                  onClick={() => setTraceExpanded((v) => !v)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/8 bg-[#13111d] px-2.5 py-1 text-xs text-[#b5add0] hover:border-white/20 hover:text-white whitespace-nowrap"
                >
                  {traceExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  <span>Execution details</span>
                </button>
              )}

              {run && run.toolCalls.length > 0 && (
                <button
                  type="button"
                  aria-expanded={toolsExpanded}
                  onClick={() => setToolsExpanded((v) => !v)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/8 bg-[#13111d] px-2.5 py-1 text-xs text-[#b5add0] hover:border-white/20 hover:text-white whitespace-nowrap"
                >
                  <Wrench className="h-3.5 w-3.5 text-[#a58ff8]" />
                  <span>Tools ({run.toolCalls.length})</span>
                </button>
              )}
            </div>
          )}

          {/* Expandable Execution Trace Panel */}
          {traceExpanded && run && (
            <div className="mt-2 rounded-xl border border-white/8 bg-[#110f1a] p-3.5 text-xs text-[#b8b1cc] space-y-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-[#9b93b2]">
                <span>Task ID: {run.taskId}</span>
                <span>·</span>
                <span>Type: {run.taskType}</span>
                <span>·</span>
                <span>Model: {run.modelUsed || 'gemini-3.1-flash-lite'}</span>
                <span>·</span>
                <span>
                  Permitted tools:{' '}
                  {run.permittedTools.length > 0 ? run.permittedTools.join(', ') : 'none'}
                </span>
              </div>

              <div>
                <p className="font-medium text-[#e4dff2]">Orchestrator Plan</p>
                <ol className="mt-1 space-y-1 pl-4 list-decimal text-[#a9a2be]">
                  {run.planSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              {run.sentinelReview && (
                <div className="border-t border-white/8 pt-2">
                  <p className="font-medium text-[#e4dff2]">
                    Vaelor Sentinel Verification ({run.sentinelReview.status})
                  </p>
                  <p className="mt-0.5 text-[#a9a2be]">{run.sentinelReview.summary}</p>
                  {run.sentinelReview.flags.length > 0 && (
                    <ul className="mt-1.5 space-y-1 text-amber-200/90">
                      {run.sentinelReview.flags.map((flag, idx) => (
                        <li key={idx}>• {flag}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Expandable Tool Results Panel */}
          {toolsExpanded && run && run.toolCalls.length > 0 && (
            <div className="mt-2 rounded-xl border border-white/8 bg-[#110f1a] p-3.5 text-xs space-y-2.5">
              {run.toolCalls.map((tc, i) => (
                <div
                  key={i}
                  className="space-y-1 border-b border-white/6 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                    <span className="font-semibold text-[#e4dff2]">{tc.tool}</span>
                    <span className="text-[#958ea8]">
                      {tc.status} · {tc.durationMs} ms
                    </span>
                  </div>
                  {tc.error ? (
                    <p className="text-rose-300">{tc.error}</p>
                  ) : (
                    <pre className="max-h-40 overflow-auto rounded-lg bg-[#09080f] p-2 font-mono text-[11px] text-[#cfc8e2]">
                      {tc.output}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export const ChatView: React.FC = () => {
  const {
    gatewayState,
    activeConversation,
    clearActiveConversation,
    draftInput,
    setDraftInput,
    preferredAgent,
    setPreferredAgent,
    useSentinel,
    setUseSentinel,
    researchMode,
    setResearchMode,
    pendingAttachments,
    addAttachment,
    removeAttachment,
    isSending,
    activeStage,
    composerError,
    dismissComposerError,
    sendMessage,
    stopWaiting,
    retryFailedMessage,
    generateVisualBlueprint,
    projects,
    activeProjectId,
    setActiveProjectId,
  } = useWorkspace();

  const [showVisualSpec, setShowVisualSpec] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('16:9');
  const [imageSize, setImageSize] = useState<ImageResolutionSize>('1K');
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    if (activeConversation.messages.length > 0 || isSending) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation.messages.length, isSending]);

  const hasMessages = activeConversation.messages.length > 0;
  const hasStreamingMessage = activeConversation.messages.some((m) => m.isStreaming);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftInput.trim() || isSending) return;
    void sendMessage();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAttachmentNotice(null);

    if (file.size > 1_048_576) {
      setAttachmentNotice('File exceeds the 1 MB attachment safety limit.');
      return;
    }

    const lower = file.name.toLowerCase();
    const isImage =
      file.type === 'image/png' ||
      file.type === 'image/jpeg' ||
      file.type === 'image/webp' ||
      /\.(png|jpe?g|webp)$/.test(lower);

    const isText =
      file.type.startsWith('text/') ||
      file.type === 'application/json' ||
      /\.(txt|md|csv|json)$/.test(lower);

    if (!isImage && !isText) {
      setAttachmentNotice(
        'Supported attachments: .txt, .md, .csv, .json, and PNG/JPEG/WEBP images (up to 1 MB).'
      );
      return;
    }

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = typeof reader.result === 'string' ? reader.result : '';
        const base64Data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        addAttachment({
          id: `att_${crypto.randomUUID().slice(0, 8)}`,
          name: file.name,
          mimeType: file.type || 'image/png',
          kind: 'image',
          sizeBytes: file.size,
          base64Data,
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    const textContent = (await file.text()).slice(0, 30000);
    addAttachment({
      id: `att_${crypto.randomUUID().slice(0, 8)}`,
      name: file.name,
      mimeType: file.type || 'text/plain',
      kind: 'text',
      sizeBytes: file.size,
      textContent,
    });
  };

  const handleToggleVoice = () => {
    setAttachmentNotice(null);
    if (isListening && speechRef.current) {
      speechRef.current.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechCtor) {
      setAttachmentNotice(
        'Browser speech recognition is not supported in this browser environment. Type your prompt directly.'
      );
      return;
    }

    try {
      const recognition = new SpeechCtor();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? '';
        if (transcript) {
          setDraftInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => {
        setIsListening(false);
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      speechRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setAttachmentNotice('Voice capture could not be started in this browser context.');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable Conversation Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          {/* Honest Setup / Offline Banner */}
          {gatewayState === 'setup' && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-950/25 p-4 text-xs leading-relaxed text-amber-200">
              <strong className="font-semibold text-amber-100">Model Setup Required:</strong> The
              Express backend is online, but <code className="font-mono">GEMINI_API_KEY</code> is
              not yet set on the server. Add your Gemini API key in server Secrets or{' '}
              <code className="font-mono">.env</code> (never in frontend files) to enable live model
              responses.
            </div>
          )}

          {gatewayState === 'offline' && (
            <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-950/25 p-4 text-xs leading-relaxed text-rose-200">
              <strong className="font-semibold text-rose-100">Backend Unavailable:</strong> Unable
              to reach <code className="font-mono">/api/health</code>. Verify that the Node server
              is running on port 3000.
            </div>
          )}

          {!hasMessages ? (
            /* Welcome Screen */
            <div className="py-4 sm:py-8">
              <div className="flex flex-col items-start text-left">
                <VaelorEmblem size="lg" className="mb-5" />
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#a792fa]">
                  <span className="font-medium">{OFFICIAL_ATTRIBUTION.tagline}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#958ea8]">
                    By {OFFICIAL_ATTRIBUTION.founderOrganization} · Founded by{' '}
                    {OFFICIAL_ATTRIBUTION.founderName}
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#f6f4fc] sm:text-4xl">
                  Welcome to AURENYX VAELOR.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#a8a1bd] sm:text-base">
                  An intelligent workspace for research, reasoning, creation, engineering, and
                  verified synthesis. Tasks are classified, routed to specialized agents, checked
                  against server-side tool allowlists, and audited by Vaelor Sentinel.
                </p>
              </div>

              {/* 6 Functional Suggested Prompt Cards */}
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => {
                        setDraftInput(card.prompt);
                        textareaRef.current?.focus();
                      }}
                      className="group flex min-h-[88px] flex-col justify-between rounded-xl border border-white/8 bg-[#13111d] p-4 text-left transition-colors hover:border-[#8b6ff7]/45 hover:bg-[#181526] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6ff7]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-[#a58ff8]" />
                          <span className="text-sm font-semibold text-[#f3f0fa]">{card.title}</span>
                        </div>
                        <ArrowUp className="h-4 w-4 shrink-0 rotate-45 text-[#7a738f] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#b9a6fb]" />
                      </div>
                      <p className="mt-2 text-xs text-[#968fa9]">{card.subtitle}</p>
                    </button>
                  );
                })}
              </div>

              {/* Integrated Platform Feature Suites (TrustGrid + Native Android) */}
              <div className="mt-6 space-y-2.5">
                <p className="text-xs font-semibold tracking-wide text-[#958ea8] uppercase">
                  Integrated Platform Features
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Link
                    to="/trustgrid"
                    className="group flex min-h-[88px] flex-col justify-between rounded-xl border border-[#35C8FF]/25 bg-[#0B1B30]/75 p-4 text-left transition-colors hover:border-[#35C8FF]/60 hover:bg-[#0B1B30]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-[#35C8FF]" />
                        <span className="text-sm font-semibold text-[#F3F7FF]">
                          AURENYX TRUSTGRID
                        </span>
                      </div>
                      <ArrowUp className="h-4 w-4 shrink-0 rotate-45 text-[#35C8FF] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <p className="mt-2 text-xs text-[#AEBFD4]">
                      Turn AI innovation into trust · 15-question risk review, safety tests &amp; AI Workflow Passport
                    </p>
                  </Link>

                  <Link
                    to="/android"
                    className="group flex min-h-[88px] flex-col justify-between rounded-xl border border-[#8b6ff7]/25 bg-[#13111d] p-4 text-left transition-colors hover:border-[#8b6ff7]/60 hover:bg-[#181526]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="h-4 w-4 shrink-0 text-[#a58ff8]" />
                        <span className="text-sm font-semibold text-[#f3f0fa]">
                          Native Android App
                        </span>
                      </div>
                      <ArrowUp className="h-4 w-4 shrink-0 rotate-45 text-[#a58ff8] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <p className="mt-2 text-xs text-[#968fa9]">
                      Kotlin + Jetpack Compose · Firebase AI Logic + App Check · Google Play Internal Testing
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* Active Conversation Feed */
            <div>
              <div className="mb-2 flex items-center justify-between border-b border-white/8 pb-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-[#f1eef9]">
                    {activeConversation.title}
                  </h2>
                  <p className="text-xs text-[#8f88a3]">
                    {activeConversation.messages.length} messages · Bounded context window (last 8
                    turns)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearActiveConversation}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#14121f] px-3 py-1.5 text-xs font-medium text-[#cfc8e2] hover:border-white/20 hover:text-white whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear conversation</span>
                </button>
              </div>

              <div>
                {activeConversation.messages.map((msg) => (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    onRetry={(failed) => void retryFailedMessage(failed)}
                  />
                ))}

                {isSending && !hasStreamingMessage && (
                  <div className="py-5 flex items-start gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#8b6ff7]/40 bg-[#1d1632] text-xs font-semibold text-[#cbbaff]">
                      V
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-semibold text-[#f1eef9]">Orchestrator Working</p>
                      <p className="text-xs text-[#a59ec0]">{activeStage}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom Chat Composer */}
      <div className="shrink-0 border-t border-white/8 bg-[#0d0b14] px-4 py-3 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-2.5">
          {composerError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-950/35 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <span>{composerError}</span>
              <button
                type="button"
                onClick={dismissComposerError}
                aria-label="Dismiss error banner"
                className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-rose-200 hover:bg-white/8"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {attachmentNotice && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#14121f] px-3.5 py-2 text-xs text-[#cfc8e2]">
              <span>{attachmentNotice}</span>
              <button
                type="button"
                onClick={() => setAttachmentNotice(null)}
                aria-label="Dismiss attachment notice"
                className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-[#9e97b0] hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Optional Collapsible Visual Frame Spec Bar */}
          {showVisualSpec && (
            <div className="rounded-xl border border-white/10 bg-[#141220] p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#ece8f6]">
                  Visual Frame Specification · ₹0 Free-Tier Guardrail Active
                </p>
                <button
                  type="button"
                  onClick={() => setShowVisualSpec(false)}
                  aria-label="Close visual specification controls"
                  className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[#9e97b0] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-[#9b94b0]">
                Studio raster models (<code className="font-mono">gemini-3-pro-image</code> /{' '}
                <code className="font-mono">gemini-nano-banana-2.1</code>) require a paid API key. In
                ₹0 mode, Vaelor generates a zero-cost SVG architectural frame matching your chosen
                aspect ratio and resolution spec.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-[#cfc8e2]">
                  <span>Aspect Ratio</span>
                  <select
                    aria-label="Visual aspect ratio"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as ImageAspectRatio)}
                    className="min-h-[38px] rounded-lg border border-white/12 bg-[#0e0c16] px-2.5 py-1.5 text-xs text-[#f1eef9]"
                  >
                    {ASPECT_RATIOS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#cfc8e2]">
                  <span>Target Size</span>
                  <select
                    aria-label="Visual image resolution size"
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value as ImageResolutionSize)}
                    className="min-h-[38px] rounded-lg border border-white/12 bg-[#0e0c16] px-2.5 py-1.5 text-xs text-[#f1eef9]"
                  >
                    {IMAGE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  disabled={!draftInput.trim() || isSending}
                  onClick={() =>
                    void generateVisualBlueprint({
                      prompt: draftInput,
                      aspectRatio,
                      imageSize,
                    })
                  }
                  className="min-h-[38px] rounded-lg bg-[#27203d] px-3.5 py-1.5 text-xs font-semibold text-[#e6dfff] hover:bg-[#332a50] disabled:opacity-45 whitespace-nowrap"
                >
                  Generate Frame Blueprint
                </button>
              </div>
            </div>
          )}

          {/* Main Composer Form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/12 bg-[#14121f] p-3 focus-within:border-[#8b6ff7]/60 transition-colors"
          >
            {/* Pending Attachments Row */}
            {pendingAttachments.length > 0 && (
              <div className="mb-2.5 flex flex-wrap items-center gap-2 border-b border-white/8 pb-2">
                {pendingAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0e0c16] px-2.5 py-1 text-xs text-[#e4dff2]"
                  >
                    <span className="truncate max-w-[180px] font-medium">{att.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-[#8f88a3]">
                      {Math.max(1, Math.round(att.sizeBytes / 1024))} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      aria-label={`Remove attachment ${att.name}`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-[#9e97b0] hover:text-rose-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.json,image/png,image/jpeg,image/webp"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />

            <label htmlFor="vaelor-chat-input" className="sr-only">
              Message Aurenyx Vaelor
            </label>
            <textarea
              id="vaelor-chat-input"
              ref={textareaRef}
              value={draftInput}
              onChange={(e) => setDraftInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (draftInput.trim() && !isSending) {
                    void sendMessage();
                  }
                }
              }}
              rows={2}
              maxLength={8000}
              placeholder="Ask Vaelor to research, architect, analyze CSV/JSON files, inspect images, write code, or verify claims…"
              className="w-full resize-none bg-transparent text-sm leading-relaxed text-[#f5f3fc] placeholder-[#7f7894] focus:outline-none"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2.5">
              {/* Left Routing & Context Controls */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file or image"
                  className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/10 bg-[#0e0c16] px-2.5 text-xs text-[#b5add0] hover:border-white/20 hover:text-white shrink-0"
                >
                  <Paperclip className="h-3.5 w-3.5 text-[#a58ff8]" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleVoice}
                  aria-pressed={isListening}
                  aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                  className={`inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border px-2.5 text-xs transition-colors shrink-0 ${
                    isListening
                      ? 'border-amber-400/50 bg-amber-950/40 text-amber-200'
                      : 'border-white/10 bg-[#0e0c16] text-[#b5add0] hover:border-white/20'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5 text-[#a58ff8]" />
                  )}
                </button>

                <label className="sr-only" htmlFor="agent-route-select">
                  Select specialist agent
                </label>
                <select
                  id="agent-route-select"
                  value={preferredAgent}
                  onChange={(e) => setPreferredAgent(e.target.value as AgentId | 'auto')}
                  className="min-h-[40px] max-w-[138px] sm:max-w-none rounded-lg border border-white/10 bg-[#0e0c16] px-2 py-1 text-xs text-[#dbd5ec] focus:outline-none focus:border-[#8b6ff7] shrink-0"
                >
                  <option value="auto">Auto Orchestrate</option>
                  <option value="aurenyx-research">Aurenyx Research</option>
                  <option value="vaelor-forge">Vaelor Forge</option>
                  <option value="vaelor-knowledge">Vaelor Knowledge</option>
                  <option value="vaelor-sentinel">Vaelor Sentinel</option>
                  <option value="vaelor-core">Vaelor Core</option>
                </select>

                {projects.length > 0 && (
                  <>
                    <label className="sr-only" htmlFor="project-context-select">
                      Active project context
                    </label>
                    <select
                      id="project-context-select"
                      value={activeProjectId || ''}
                      onChange={(e) => setActiveProjectId(e.target.value || undefined)}
                      className="hidden md:inline-block min-h-[40px] max-w-[155px] truncate rounded-lg border border-white/10 bg-[#0e0c16] px-2.5 py-1 text-xs text-[#b5add0] shrink-0"
                    >
                      <option value="">No project scope</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setResearchMode((v) => !v)}
                  aria-pressed={researchMode}
                  aria-label="Toggle Research Mode"
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                    researchMode
                      ? 'border-[#8b6ff7]/40 bg-[#1d1731] text-[#dfd7fc]'
                      : 'border-white/10 bg-[#0e0c16] text-[#8f88a3]'
                  }`}
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Research</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseSentinel((v) => !v)}
                  aria-pressed={useSentinel}
                  aria-label="Toggle Sentinel answer verification"
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                    useSentinel
                      ? 'border-[#8b6ff7]/40 bg-[#1d1731] text-[#dfd7fc]'
                      : 'border-white/10 bg-[#0e0c16] text-[#8f88a3]'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sentinel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowVisualSpec((v) => !v)}
                  aria-expanded={showVisualSpec}
                  aria-label="Toggle visual frame specification"
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#0e0c16] px-2.5 py-1 text-xs text-[#b5add0] hover:border-white/20 hover:text-white whitespace-nowrap shrink-0"
                >
                  <Frame className="h-3.5 w-3.5 text-[#a58ff8]" />
                  <span className="hidden sm:inline">Visual Spec</span>
                </button>
              </div>

              {/* Right Send / Stop Action */}
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {isSending ? (
                  <button
                    type="button"
                    onClick={stopWaiting}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-950/40 px-3.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900/50 whitespace-nowrap"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!draftInput.trim()}
                    aria-label="Send message"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#8b6ff7] px-3.5 sm:px-4 py-2 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                  >
                    <span>Send</span>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </form>

          <p className="text-center text-[11px] text-[#7e7793]">
            {OFFICIAL_ATTRIBUTION.statement} · Sentinel review assists verification; confirm critical
            decisions independently.
          </p>
        </div>
      </div>
    </div>
  );
};
