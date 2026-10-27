import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Code2,
  Compass,
  Cpu,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { OfficialFooter } from '../components/OfficialFooter';
import type { AgentId } from '../shared/types';

const ROLE_ICON: Record<AgentId, React.ComponentType<{ className?: string }>> = {
  'vaelor-core': Cpu,
  'aurenyx-research': Compass,
  'vaelor-forge': Code2,
  'vaelor-knowledge': BookOpen,
  'vaelor-sentinel': ShieldCheck,
};

export const AgentsView: React.FC = () => {
  const { agents, tools, setPreferredAgent, startNewConversation } = useWorkspace();
  const navigate = useNavigate();

  const launchSpecialist = (id: AgentId, name: string) => {
    setPreferredAgent(id);
    startNewConversation('');
    void navigate('/');
    void name;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-10">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
          Specialist Agents & Tool Allowlists
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
          Vaelor routes requests across four dedicated specialist roles plus Vaelor Core. Each role
          operates under a strict server-side tool allowlist and a maximum ceiling of 4 model calls
          per user request.
        </p>
      </div>

      {/* Specialist Roster Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {agents.map((agent) => {
          const Icon = ROLE_ICON[agent.id] || Cpu;
          return (
            <article
              key={agent.id}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#201934] text-[#bca8fc]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[#f5f3fc]">{agent.name}</h2>
                      <p className="text-xs text-[#9c95b0]">{agent.shortRole}</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[#958ea8] whitespace-nowrap">
                    {agent.totalRuns} runs · {agent.lastStatus}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-[#ccc6df]">{agent.description}</p>

                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-semibold text-[#e4dff2]">Core Responsibilities</p>
                  <ul className="space-y-1 text-xs text-[#a9a2be]">
                    {agent.responsibilities.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-semibold text-[#e4dff2]">Enforced Boundaries</p>
                  <ul className="space-y-1 text-xs text-[#9790ad]">
                    {agent.boundaries.map((b, i) => (
                      <li key={i}>• {b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3.5">
                <p className="font-mono text-[11px] text-[#9e97b0]">
                  Tools:{' '}
                  {agent.permittedTools.length > 0 ? agent.permittedTools.join(' · ') : 'Read-only critic'}
                </p>

                <button
                  type="button"
                  onClick={() => launchSpecialist(agent.id, agent.name)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/12 bg-[#1b162b] px-3 py-1.5 text-xs font-medium text-[#ece8f6] hover:border-[#8b6ff7]/50 hover:bg-[#241d3a] whitespace-nowrap"
                >
                  <span>Route in Chat</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#a58ff8]" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Approved Tool Gateway Registry Table */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-[#a58ff8]" />
          <h2 className="text-base font-semibold text-[#f5f3fc]">
            Permission-Controlled Tool Registry (v0.1)
          </h2>
        </div>
        <p className="text-xs text-[#958ea8]">
          All tool arguments are validated with server-side Zod schemas. Shell execution, arbitrary
          filesystem access, and unrestricted web browsing are strictly prohibited.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#13111d]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/8 text-[#958ea8]">
              <tr>
                <th className="px-4 py-3 font-medium">Tool Name</th>
                <th className="px-4 py-3 font-medium">Stage & Status</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium">Authorized Specialists</th>
                <th className="px-4 py-3 text-right font-medium">Timeout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-[#d5cfe6]">
              {tools.map((tool) => (
                <tr key={tool.name} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono font-medium text-[#e9e4f8] whitespace-nowrap">
                    {tool.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#b5add0] whitespace-nowrap">
                    Stage {tool.stage || 'A'} ·{' '}
                    {tool.availability === 'requires_config'
                      ? tool.requiresConfirmation
                        ? 'Confirm + Config'
                        : 'Requires Config'
                      : 'Active'}
                  </td>
                  <td className="px-4 py-3 text-[#b5add0]">
                    <p>{tool.description}</p>
                    {tool.setupGuide && (
                      <p className="mt-1 text-[11px] text-[#958ea8]">{tool.setupGuide}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#9e97b0]">
                    {tool.allowedAgents.join(' · ')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#9e97b0] whitespace-nowrap">
                    {tool.timeoutMs} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <OfficialFooter />
    </div>
  );
};
