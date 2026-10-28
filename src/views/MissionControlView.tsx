import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { MarkdownView } from '../components/MarkdownView';
import { OfficialFooter } from '../components/OfficialFooter';
import type { AgentId, MissionRun, MissionTaskStatus, ToolName } from '../shared/types';

const SELECTABLE_TOOLS: { name: ToolName; label: string; consequential?: boolean }[] = [
  { name: 'calculator', label: 'Safe Math Calculator' },
  { name: 'datetime_utility', label: 'UTC/ISO Datetime Utility' },
  { name: 'csv_analyzer', label: 'CSV Dataset Analyzer' },
  { name: 'json_validator', label: 'JSON Schema Validator' },
  { name: 'code_static_reviewer', label: 'Static Code Reviewer' },
  { name: 'chart_generator', label: 'SVG Chart Generator' },
  { name: 'web_search_connector', label: 'Grounded Web Search', consequential: true },
  { name: 'workflow_connector_gate', label: 'External Connector Gate', consequential: true },
];

const MISSION_PRESETS: {
  title: string;
  objective: string;
  tools: ToolName[];
  requireApproval: boolean;
}[] = [
  {
    title: 'Quarterly Unit Economics & Safeguard Review',
    objective:
      'Compute (1480 * 12) - 2400 with calculator, review operational safeguards, and synthesize an executive verification checklist with explicit assumptions.',
    tools: ['calculator', 'workflow_connector_gate'],
    requireApproval: true,
  },
  {
    title: 'API Gateway Security & Rate-Limit Readiness',
    objective:
      'Plan a dependency-ordered review of API gateway authentication, sliding-window rate limits, and payload size bounds for an Android-first full-stack web service.',
    tools: ['json_validator', 'code_static_reviewer'],
    requireApproval: true,
  },
];

function renderTaskStatusText(status: MissionTaskStatus): { label: string; colorClass: string } {
  switch (status) {
    case 'completed':
      return { label: 'Completed', colorClass: 'text-emerald-300' };
    case 'awaiting_approval':
      return { label: 'Awaiting Approval', colorClass: 'text-amber-300' };
    case 'running':
      return { label: 'Running', colorClass: 'text-[#c5b3fc]' };
    case 'blocked':
      return { label: 'Blocked by Dependency', colorClass: 'text-[#a59ec0]' };
    case 'failed':
      return { label: 'Failed', colorClass: 'text-rose-300' };
    default:
      return { label: 'Queued', colorClass: 'text-[#d8d2e8]' };
  }
}

