import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FolderPlus,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { OfficialFooter } from '../components/OfficialFooter';
import type { ProjectWorkspace } from '../shared/types';

export const ProjectsView: React.FC = () => {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject,
    updateProject,
    exportProjectJson,
    removeProject,
    startNewConversation,
  } = useWorkspace();

  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [description, setDescription] = useState('');
  const [brief, setBrief] = useState('');
  const [category, setCategory] = useState<ProjectWorkspace['category']>('software');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editObjective, setEditObjective] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBrief, setEditBrief] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectWorkspace['status']>('active');
  const [editError, setEditError] = useState<string | null>(null);

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>('proj_vaelor_01');
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newPlanSteps, setNewPlanSteps] = useState('');
  const [newSummaryTitle, setNewSummaryTitle] = useState('');
  const [newSummaryBody, setNewSummaryBody] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const navigate = useNavigate();

  const showNotice = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 3200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (name.trim().length < 2) {
      setFormError('Enter a project name of at least 2 characters.');
      return;
    }
    if (objective.trim().length < 4) {
      setFormError('Describe the project objective (at least 4 characters).');
      return;
    }

    setSubmitting(true);
    const res = await createProject({
      name: name.trim(),
      objective: objective.trim(),
      description: description.trim() || undefined,
      brief: brief.trim() || undefined,
      category,
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error || 'Could not create project.');
      return;
    }
    setName('');
    setObjective('');
    setDescription('');
    setBrief('');
    showNotice('Project workspace created.');
  };

  const beginEditProject = (proj: ProjectWorkspace) => {
    setEditingProjectId(proj.id);
    setEditName(proj.name);
    setEditObjective(proj.objective);
    setEditDescription(proj.description || '');
    setEditBrief(proj.brief || '');
    setEditStatus(proj.status);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    setEditError(null);
    if (editName.trim().length < 2) {
      setEditError('Project name must be at least 2 characters.');
      return;
    }
    if (editObjective.trim().length < 4) {
      setEditError('Objective must be at least 4 characters.');
      return;
    }
    const res = await updateProject(projectId, {
      name: editName.trim(),
      objective: editObjective.trim(),
      description: editDescription.trim(),
      brief: editBrief.trim(),
      status: editStatus,
    });
    if (!res.ok) {
      setEditError(res.error || 'Failed to update project.');
      return;
    }
    setEditingProjectId(null);
    showNotice('Project brief and details updated.');
  };

  const handleAddPlan = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    const cleanTitle = newPlanTitle.trim();
    const steps = newPlanSteps
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .slice(0, 8);
    if (cleanTitle.length < 2 || steps.length === 0) {
      showNotice('Provide a plan title and at least one step (2+ chars per line).');
      return;
    }
    const res = await updateProject(projectId, {
      addTaskPlan: { title: cleanTitle, steps, status: 'planned' },
    });
    if (res.ok) {
      setNewPlanTitle('');
      setNewPlanSteps('');
      showNotice('Task plan added to project.');
    }
  };

  const handleAddSummary = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    const cleanTitle = newSummaryTitle.trim();
    const cleanBody = newSummaryBody.trim();
    if (cleanTitle.length < 2 || cleanBody.length < 4) {
      showNotice('Provide a summary title (2+ chars) and concise summary text (4+ chars).');
      return;
    }
    const res = await updateProject(projectId, {
      addSummary: {
        title: cleanTitle,
        summary: cleanBody,
        approvedByUser: true,
      },
    });
    if (res.ok) {
      setNewSummaryTitle('');
      setNewSummaryBody('');
      showNotice('Approved summary attached to project.');
    }
  };

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">
            Project Workspaces &amp; Structured Context
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#9e97b0]">
            Organize objectives, reusable project briefs, concise task plans, and user-approved
            conversation summaries—without dumping raw transcripts into every prompt. Stored in
            temporary session memory (exportable anytime as JSON).
          </p>
        </div>

        {statusFeedback && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-2.5 text-xs text-emerald-200">
            {statusFeedback}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Create Project Form */}
          <section className="lg:col-span-5">
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="rounded-2xl border border-white/10 bg-[#13111d] p-5 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f1eef9]">
                <FolderPlus className="h-4 w-4 text-[#a58ff8]" />
                <h2>Create Project Workspace</h2>
              </div>

              {formError && (
                <p role="alert" className="text-xs text-rose-300">
                  {formError}
                </p>
              )}

              <div className="space-y-1.5">
                <label htmlFor="project-name" className="block text-xs font-medium text-[#cfc8e2]">
                  Project Name
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g., Mobile PWA Release 0.3"
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="project-category"
                  className="block text-xs font-medium text-[#cfc8e2]"
                >
                  Primary Domain
                </label>
                <select
                  id="project-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProjectWorkspace['category'])}
                  className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
                >
                  <option value="software">Software Engineering</option>
                  <option value="research">Research &amp; Inquiry</option>
                  <option value="strategy">Strategy &amp; Operations</option>
                  <option value="documentation">Documentation &amp; Knowledge</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="project-objective"
                  className="block text-xs font-medium text-[#cfc8e2]"
                >
                  Objective &amp; Constraints
                </label>
                <textarea
                  id="project-objective"
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  maxLength={600}
                  placeholder="Summarize what you are building, target users, and ₹0/technical constraints…"
                  className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="project-brief" className="block text-xs font-medium text-[#cfc8e2]">
                  Reusable Context Brief (Optional)
                </label>
                <textarea
                  id="project-brief"
                  rows={2}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  maxLength={2400}
                  placeholder="Concise stack, style, or architectural rules injected when this project is active in Chat…"
                  className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3 text-xs text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] w-full rounded-xl bg-[#8b6ff7] px-4 py-2.5 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create project'}
              </button>
            </form>
          </section>

          {/* Project List */}
          <section className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#e4dff2] tabular-nums">
                Active Session Projects ({projects.length})
              </h2>
            </div>

            {projects.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-[#12101b] p-8 text-center space-y-2">
                <p className="text-sm font-medium text-[#e4dff2]">No projects in current session</p>
                <p className="text-xs text-[#918aa6]">
                  Create a project on the left to scope specialist agent instructions to your goal.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((proj) => {
                  const isActive = activeProjectId === proj.id;
                  const isEditing = editingProjectId === proj.id;
                  const isExpanded = expandedProjectId === proj.id;
                  const planCount = proj.taskPlans?.length ?? 0;
                  const summaryCount = proj.summaries?.length ?? 0;

                  return (
                    <article
                      key={proj.id}
                      className={`rounded-2xl border p-5 transition-colors space-y-3.5 ${
                        isActive
                          ? 'border-[#8b6ff7]/45 bg-[#171327]'
                          : 'border-white/8 bg-[#13111d]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <h3 className="text-base font-semibold text-[#f5f3fc]">{proj.name}</h3>
                          <p className="text-xs text-[#958ea8] tabular-nums">
                            {proj.category} · {proj.status} · {planCount}{' '}
                            {planCount === 1 ? 'plan' : 'plans'} · {summaryCount}{' '}
                            {summaryCount === 1 ? 'summary' : 'summaries'} · Created{' '}
                            {new Date(proj.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveProjectId(isActive ? undefined : proj.id)}
                            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                              isActive
                                ? 'border-[#8b6ff7]/50 bg-[#251d3d] text-[#e6dfff]'
                                : 'border-white/10 bg-[#0e0c16] text-[#cfc8e2] hover:border-white/25'
                            }`}
                          >
                            {isActive && <Check className="h-3.5 w-3.5 text-[#a890fa]" />}
                            <span>{isActive ? 'Selected in Chat' : 'Use in Chat'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveProjectId(proj.id);
                              startNewConversation(
                                `Help me plan the next implementation milestone for project "${proj.name}".`
                              );
                              void navigate('/');
                            }}
                            aria-label={`Open chat for ${proj.name}`}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#0e0c16] px-3 py-1.5 text-xs font-medium text-[#cfc8e2] hover:border-white/25 hover:text-white whitespace-nowrap"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-[#a58ff8]" />
                            <span>Open Chat</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => beginEditProject(proj)}
                            aria-label={`Edit project ${proj.name}`}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#0e0c16] px-2.5 py-1.5 text-xs text-[#cfc8e2] hover:border-white/25 hover:text-white whitespace-nowrap"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const res = await exportProjectJson(proj.id);
                              if (res.ok) showNotice(`Exported ${proj.name} JSON bundle.`);
                            }}
                            aria-label={`Export JSON for ${proj.name}`}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#0e0c16] px-2.5 py-1.5 text-xs text-[#cfc8e2] hover:border-white/25 hover:text-white whitespace-nowrap"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Export JSON</span>
                          </button>

                          {confirmDeleteId === proj.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await removeProject(proj.id);
                                  setConfirmDeleteId(null);
                                  showNotice(`Deleted project "${proj.name}".`);
                                }}
                                className="min-h-[40px] rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 whitespace-nowrap"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[40px] rounded-lg border border-white/12 bg-[#0e0c16] px-2.5 py-1.5 text-xs text-[#cfc8e2] whitespace-nowrap"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(proj.id)}
                              aria-label={`Delete project ${proj.name}`}
                              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/8 bg-[#0e0c16] text-[#958ea8] hover:border-rose-500/40 hover:text-rose-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <form
                          onSubmit={(e) => void handleSaveEdit(e, proj.id)}
                          className="space-y-3 border-t border-white/8 pt-3"
                        >
                          {editError && (
                            <p role="alert" className="text-xs text-rose-300">
                              {editError}
                            </p>
                          )}
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs text-[#cfc8e2] mb-1">
                                Project Name
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                maxLength={80}
                                className="min-h-[40px] w-full rounded-lg border border-white/10 bg-[#0d0b14] px-3 py-1.5 text-xs text-[#f5f3fc]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#cfc8e2] mb-1">Status</label>
                              <select
                                value={editStatus}
                                onChange={(e) =>
                                  setEditStatus(e.target.value as ProjectWorkspace['status'])
                                }
                                className="min-h-[40px] w-full rounded-lg border border-white/10 bg-[#0d0b14] px-3 py-1.5 text-xs text-[#f5f3fc]"
                              >
                                <option value="active">active</option>
                                <option value="planning">planning</option>
                                <option value="paused">paused</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-[#cfc8e2] mb-1">Objective</label>
                            <textarea
                              rows={2}
                              value={editObjective}
                              onChange={(e) => setEditObjective(e.target.value)}
                              maxLength={600}
                              className="w-full rounded-lg border border-white/10 bg-[#0d0b14] p-2.5 text-xs text-[#f5f3fc]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#cfc8e2] mb-1">
                              Context Brief (injected into Chat when project is selected)
                            </label>
                            <textarea
                              rows={3}
                              value={editBrief}
                              onChange={(e) => setEditBrief(e.target.value)}
                              maxLength={2400}
                              className="w-full rounded-lg border border-white/10 bg-[#0d0b14] p-2.5 text-xs text-[#f5f3fc]"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              className="min-h-[40px] rounded-lg bg-[#8b6ff7] px-3.5 py-1.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa]"
                            >
                              Save Changes
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProjectId(null)}
                              className="min-h-[40px] rounded-lg border border-white/12 bg-[#0e0c16] px-3.5 py-1.5 text-xs text-[#cfc8e2]"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <p className="text-sm leading-relaxed text-[#c9c3dc]">{proj.objective}</p>
                          {proj.brief && (
                            <p className="text-xs leading-relaxed text-[#9e97b0]">
                              <strong className="font-medium text-[#d8d2ea]">Context brief:</strong>{' '}
                              {proj.brief}
                            </p>
                          )}
                        </>
                      )}

                      {/* Expandable Task Plans & Approved Summaries */}
                      <div className="border-t border-white/8 pt-2.5">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedProjectId(isExpanded ? null : proj.id)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 text-xs font-medium text-[#b5add0] hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span>
                            Plans &amp; Approved Summaries ({planCount}{' '}
                            {planCount === 1 ? 'plan' : 'plans'} · {summaryCount}{' '}
                            {summaryCount === 1 ? 'summary' : 'summaries'})
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-5 text-xs">
                            {/* Task Plans */}
                            <div className="space-y-2.5">
                              <p className="font-semibold text-[#ece8f6]">Concise Task Plans</p>
                              {proj.taskPlans && proj.taskPlans.length > 0 ? (
                                <div className="space-y-2">
                                  {proj.taskPlans.map((tp) => (
                                    <div
                                      key={tp.id}
                                      className="rounded-xl border border-white/8 bg-[#0e0c16] p-3 space-y-1.5"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-medium text-[#f1eef9]">
                                          {tp.title}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <select
                                            aria-label={`Status for plan ${tp.title}`}
                                            value={tp.status}
                                            onChange={(e) =>
                                              void updateProject(proj.id, {
                                                updateTaskPlanStatus: {
                                                  planId: tp.id,
                                                  status: e.target.value as
                                                    | 'planned'
                                                    | 'in_progress'
                                                    | 'completed',
                                                },
                                              })
                                            }
                                            className="min-h-[34px] rounded-md border border-white/10 bg-[#141220] px-2 py-1 text-[11px] text-[#dcd6ec]"
                                          >
                                            <option value="planned">planned</option>
                                            <option value="in_progress">in_progress</option>
                                            <option value="completed">completed</option>
                                          </select>
                                          <button
                                            type="button"
                                            aria-label={`Remove plan ${tp.title}`}
                                            onClick={() =>
                                              void updateProject(proj.id, {
                                                removeTaskPlanId: tp.id,
                                              })
                                            }
                                            className="min-h-[34px] px-2 text-[#958ea8] hover:text-rose-300"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                      <ol className="list-decimal pl-4 space-y-0.5 text-[#a9a2be]">
                                        {tp.steps.map((st, idx) => (
                                          <li key={idx}>{st}</li>
                                        ))}
                                      </ol>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[#958ea8]">No task plans attached yet.</p>
                              )}

                              <form
                                onSubmit={(e) => void handleAddPlan(e, proj.id)}
                                className="space-y-2 pt-1"
                              >
                                <input
                                  type="text"
                                  value={newPlanTitle}
                                  onChange={(e) => setNewPlanTitle(e.target.value)}
                                  maxLength={120}
                                  placeholder="New task plan title (e.g., Phase 1 Security Checks)"
                                  className="min-h-[40px] w-full rounded-lg border border-white/10 bg-[#0d0b14] px-3 py-1.5 text-xs text-[#f5f3fc] placeholder-[#78718d]"
                                />
                                <textarea
                                  rows={2}
                                  value={newPlanSteps}
                                  onChange={(e) => setNewPlanSteps(e.target.value)}
                                  placeholder="Enter steps (one concise step per line)…"
                                  className="w-full rounded-lg border border-white/10 bg-[#0d0b14] p-2.5 text-xs text-[#f5f3fc] placeholder-[#78718d]"
                                />
                                <button
                                  type="submit"
                                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/12 bg-[#1b162b] px-3 py-1.5 text-xs font-medium text-[#ece8f6] hover:border-[#8b6ff7]/50"
                                >
                                  <Plus className="h-3.5 w-3.5 text-[#a58ff8]" />
                                  <span>Add Task Plan</span>
                                </button>
                              </form>
                            </div>

                            {/* Approved Conversation Summaries */}
                            <div className="space-y-2.5 border-t border-white/8 pt-3">
                              <p className="font-semibold text-[#ece8f6]">
                                User-Approved Summaries
                              </p>
                              {proj.summaries && proj.summaries.length > 0 ? (
                                <div className="space-y-2">
                                  {proj.summaries.map((sum) => (
                                    <div
                                      key={sum.id}
                                      className="rounded-xl border border-white/8 bg-[#0e0c16] p-3 space-y-1"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-[#f1eef9]">
                                          {sum.title}
                                        </span>
                                        <button
                                          type="button"
                                          aria-label={`Remove summary ${sum.title}`}
                                          onClick={() =>
                                            void updateProject(proj.id, {
                                              removeSummaryId: sum.id,
                                            })
                                          }
                                          className="min-h-[32px] px-2 text-[#958ea8] hover:text-rose-300"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                      <p className="text-[#a9a2be] leading-relaxed">
                                        {sum.summary}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[#958ea8]">
                                  No summaries saved yet. Click “Save summary to project” on any
                                  assistant reply in Chat or attach a note below.
                                </p>
                              )}

                              <form
                                onSubmit={(e) => void handleAddSummary(e, proj.id)}
                                className="space-y-2 pt-1"
                              >
                                <input
                                  type="text"
                                  value={newSummaryTitle}
                                  onChange={(e) => setNewSummaryTitle(e.target.value)}
                                  maxLength={120}
                                  placeholder="Summary title (e.g., API Rate-Limit Decision)"
                                  className="min-h-[40px] w-full rounded-lg border border-white/10 bg-[#0d0b14] px-3 py-1.5 text-xs text-[#f5f3fc] placeholder-[#78718d]"
                                />
                                <textarea
                                  rows={2}
                                  value={newSummaryBody}
                                  onChange={(e) => setNewSummaryBody(e.target.value)}
                                  maxLength={1600}
                                  placeholder="Concise approved takeaway…"
                                  className="w-full rounded-lg border border-white/10 bg-[#0d0b14] p-2.5 text-xs text-[#f5f3fc] placeholder-[#78718d]"
                                />
                                <button
                                  type="submit"
                                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/12 bg-[#1b162b] px-3 py-1.5 text-xs font-medium text-[#ece8f6] hover:border-[#8b6ff7]/50"
                                >
                                  <Plus className="h-3.5 w-3.5 text-[#a58ff8]" />
                                  <span>Attach Approved Summary</span>
                                </button>
                              </form>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <OfficialFooter />
    </div>
  );
};
