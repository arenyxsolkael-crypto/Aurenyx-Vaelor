import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FolderPlus, MessageSquare, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { ProjectWorkspace } from '../shared/types';

export const ProjectsView: React.FC = () => {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject,
    removeProject,
    startNewConversation,
  } = useWorkspace();

  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [category, setCategory] = useState<ProjectWorkspace['category']>('software');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

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
      category,
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error || 'Could not create project.');
      return;
    }
    setName('');
    setObjective('');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[#f6f4fc]">Projects</h1>
        <p className="text-sm text-[#9e97b0]">
          Organize objectives and attach structured context to your chat orchestrations. Stored in
          temporary session memory until an external database is connected.
        </p>
      </div>

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
                placeholder="e.g., Mobile PWA Release 0.2"
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-category" className="block text-xs font-medium text-[#cfc8e2]">
                Primary Domain
              </label>
              <select
                id="project-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProjectWorkspace['category'])}
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0d0b14] px-3.5 py-2 text-sm text-[#f5f3fc] focus:border-[#8b6ff7] focus:outline-none"
              >
                <option value="software">Software Engineering</option>
                <option value="research">Research & Inquiry</option>
                <option value="strategy">Strategy & Operations</option>
                <option value="documentation">Documentation & Knowledge</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="project-objective"
                className="block text-xs font-medium text-[#cfc8e2]"
              >
                Objective & Constraints
              </label>
              <textarea
                id="project-objective"
                rows={3}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                maxLength={600}
                placeholder="Summarize what you are building, target users, and budget/technical constraints…"
                className="w-full rounded-xl border border-white/10 bg-[#0d0b14] p-3.5 text-sm text-[#f5f3fc] placeholder-[#78718d] focus:border-[#8b6ff7] focus:outline-none"
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
            <h2 className="text-sm font-semibold text-[#e4dff2]">
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
            <div className="space-y-3">
              {projects.map((proj) => {
                const isActive = activeProjectId === proj.id;
                return (
                  <article
                    key={proj.id}
                    className={`rounded-2xl border p-5 transition-colors ${
                      isActive
                        ? 'border-[#8b6ff7]/45 bg-[#171327]'
                        : 'border-white/8 bg-[#13111d]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-[#f5f3fc]">{proj.name}</h3>
                        <p className="text-xs text-[#958ea8]">
                          {proj.category} · {proj.status} · Created{' '}
                          {new Date(proj.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
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
                          onClick={() => void removeProject(proj.id)}
                          aria-label={`Delete project ${proj.name}`}
                          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/8 bg-[#0e0c16] text-[#958ea8] hover:border-rose-500/40 hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-[#c9c3dc]">{proj.objective}</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