export const MissionControlView: React.FC = () => {
  const { user } = useAuth();
  const {
    missions,
    projects,
    activeProjectId,
    mockMode,
    routerStatus,
    planMission,
    executeMission,
    controlMission,
    removeMission,
  } = useWorkspace();

  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [projectId, setProjectId] = useState<string>(() => activeProjectId || '');
  const [preferredAgent, setPreferredAgent] = useState<AgentId>('vaelor-core');
  const [selectedTools, setSelectedTools] = useState<ToolName[]>(['calculator']);
  const [requireHumanApproval, setRequireHumanApproval] = useState(true);
  const [maxSteps, setMaxSteps] = useState(6);
  const [maxModelCalls, setMaxModelCalls] = useState(3);

  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeMission: MissionRun | undefined = useMemo(() => {
    if (selectedMissionId) {
      const found = missions.find((m) => m.id === selectedMissionId);
      if (found) return found;
    }
    return missions[0];
  }, [missions, selectedMissionId]);

  const toggleTool = (tool: ToolName) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handlePlanMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (title.trim().length < 2) {
      setErrorMessage('Provide a mission title of at least 2 characters.');
      return;
    }
    if (objective.trim().length < 6) {
      setErrorMessage('Provide a clear mission objective of at least 6 characters.');
      return;
    }

    setBusy(true);
    const res = await planMission({
      title: title.trim(),
      objective: objective.trim(),
      projectId: projectId || undefined,
      preferredAgent,
      requestedTools: selectedTools,
      requireHumanApproval,
      mockMode,
      maxSteps,
      maxRetries: 2,
      maxElapsedMs: 45_000,
      maxModelCalls,
    });
    setBusy(false);

    if (!res.ok || !res.mission) {
      setErrorMessage(res.error || 'Could not create mission plan.');
      return;
    }

    setSelectedMissionId(res.mission.id);
    setTitle('');
    setObjective('');
  };

  const handleExecuteReady = async (missionId: string) => {
    setErrorMessage(null);
    setBusy(true);
    const res = await executeMission(missionId, { mockMode });
    setBusy(false);
    if (!res.ok) {
      setErrorMessage(res.error || 'Mission execution halted.');
    }
  };

  const handleControl = async (
    missionId: string,
    action: 'pause' | 'resume' | 'cancel' | 'retry_task' | 'approve_task',
    taskId?: string
  ) => {
    setErrorMessage(null);
    setBusy(true);
    const res = await controlMission(missionId, { action, taskId });
    setBusy(false);
    if (!res.ok) {
      setErrorMessage(res.error || 'Could not apply mission control action.');
    }
  };

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        {/* Page Header */}
        <header className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#a59ec0]">
            <span>Aurenyx Vaelor v0.4</span>
            <span aria-hidden="true">·</span>
            <span>Dependency-Aware DAG Orchestration</span>
            <span aria-hidden="true">·</span>
            <span>
              {user?.emailVerified
                ? 'Cloud Firestore + Session Sync'
                : 'Session Memory Fallback (Verify email for Cloud Sync)'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">Mission Control</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
            Decompose multi-step objectives into explicit dependency graphs with completion
            criteria, permission-checked tools, human approval gates for consequential actions, and
            hard bounds on steps, retries, elapsed time, and model calls.
          </p>
        </header>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-xs text-rose-200"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-rose-100 hover:bg-white/10 whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Mission Objective Planner */}
          <section className="lg:col-span-5">
            <form
              onSubmit={(e) => void handlePlanMission(e)}
              className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#f5f3fc]">
                  <Workflow className="h-4 w-4 text-[#a58ff8]" />
                  <h2>Plan Structured Mission</h2>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-[#958ea8]">
                  {mockMode ? 'Mock Mode' : routerStatus?.primaryModel || 'gemini-3.1-flash-lite'}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-[#958ea8]">Quick Mission Templates</p>
                <div className="flex flex-wrap gap-2">
                  {MISSION_PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => {
                        setTitle(preset.title);
                        setObjective(preset.objective);
                        setSelectedTools(preset.tools);
                        setRequireHumanApproval(preset.requireApproval);
                        setErrorMessage(null);
                      }}
                      className="min-h-[38px] rounded-lg border border-white/10 bg-[#0e0c16] px-3 py-1.5 text-xs text-[#dfd9f2] hover:border-[#8b6ff7]/50 whitespace-nowrap"
                    >
                      {preset.title.split(' ').slice(0, 3).join(' ')}…
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mission-title" className="block text-xs font-medium text-[#cfc8e2]">
                  Mission Title
                </label>
                <input
                  id="mission-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  placeholder="e.g., Q4 Unit Economics & Safeguard Audit"
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="mission-objective"
                  className="block text-xs font-medium text-[#cfc8e2]"
                >
                  Objective & Success Scope
                </label>
                <textarea
                  id="mission-objective"
                  rows={4}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  maxLength={3000}
                  placeholder="Describe the objective, metrics to verify, or deliverables required…"
                  className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3.5 text-xs leading-relaxed text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="mission-project"
                    className="block text-xs font-medium text-[#cfc8e2]"
                  >
                    Project Scope
                  </label>
                  <select
                    id="mission-project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 text-xs text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                  >
                    <option value="">Global Workspace (No Project)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="mission-agent"
                    className="block text-xs font-medium text-[#cfc8e2]"
                  >
                    Lead Specialist Profile
                  </label>
                  <select
                    id="mission-agent"
                    value={preferredAgent}
                    onChange={(e) => setPreferredAgent(e.target.value as AgentId)}
                    className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 text-xs text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                  >
                    <option value="vaelor-core">Vaelor Core</option>
                    <option value="aurenyx-research">Vaelor Research</option>
                    <option value="vaelor-forge">Vaelor Forge (Code)</option>
                    <option value="vaelor-analyst">Vaelor Analyst</option>
                    <option value="vaelor-knowledge">Vaelor Knowledge</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="mission-max-steps"
                    className="block text-xs font-medium text-[#cfc8e2]"
                  >
                    Step Ceiling (3–10)
                  </label>
                  <input
                    id="mission-max-steps"
                    type="number"
                    min={3}
                    max={10}
                    value={maxSteps}
                    onChange={(e) =>
                      setMaxSteps(Math.min(10, Math.max(3, Number(e.target.value) || 6)))
                    }
                    className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 font-mono text-xs tabular-nums text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="mission-max-calls"
                    className="block text-xs font-medium text-[#cfc8e2]"
                  >
                    Model Call Limit (1–6)
                  </label>
                  <input
                    id="mission-max-calls"
                    type="number"
                    min={1}
                    max={6}
                    value={maxModelCalls}
                    onChange={(e) =>
                      setMaxModelCalls(Math.min(6, Math.max(1, Number(e.target.value) || 3)))
                    }
                    className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3 py-2 font-mono text-xs tabular-nums text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                  />
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-[#cfc8e2]">
                  Registered &amp; Permission-Checked Tools
                </legend>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {SELECTABLE_TOOLS.map((tool) => {
                    const checked = selectedTools.includes(tool.name);
                    return (
                      <label
                        key={tool.name}
                        className="flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-white/8 bg-[#0e0c16] px-2.5 py-1.5 text-xs text-[#ddd8ec] hover:border-white/20"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTool(tool.name)}
                          className="h-3.5 w-3.5 accent-[#8b6ff7]"
                        />
                        <span className="truncate">
                          {tool.label}
                          {tool.consequential ? ' (Approval)' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-xl border border-white/8 bg-[#0e0c16] px-3 py-2 text-xs text-[#e4dff2]">
                <input
                  type="checkbox"
                  checked={requireHumanApproval}
                  onChange={(e) => setRequireHumanApproval(e.target.checked)}
                  className="h-4 w-4 accent-[#8b6ff7]"
                />
                <span>Require human approval before consequential tool or synthesis steps</span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] w-full rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
              >
                {busy ? 'Generating DAG Plan…' : 'Create Dependency Plan'}
              </button>
            </form>
          </section>

          {/* Right Column: Active Mission Inspector & Execution Controls */}
          <section className="lg:col-span-7 space-y-5">
            {missions.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="select-active-mission" className="text-xs font-medium text-[#cfc8e2]">
                  Saved Missions ({missions.length})
                </label>
                <select
                  id="select-active-mission"
                  value={activeMission?.id || ''}
                  onChange={(e) => setSelectedMissionId(e.target.value)}
                  className="min-h-[40px] max-w-full rounded-xl border border-white/10 bg-[#13111d] px-3 py-1.5 text-xs text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                >
                  {missions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} · {m.status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!activeMission ? (
              <div className="rounded-2xl border border-white/10 bg-[#13111d] p-8 text-center space-y-3">
                <p className="text-sm font-semibold text-[#f5f3fc]">No Mission Planned Yet</p>
                <p className="mx-auto max-w-md text-xs leading-relaxed text-[#958ea8]">
                  Define an objective on the left or load one of the quick templates to generate an
                  inspectable dependency graph with proposed vs. executed tool states.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-5">
                {/* Mission Header & Lifecycle Controls */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-[#f6f4fc]">{activeMission.title}</h2>
                    <p className="text-xs leading-relaxed text-[#a8a1bd]">
                      {activeMission.objective}
                    </p>
                    <p className="font-mono text-[11px] tabular-nums text-[#8f88a3]">
                      ID: {activeMission.id} · Status: {activeMission.status} · Updated{' '}
                      {new Date(activeMission.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeMission.status !== 'completed' &&
                      activeMission.status !== 'cancelled' &&
                      activeMission.status !== 'paused' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleExecuteReady(activeMission.id)}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#8b6ff7] px-3.5 py-2 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] disabled:opacity-50 whitespace-nowrap"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Execute Ready Steps</span>
                        </button>
                      )}

                    {(activeMission.status === 'planned' ||
                      activeMission.status === 'running' ||
                      activeMission.status === 'awaiting_approval') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleControl(activeMission.id, 'pause')}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/12 bg-[#0e0c16] px-3 py-2 text-xs font-medium text-[#e4dff2] hover:border-white/25 disabled:opacity-50 whitespace-nowrap"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause</span>
                      </button>
                    )}

                    {activeMission.status === 'paused' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleControl(activeMission.id, 'resume')}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-[#0b0a10] hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Resume</span>
                      </button>
                    )}

                    {activeMission.status !== 'completed' &&
                      activeMission.status !== 'cancelled' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleControl(activeMission.id, 'cancel')}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-950/30 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-900/40 disabled:opacity-50 whitespace-nowrap"
                        >
                          <Square className="h-3.5 w-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}

                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Delete mission ${activeMission.title}`}
                      onClick={() => void removeMission(activeMission.id)}
                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-white/10 bg-[#0e0c16] text-[#958ea8] hover:border-rose-500/40 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Bounds Telemetry Bar */}
                <div className="grid grid-cols-2 gap-3 border-b border-white/8 pb-4 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-[#8f88a3]">Steps Executed</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#f5f3fc]">
                      {activeMission.bounds.stepsUsed} / {activeMission.bounds.maxSteps}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#8f88a3]">Model Calls</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#f5f3fc]">
                      {activeMission.bounds.modelCallsUsed} / {activeMission.bounds.maxModelCalls}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#8f88a3]">Retries Used</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#f5f3fc]">
                      {activeMission.bounds.retriesUsed} / {activeMission.bounds.maxRetries}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#8f88a3]">Elapsed Runtime</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#f5f3fc]">
                      {activeMission.bounds.elapsedMs} / {activeMission.bounds.maxElapsedMs} ms
                    </p>
                  </div>
                </div>

                {/* Dependency-Aware Subtask DAG Table */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-[#e4dff2]">
                    Dependency Graph &amp; Proposed vs. Executed Actions
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-white/8 bg-[#0e0c16]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-white/8 text-[#958ea8]">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">Node &amp; Deps</th>
                          <th className="px-3 py-2.5 font-medium">Subtask &amp; Criteria</th>
                          <th className="px-3 py-2.5 font-medium">Action State</th>
                          <th className="px-3 py-2.5 font-medium">Status</th>
                          <th className="px-3 py-2.5 font-medium text-right">Controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6 text-[#ddd8ec]">
                        {activeMission.subtasks.map((st) => {
                          const statusMeta = renderTaskStatusText(st.status);
                          const needsApproval = st.requiresApproval && !st.approvedByUser;
                          return (
                            <tr key={st.id} className="align-top hover:bg-white/[0.02]">
                              <td className="px-3 py-3 font-mono text-[11px] tabular-nums whitespace-nowrap">
                                <div className="font-semibold text-[#f5f3fc]">{st.id}</div>
                                <div className="text-[#8f88a3]">
                                  {st.dependencies.length > 0
                                    ? `deps: ${st.dependencies.join(', ')}`
                                    : 'root'}
                                </div>
                              </td>
                              <td className="px-3 py-3 space-y-1">
                                <p className="font-semibold text-[#f5f3fc]">{st.title}</p>
                                <p className="text-[#a8a1bd]">{st.description}</p>
                                <p className="text-[11px] text-[#8f88a3]">
                                  Criteria: {st.completionCriteria}
                                </p>
                                {st.toolName && (
                                  <p className="font-mono text-[11px] text-[#c5b3fc]">
                                    Tool: {st.toolName} · Agent: {st.assignedAgent}
                                  </p>
                                )}
                                {st.outputSummary && (
                                  <pre className="mt-1.5 max-h-28 overflow-auto rounded-lg bg-[#09080f] p-2 font-mono text-[11px] text-[#cfc8e2] whitespace-pre-wrap">
                                    {st.outputSummary}
                                  </pre>
                                )}
                                {st.error && (
                                  <p className="text-[11px] text-rose-300">Error: {st.error}</p>
                                )}
                              </td>
                              <td className="px-3 py-3 font-mono text-[11px] whitespace-nowrap">
                                {st.actionKind === 'executed' ? (
                                  <span className="text-emerald-300">Executed</span>
                                ) : (
                                  <span className="text-amber-200">Proposed Only</span>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className={`font-medium ${statusMeta.colorClass}`}>
                                  {statusMeta.label}
                                </span>
                                {st.retryCount > 0 && (
                                  <div className="font-mono text-[11px] tabular-nums text-[#8f88a3]">
                                    Retries: {st.retryCount}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  {needsApproval &&
                                    activeMission.status !== 'cancelled' &&
                                    activeMission.status !== 'completed' && (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          void handleControl(
                                            activeMission.id,
                                            'approve_task',
                                            st.id
                                          )
                                        }
                                        className="min-h-[36px] rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-semibold text-[#0b0a10] hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap"
                                      >
                                        Approve
                                      </button>
                                    )}
                                  {st.status === 'failed' &&
                                    activeMission.status !== 'cancelled' && (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          void handleControl(activeMission.id, 'retry_task', st.id)
                                        }
                                        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/15 bg-[#13111d] px-2.5 py-1 text-xs text-[#f5f3fc] hover:border-white/30 disabled:opacity-50 whitespace-nowrap"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                        <span>Retry</span>
                                      </button>
                                    )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final Summary & Sentinel Epistemic Verification */}
                {activeMission.finalSummary && (
                  <div className="space-y-2 border-t border-white/8 pt-4">
                    <h3 className="text-xs font-semibold text-[#e4dff2]">Mission Outcome Summary</h3>
                    <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-4">
                      <MarkdownView content={activeMission.finalSummary} />
                    </div>
                  </div>
                )}

                {activeMission.sentinelReview && (
                  <div className="space-y-2 border-t border-white/8 pt-4 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#f5f3fc]">
                        {activeMission.sentinelReview.approved ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-300" />
                        )}
                        <span>
                          Vaelor Sentinel Verification (
                          {activeMission.sentinelReview.verificationLabel ||
                            activeMission.sentinelReview.status}
                          )
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-[#958ea8]">
                        Criteria Met:{' '}
                        {activeMission.sentinelReview.completionCriteriaMet ? 'Yes' : 'Incomplete'}
                      </span>
                    </div>
                    <p className="text-[#b5add0]">{activeMission.sentinelReview.summary}</p>
                    {activeMission.sentinelReview.incompleteEvidenceWarning && (
                      <p className="text-amber-200">
                        Warning: {activeMission.sentinelReview.incompleteEvidenceWarning}
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3 space-y-1">
                        <p className="font-semibold text-emerald-300">Verified Facts</p>
                        <ul className="space-y-1 text-[11px] text-[#cfc8e2]">
                          {(activeMission.sentinelReview.verifiedFacts?.length
                            ? activeMission.sentinelReview.verifiedFacts
                            : ['None recorded yet']
                          ).map((item, idx) => (
                            <li key={idx}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3 space-y-1">
                        <p className="font-semibold text-[#c5b3fc]">Plausible Inferences</p>
                        <ul className="space-y-1 text-[11px] text-[#cfc8e2]">
                          {(activeMission.sentinelReview.plausibleInferences?.length
                            ? activeMission.sentinelReview.plausibleInferences
                            : ['None recorded yet']
                          ).map((item, idx) => (
                            <li key={idx}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-[#0e0c16] p-3 space-y-1">
                        <p className="font-semibold text-amber-300">Open Unknowns</p>
                        <ul className="space-y-1 text-[11px] text-[#cfc8e2]">
                          {(activeMission.sentinelReview.unknowns?.length
                            ? activeMission.sentinelReview.unknowns
                            : ['No unverified external claims']
                          ).map((item, idx) => (
                            <li key={idx}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mission History Audit Log */}
                <div className="space-y-2 border-t border-white/8 pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e4dff2]">
                    <Clock className="h-3.5 w-3.5 text-[#a58ff8]" />
                    <h3>Mission Audit History ({activeMission.historyLog.length})</h3>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-white/8 bg-[#0e0c16] divide-y divide-white/6 text-xs">
                    {activeMission.historyLog.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2"
                      >
                        <div className="space-y-0.5">
                          <span className="font-mono text-[11px] text-[#c5b3fc]">
                            {ev.eventType}
                          </span>
                          <span className="mx-1.5 text-[#78718d]">·</span>
                          <span className="text-[#ddd8ec]">{ev.detail}</span>
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-[#8f88a3]">
                          {ev.actor} ·{' '}
                          {new Date(ev.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <OfficialFooter />
    </div>
  );
};
