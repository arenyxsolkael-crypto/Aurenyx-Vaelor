import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

export const TasksView: React.FC = () => {
  const { tasks, evaluationSuite, startNewConversation, setPreferredAgent } = useWorkspace();
  const [viewMode, setViewMode] = useState<'history' | 'evaluation'>('history');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed'>('all');
  const [query, setQuery] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const navigate = useNavigate();

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          t.userRequest.toLowerCase().includes(q) ||
          t.agentName.toLowerCase().includes(q) ||
          t.taskId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, statusFilter, query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
          Task Execution Log & Evaluation Suite
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
          Inspect structured orchestrator records—including step budgets, tool permission checks, and
          Vaelor Sentinel reviews—or run the 12 representative evaluation prompts.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="inline-flex rounded-xl border border-white/10 bg-[#13111d] p-1">
        <button
          type="button"
          onClick={() => setViewMode('history')}
          className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
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
          className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
            viewMode === 'evaluation'
              ? 'bg-[#251e3d] text-[#f5f3fc]'
              : 'text-[#9e97b0] hover:text-white'
          }`}
        >
          Evaluation Suite ({evaluationSuite.length})
        </button>
      </div>

      {viewMode === 'history' ? (
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
                  className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-medium capitalize transition-colors ${
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
                Submit a prompt in Chat or select a test case from the Evaluation Suite tab to view
                real orchestrator execution records.
              </p>
              <button
                type="button"
                onClick={() => setViewMode('evaluation')}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#8b6ff7] px-4 py-2 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa]"
              >
                Browse Evaluation Prompts
              </button>
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
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#958ea8]">
                          <span className="font-mono font-semibold text-[#e6e1f6]">
                            {task.taskId}
                          </span>
                          <span>·</span>
                          <span className="text-[#cfc8e2]">{task.agentName}</span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {task.stepCount}/{task.maxSteps} model calls
                          </span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">{task.durationMs} ms</span>
                        </div>
                        <p className="text-sm font-medium text-[#f5f3fc] line-clamp-2">
                          {task.userRequest}
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
                            <span>Failed</span>
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
                            <ul className="mt-1 space-y-1 font-mono text-[11px] text-[#a59ec0]">
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
      ) : (
        /* 12-Prompt Evaluation & Security Suite */
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
      )}
    </div>
  );
};
