import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Play,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { OfficialFooter } from '../components/OfficialFooter';
import { MarkdownView } from '../components/MarkdownView';
import type { AgentId } from '../shared/types';

export const TasksView: React.FC = () => {
  const {
    tasks,
    projects,
    activeProjectId,
    evaluationSuite,
    startNewConversation,
    setPreferredAgent,
    planWorkflowTask,
    executeWorkflowTask,
  } = useWorkspace();

  const [viewMode, setViewMode] = useState<'workflow' | 'history' | 'evaluation'>('workflow');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed'>('all');
  const [query, setQuery] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Workflow Lifecycle (DRAFT -> PLAN -> APPROVAL_REQUIRED -> EXECUTE_TOOLS -> VERIFY -> COMPLETED / FAILED)
  const [wfTitle, setWfTitle] = useState('');
  const [wfObjective, setWfObjective] = useState('');
  const [wfAgent, setWfAgent] = useState<AgentId | 'auto'>('auto');
  const [wfRequiresApproval, setWfRequiresApproval] = useState(true);
  const [wfResearchMode, setWfResearchMode] = useState(false);
  const [wfMockMode, setWfMockMode] = useState(true);
  const [wfBusy, setWfBusy] = useState(false);
  const [wfMessage, setWfMessage] = useState<string | null>(null);
  const [wfError, setWfError] = useState<string | null>(null);

  // Quick Code Static Reviewer Sandbox (14th Tool in v0.3)
  const [sampleCode, setSampleCode] = useState(
    `export function runUntrusted(input: string) {\n  const token = "demo";\n  return eval(input);\n}`
  );
  const [staticReviewOutput, setStaticReviewOutput] = useState<string | null>(null);
  const [reviewingCode, setReviewingCode] = useState(false);

  const navigate = useNavigate();

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
      if (statusFilter === 'failed' && t.status !== 'failed') return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          t.userRequest.toLowerCase().includes(q) ||
          (t.title || '').toLowerCase().includes(q) ||
          t.agentName.toLowerCase().includes(q) ||
          t.taskId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, statusFilter, query]);

  const handleCreateWorkflowPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setWfError(null);
    setWfMessage(null);
    if (wfTitle.trim().length < 2) {
      setWfError('Enter a workflow task title (at least 2 characters).');
      return;
    }
    if (wfObjective.trim().length < 4) {
      setWfError('Enter a clear task objective (at least 4 characters).');
      return;
    }
    setWfBusy(true);
    const res = await planWorkflowTask({
      title: wfTitle.trim(),
      objective: wfObjective.trim(),
      preferredAgent: wfAgent === 'auto' ? undefined : wfAgent,
      projectId: activeProjectId,
      researchMode: wfResearchMode,
      requiresApproval: wfRequiresApproval,
    });
    setWfBusy(false);

    if (!res.ok || !res.task) {
      setWfError(res.error || 'Could not generate task plan.');
      return;
    }
    setWfTitle('');
    setWfObjective('');
    setExpandedTaskId(res.task.taskId);
    setWfMessage(
      res.task.requiresApproval
        ? `Plan ${res.task.taskId} created and paused at APPROVAL_REQUIRED. Review the planned steps below and click Approve & Execute.`
        : `Plan ${res.task.taskId} created in PLAN stage. Click Execute Plan below to run.`
    );
  };

  const handleRunPlannedTask = async (taskId: string, confirmedByUser: boolean) => {
    setWfError(null);
    setWfMessage(null);
    setWfBusy(true);
    const res = await executeWorkflowTask(taskId, {
      confirmedByUser,
      mockMode: wfMockMode,
      useSentinel: true,
    });
    setWfBusy(false);
    setExpandedTaskId(taskId);
    if (!res.ok) {
      setWfError(res.error || 'Workflow execution halted safely.');
      return;
    }
    setWfMessage(`Workflow ${taskId} completed and verified by Vaelor Sentinel.`);
  };

  const handleRunStaticReviewer = async () => {
    if (!sampleCode.trim()) return;
    setReviewingCode(true);
    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'code_static_reviewer',
          args: { code: sampleCode, language: 'typescript' },
        }),
      });
      const json = (await res.json()) as { record?: { output: string }; error?: string };
      setStaticReviewOutput(json.record?.output || json.error || 'No output.');
    } finally {
      setReviewingCode(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
            Tasks, Workflow Lifecycle &amp; Evaluation Suite
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
            Plan bounded multi-stage workflows (<code className="font-mono">DRAFT → PLAN → APPROVAL_REQUIRED → EXECUTE_TOOLS → VERIFY</code>),
            inspect session-isolated orchestrator records, or run the 12-case evaluation suite.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="inline-flex flex-wrap rounded-xl border border-white/10 bg-[#13111d] p-1 gap-1">
          <button
            type="button"
            onClick={() => setViewMode('workflow')}
            className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              viewMode === 'workflow'
                ? 'bg-[#251e3d] text-[#f5f3fc]'
                : 'text-[#9e97b0] hover:text-white'
            }`}
          >
            Workflow Lifecycle
          </button>
          <button
            type="button"
            onClick={() => setViewMode('history')}
            className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
              viewMode === 'history'
                ? 'bg-[#251e3d] text-[#f5f3fc]'
                : 'text-[#9e97b0] hover:text-white'
            }`}
          >
            Task Run History ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('evaluation')}
            className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
              viewMode === 'evaluation'
                ? 'bg-[#251e3d] text-[#f5f3fc]'
                : 'text-[#9e97b0] hover:text-white'
            }`}
          >
            Evaluation &amp; Code Sandbox ({evaluationSuite.length})
          </button>
        </div>

        {viewMode === 'workflow' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Create Task Plan Form */}
            <section className="lg:col-span-5">
              <form
                onSubmit={(e) => void handleCreateWorkflowPlan(e)}
                className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4"
              >
                <div>
                  <h2 className="text-sm font-semibold text-[#f5f3fc]">
                    Draft Controlled Task Plan
                  </h2>
                  <p className="mt-0.5 text-xs text-[#958ea8]">
                    Generates a bounded stage plan and tool allowlist before running any model
                    inference.
                  </p>
                </div>

                {wfError && (
                  <p role="alert" className="text-xs text-rose-300">
                    {wfError}
                  </p>
                )}
                {wfMessage && <p className="text-xs text-emerald-300">{wfMessage}</p>}

                <div className="space-y-1.5">
                  <label htmlFor="wf-title" className="block text-xs font-medium text-[#cfc8e2]">
                    Task Title
                  </label>
                  <input
                    id="wf-title"
                    type="text"
                    value={wfTitle}
                    onChange={(e) => setWfTitle(e.target.value)}
                    maxLength={120}
                    placeholder="e.g., Audit Q3 Budget & Code Safety"
                    className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="wf-objective" className="block text-xs font-medium text-[#cfc8e2]">
                    Objective &amp; Inputs
                  </label>
                  <textarea
                    id="wf-objective"
                    rows={3}
                    value={wfObjective}
                    onChange={(e) => setWfObjective(e.target.value)}
                    maxLength={2000}
                    placeholder="e.g., Calculate (1250 * 4) - 320 and summarize bounded execution safeguards."
                    className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="wf-agent" className="block text-xs font-medium text-[#cfc8e2]">
                    Specialist Routing
                  </label>
                  <select
                    id="wf-agent"
                    value={wfAgent}
                    onChange={(e) => setWfAgent(e.target.value as AgentId | 'auto')}
                    className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-xs text-[#f5f3fc]"
                  >
                    <option value="auto">Auto Classify Specialist</option>
                    <option value="vaelor-core">Vaelor Core</option>
                    <option value="aurenyx-research">Vaelor Research</option>
                    <option value="vaelor-forge">Vaelor Forge</option>
                    <option value="vaelor-analyst">Vaelor Analyst</option>
                    <option value="vaelor-knowledge">Vaelor Knowledge</option>
                    <option value="vaelor-sentinel">Vaelor Sentinel</option>
                  </select>
                </div>

                {activeProjectId && (
                  <p className="text-xs text-[#958ea8]">
                    Scoped to active project:{' '}
                    <span className="text-[#ded8f0]">
                      {projects.find((p) => p.id === activeProjectId)?.name || activeProjectId}
                    </span>
                  </p>
                )}

                <div className="space-y-2 pt-1 text-xs text-[#cfc8e2]">
                  <label className="flex min-h-[36px] items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wfRequiresApproval}
                      onChange={(e) => setWfRequiresApproval(e.target.checked)}
                      className="h-4 w-4 accent-[#8b6ff7]"
                    />
                    <span>Pause at APPROVAL_REQUIRED before execution</span>
                  </label>

                  <label className="flex min-h-[36px] items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wfResearchMode}
                      onChange={(e) => setWfResearchMode(e.target.checked)}
                      className="h-4 w-4 accent-[#8b6ff7]"
                    />
                    <span>Enable Research Mode evidence grading</span>
                  </label>

                  <label className="flex min-h-[36px] items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wfMockMode}
                      onChange={(e) => setWfMockMode(e.target.checked)}
                      className="h-4 w-4 accent-[#8b6ff7]"
                    />
                    <span>Execute in Local Mock Mode (₹0 zero-quota simulation)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={wfBusy}
                  className="min-h-[44px] w-full rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50"
                >
                  {wfBusy ? 'Planning…' : 'Create Task Plan'}
                </button>
              </form>
            </section>

            {/* Planned & Executed Workflow Queue */}
            <section className="lg:col-span-7 space-y-3">
              <h2 className="text-sm font-semibold text-[#e4dff2] tabular-nums">
                Session Workflow Queue ({tasks.length})
              </h2>

              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-[#12101b] p-8 text-center space-y-2">
                  <p className="text-sm font-medium text-[#e4dff2]">No workflow tasks yet</p>
                  <p className="text-xs text-[#918aa6]">
                    Draft a task plan on the left to inspect its bounded stages, approve execution,
                    and verify completion.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const isExpanded = expandedTaskId === task.taskId;
                    const stageLabel =
                      task.lifecycleStage ||
                      (task.status === 'completed'
                        ? 'COMPLETED'
                        : task.status === 'failed'
                          ? 'FAILED'
                          : 'PLAN');
                    const isPendingExecution =
                      stageLabel === 'PLAN' || stageLabel === 'APPROVAL_REQUIRED';

                    return (
                      <article
                        key={task.taskId}
                        className="rounded-2xl border border-white/8 bg-[#13111d] p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#958ea8] tabular-nums">
                              <span className="font-mono font-semibold text-[#e6e1f6]">
                                {task.taskId}
                              </span>
                              <span>·</span>
                              <span className="font-mono text-[#c5b3fc]">{stageLabel}</span>
                              <span>·</span>
                              <span className="text-[#cfc8e2]">{task.agentName}</span>
                              {task.researchStatusLabel && (
                                <>
                                  <span>·</span>
                                  <span className="text-[#8ad8ff]">{task.researchStatusLabel}</span>
                                </>
                              )}
                            </div>
                            <h3 className="text-sm font-semibold text-[#f5f3fc]">
                              {task.title || task.userRequest}
                            </h3>
                            {task.title && (
                              <p className="text-xs text-[#a9a2be] line-clamp-2">
                                {task.objective || task.userRequest}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isPendingExecution ? (
                              <button
                                type="button"
                                disabled={wfBusy}
                                onClick={() => void handleRunPlannedTask(task.taskId, true)}
                                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#8b6ff7] px-3.5 py-1.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
                              >
                                <Play className="h-3.5 w-3.5" />
                                <span>
                                  {task.requiresApproval ? 'Approve & Execute' : 'Execute Plan'}
                                </span>
                              </button>
                            ) : task.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Completed</span>
                              </span>
                            ) : task.status === 'failed' ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-xs text-rose-300">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>Failed</span>
                                </span>
                                <button
                                  type="button"
                                  disabled={wfBusy}
                                  onClick={() => void handleRunPlannedTask(task.taskId, true)}
                                  className="min-h-[36px] rounded-lg border border-white/12 bg-[#0e0c16] px-2.5 py-1 text-xs text-[#ece8f6] hover:border-white/25 whitespace-nowrap"
                                >
                                  Retry Safe Step
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                                <Clock className="h-4 w-4" />
                                <span>{stageLabel}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {task.nextSafeStep && (
                          <p className="text-xs text-[#cfc8e2]">
                            <strong className="text-[#f1eef9]">Next safe step:</strong>{' '}
                            {task.nextSafeStep}
                          </p>
                        )}

                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.taskId)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-[#b5add0] hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span>Inspect stages, tools &amp; verification</span>
                        </button>

                        {isExpanded && (
                          <div className="space-y-3 border-t border-white/8 pt-3 text-xs text-[#c3bdd8]">
                            <div>
                              <p className="font-semibold text-[#ece8f6]">Planned Steps</p>
                              <ol className="mt-1 list-decimal space-y-1 pl-4 text-[#a59ec0]">
                                {task.planSteps.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ol>
                            </div>

                            {task.completedStages && task.completedStages.length > 0 && (
                              <p className="font-mono text-[11px] text-[#9e97b0]">
                                Visited stages: {task.completedStages.join(' → ')}
                                {task.failedStage ? ` (halted at ${task.failedStage})` : ''}
                              </p>
                            )}

                            <p className="font-mono text-[11px] text-[#9e97b0]">
                              Permitted tools:{' '}
                              {task.permittedTools.length > 0
                                ? task.permittedTools.join(', ')
                                : 'none'}
                            </p>

                            {task.result && (
                              <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3.5 text-[#ddd8ec]">
                                <MarkdownView content={task.result} />
                              </div>
                            )}

                            {task.sentinelReview && (
                              <div>
                                <p className="font-semibold text-[#ece8f6]">
                                  Sentinel Verification ({task.sentinelReview.status})
                                </p>
                                <p className="mt-0.5 text-[#a59ec0]">
                                  {task.sentinelReview.summary}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {viewMode === 'history' && (
          <div className="space-y-4">
            {/* Search & Status Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#87809b]" />
                <label htmlFor="task-search-input" className="sr-only">
                  Search task runs
                </label>
                <input
                  id="task-search-input"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by request, specialist, or task ID…"
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#13111d] pl-10 pr-4 py-2 text-xs text-[#f5f3fc] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <div className="inline-flex rounded-xl border border-white/10 bg-[#13111d] p-1">
                {(['all', 'completed', 'failed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`min-h-[38px] rounded-lg px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      statusFilter === st
                        ? 'bg-[#251e3d] text-white'
                        : 'text-[#958ea8] hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-[#12101b] p-10 text-center space-y-3">
                <p className="text-sm font-medium text-[#e4dff2]">No task executions recorded yet</p>
                <p className="mx-auto max-w-md text-xs leading-relaxed text-[#918aa6]">
                  Submit a prompt in Chat, draft a plan in Workflow Lifecycle, or load an
                  Evaluation Suite prompt to inspect real orchestrator records.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.taskId;
                  return (
                    <article
                      key={task.taskId}
                      className="rounded-2xl border border-white/8 bg-[#13111d] p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#958ea8] tabular-nums">
                            <span className="font-mono font-semibold text-[#e6e1f6]">
                              {task.taskId}
                            </span>
                            <span>·</span>
                            <span className="text-[#cfc8e2]">{task.agentName}</span>
                            <span>·</span>
                            <span className="font-mono">
                              {task.stepCount}/{task.maxSteps} model calls
                            </span>
                            <span>·</span>
                            <span className="font-mono">{task.durationMs} ms</span>
                          </div>
                          <p className="text-sm font-medium text-[#f5f3fc] line-clamp-2">
                            {task.title ? `${task.title}: ${task.userRequest}` : task.userRequest}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {task.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Completed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-rose-300">
                              <AlertTriangle className="h-4 w-4" />
                              <span>{task.lifecycleStage || 'Failed'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {task.promptInjectionFlagged && (
                        <div className="flex items-center gap-2 text-xs text-amber-300">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                          <span>Prompt-injection guard triggered and isolated input</span>
                        </div>
                      )}

                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.taskId)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-[#b5add0] hover:text-white"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        <span>View structured task record</span>
                      </button>

                      {isExpanded && (
                        <div className="space-y-3 border-t border-white/8 pt-3 text-xs text-[#c3bdd8]">
                          <div>
                            <p className="font-semibold text-[#ece8f6]">Bounded Execution Plan</p>
                            <ol className="mt-1 list-decimal space-y-1 pl-4 text-[#a59ec0]">
                              {task.planSteps.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ol>
                          </div>

                          <div>
                            <p className="font-semibold text-[#ece8f6]">
                              Permitted Tools:{' '}
                              <span className="font-mono font-normal text-[#9e97b0]">
                                {task.permittedTools.length > 0
                                  ? task.permittedTools.join(', ')
                                  : 'none'}
                              </span>
                            </p>
                          </div>

                          {task.toolCalls.length > 0 && (
                            <div>
                              <p className="font-semibold text-[#ece8f6]">Tool Invocations</p>
                              <ul className="mt-1 space-y-1 font-mono text-[11px] tabular-nums text-[#a59ec0]">
                                {task.toolCalls.map((tc, i) => (
                                  <li key={i}>
                                    {tc.tool} → {tc.status} ({tc.durationMs} ms)
                                    {tc.error ? ` — ${tc.error}` : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {task.sentinelReview && (
                            <div>
                              <p className="font-semibold text-[#ece8f6]">
                                Sentinel Verification ({task.sentinelReview.status})
                              </p>
                              <p className="mt-0.5 text-[#a59ec0]">{task.sentinelReview.summary}</p>
                              {task.sentinelReview.flags.map((f, idx) => (
                                <p key={idx} className="mt-1 text-amber-200">
                                  • {f}
                                </p>
                              ))}
                            </div>
                          )}

                          {task.error && (
                            <p className="text-rose-300">
                              Error ({task.error.code}): {task.error.message}
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {viewMode === 'evaluation' && (
          <div className="space-y-6">
            {/* Non-Executing Code Static Reviewer Sandbox */}
            <section className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f5f3fc]">
                <Wrench className="h-4 w-4 text-[#a58ff8]" />
                <h2>Non-Executing Code Static Reviewer (`code_static_reviewer`)</h2>
              </div>
              <p className="text-xs text-[#958ea8]">
                Inspects source snippets for risky execution sinks (`eval`, `innerHTML`, hardcoded
                secret patterns) deterministically on the server without running untrusted code.
              </p>
              <label htmlFor="static-code-input" className="sr-only">
                Code snippet for static security inspection
              </label>
              <textarea
                id="static-code-input"
                rows={4}
                value={sampleCode}
                onChange={(e) => setSampleCode(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3 font-mono text-xs text-[#e6e1f4] focus:border-[#8b6ff7] focus:outline-none"
              />
              <button
                type="button"
                disabled={reviewingCode}
                onClick={() => void handleRunStaticReviewer()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#8b6ff7] px-4 py-2 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50"
              >
                {reviewingCode ? 'Inspecting…' : 'Run Static Security Check'}
              </button>
              {staticReviewOutput && (
                <pre className="max-h-52 overflow-auto rounded-xl border border-white/8 bg-[#0d0b14] p-3 font-mono text-[11px] text-[#cfc8e2]">
                  {staticReviewOutput}
                </pre>
              )}
            </section>

            {/* 12-Prompt Evaluation & Security Suite */}
            <div className="space-y-3">
              {evaluationSuite.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-white/8 bg-[#13111d] p-5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-[#f5f3fc]">{item.title}</h2>
                      <p className="text-xs text-[#958ea8]">
                        Category: {item.category}
                        {item.expectedAgent ? ` · Target specialist: ${item.expectedAgent}` : ''}
                      </p>
                    </div>

                    {item.category !== 'validation' && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreferredAgent('auto');
                          startNewConversation(item.prompt);
                          void navigate('/');
                        }}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/12 bg-[#1b162b] px-3 py-1.5 text-xs font-medium text-[#ece8f6] hover:border-[#8b6ff7]/50 whitespace-nowrap"
                      >
                        <span>Load in Chat</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#a58ff8]" />
                      </button>
                    )}
                  </div>

                  <pre className="whitespace-pre-wrap rounded-xl bg-[#0d0b14] p-3 font-mono text-xs text-[#d6d0e8]">
                    {item.prompt}
                  </pre>
                  <p className="text-xs text-[#a59ec0]">
                    <strong className="text-[#ddd7ee]">Expected Verification:</strong>{' '}
                    {item.expectedBehavior}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      <OfficialFooter />
    </div>
  );
};
