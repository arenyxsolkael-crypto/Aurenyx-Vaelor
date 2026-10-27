import React from 'react';
import {
  BarChart3,
  BookOpen,
  Code2,
  Compass,
  Cpu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { AgentId } from '../shared/types';

interface AgentActivityPanelProps {
  onCloseMobile?: () => void;
}

const AGENT_ICONS: Record<AgentId, React.ComponentType<{ className?: string }>> = {
  'vaelor-core': Cpu,
  'aurenyx-research': Compass,
  'vaelor-forge': Code2,
  'vaelor-analyst': BarChart3,
  'vaelor-knowledge': BookOpen,
  'vaelor-sentinel': ShieldCheck,
};

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({ onCloseMobile }) => {
  const { agents, activeStage, isSending, tasks, preferredAgent, setPreferredAgent } =
    useWorkspace();

  const latestTask = tasks[0];

  return (
    <aside
      aria-label="Agent orchestration activity"
      className="flex h-full w-full flex-col bg-[#0e0c16] text-left"
    >
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-[#f1eef9]">Orchestrator Activity</h2>
          <p className="text-xs text-[#8f88a3]">Bounded 4-call execution ceiling</p>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close agent activity panel"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#9e97b0] hover:bg-white/6 hover:text-white xl:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Live Execution Stage */}
        <section className="rounded-xl border border-white/8 bg-[#14121f] p-3.5">
          <div className="flex items-center justify-between text-xs text-[#9e97b0]">
            <span>Pipeline State</span>
            <span className="font-mono tabular-nums text-[#cfc8e2]">
              {isSending ? 'Running' : 'Standby'}
            </span>
          </div>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-[#f1eef9]">{activeStage}</p>
        </section>

        {/* Specialist Roster */}
        <section>
          <div className="mb-2.5 flex items-center justify-between text-xs text-[#9e97b0]">
            <span>Specialist Routing</span>
            <button
              type="button"
              onClick={() => setPreferredAgent('auto')}
              className={`text-xs transition-colors ${
                preferredAgent === 'auto'
                  ? 'font-semibold text-[#b49ffa]'
                  : 'text-[#8f88a3] hover:text-white'
              }`}
            >
              Auto Route
            </button>
          </div>

          <div className="space-y-1.5">
            {agents.map((agent) => {
              const Icon = AGENT_ICONS[agent.id] || Cpu;
              const isSelected = preferredAgent === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setPreferredAgent(isSelected ? 'auto' : agent.id)}
                  className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'border-[#8b6ff7]/50 bg-[#1c1630]'
                      : 'border-white/6 bg-[#13111c] hover:border-white/15 hover:bg-[#181524]'
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#201a33] text-[#bca8fc]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-[#f1eef9]">
                        {agent.name}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-[#8f88a3]">
                        {agent.totalRuns} {agent.totalRuns === 1 ? 'run' : 'runs'}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-[#958ea8]">{agent.shortRole}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Latest Structured Task Trace */}
        <section className="border-t border-white/8 pt-4">
          <h3 className="text-xs font-semibold text-[#d8d2e8]">Latest Task Verification</h3>
          {latestTask ? (
            <div className="mt-2.5 space-y-2 text-xs text-[#9e97b0]">
              <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                <span className="text-[#c6bfe0]">{latestTask.taskId}</span>
                <span>
                  {latestTask.stepCount}/{latestTask.maxSteps} calls · {latestTask.durationMs} ms
                </span>
              </div>
              <p className="text-[#e5e0f2]">
                {latestTask.agentName} · {latestTask.status}
              </p>
              {latestTask.sentinelReview && (
                <p className="text-[11px] leading-relaxed text-[#a9a2bc]">
                  {latestTask.sentinelReview.verificationLabel
                    ? `${latestTask.sentinelReview.verificationLabel}: `
                    : 'Sentinel: '}
                  {latestTask.sentinelReview.summary}
                </p>
              )}
              {latestTask.toolCalls.length > 0 && (
                <p className="text-[11px] text-[#9e97b0]">
                  Tools:{' '}
                  {latestTask.toolCalls
                    .map((t) => `${t.tool} (${t.status})`)
                    .join(' · ')}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-[#87809b]">
              Submit a prompt in Chat to inspect real-time task classification, approved tool calls,
              and Sentinel verification output.
            </p>
          )}
        </section>
      </div>
    </aside>
  );
};
