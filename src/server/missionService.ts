import crypto from 'node:crypto';
import type {
  AgentId,
  CitationItem,
  KnowledgeDocument,
  MissionHistoryEvent,
  MissionRun,
  MissionSubtask,
  ProjectWorkspace,
  SavedMemory,
  ToolCallRecord,
  ToolName,
} from '../shared/types.ts';
import {
  AGENT_DEFINITIONS,
  AGENT_SYSTEM_PROMPTS,
  classifyTask,
  extractCsvCandidate,
  extractJsonCandidate,
  extractMathExpression,
} from './agents.ts';
import type { ModelGateway } from './modelGateway.ts';
import { runDeterministicSentinelAudit } from './orchestrator.ts';
import { executeToolWithPermissions, TOOL_REGISTRY } from './tools.ts';
import { assessPromptInjection, detectSecretInText, wrapUntrustedData } from './validation.ts';

export interface CreateMissionPlanInput {
  title: string;
  objective: string;
  projectId?: string;
  preferredAgent?: AgentId;
  requestedTools?: string[];
  requireHumanApproval?: boolean;
  mockMode?: boolean;
  maxSteps?: number;
  maxRetries?: number;
  maxElapsedMs?: number;
  maxModelCalls?: number;
  ownerSessionId?: string;
}

export interface MissionExecutionContext {
  documents: KnowledgeDocument[];
  memories: SavedMemory[];
  project?: ProjectWorkspace;
  mockMode?: boolean;
  signal?: AbortSignal;
}

export type MissionControlAction =
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'cancel' }
  | { action: 'approve_task'; taskId: string }
  | { action: 'retry_task'; taskId: string };

function makeHistoryEvent(
  actor: MissionHistoryEvent['actor'],
  eventType: MissionHistoryEvent['eventType'],
  detail: string,
  taskId?: string
): MissionHistoryEvent {
  return {
    id: `mhist-${crypto.randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    actor,
    eventType,
    taskId,
    detail,
  };
}

function inferToolInputPreview(toolName: ToolName, objective: string): Record<string, unknown> {
  switch (toolName) {
    case 'calculator':
      return { expression: extractMathExpression(objective) ?? '100 * 1.15' };
    case 'datetime_utility':
      return { operation: 'now', timeZone: 'UTC' };
    case 'task_planner':
      return { objective: objective.slice(0, 500), domain: 'general' };
    case 'research_framework':
      return { topic: objective.slice(0, 500) };
    case 'document_processor':
      return { query: objective.slice(0, 400), maxPassages: 3 };
    case 'text_summarizer':
      return { text: objective.slice(0, 1200), maxKeyPoints: 4 };
    case 'json_validator':
      return { jsonText: extractJsonCandidate(objective) ?? '{"mission":"check"}' };
    case 'csv_analyzer':
      return { csvText: extractCsvCandidate(objective) ?? 'metric,value\nbaseline,100\ntarget,125' };
    case 'code_static_reviewer':
      return { code: objective.slice(0, 2000), language: 'ts' };
    case 'web_search_connector':
      return { query: objective.slice(0, 220) };
    case 'workflow_connector_gate':
      return { connectorName: 'external_action_review', dryRunSummary: objective.slice(0, 240) };
    default:
      return { text: objective.slice(0, 400), mode: 'stats' };
  }
}

/**
 * Mission Control Engine (AURENYX VAELOR v0.4 — Module A).
 * Decomposes an objective into a dependency-aware DAG of subtasks with completion criteria,
 * executes ONLY via explicitly registered and permission-checked tools, requires human
 * approval for consequential steps, enforces step/retry/time/model bounds, supports
 * pause/resume/cancel/retry, and clearly separates proposed vs executed actions.
 */
export class MissionControlService {
  private readonly gateway: ModelGateway;

  constructor(gateway: ModelGateway) {
    this.gateway = gateway;
  }

  public createMissionPlan(input: CreateMissionPlanInput): MissionRun {
    const now = new Date().toISOString();
    const cleanTitle = input.title.trim().slice(0, 120);
    const cleanObjective = input.objective.trim().slice(0, 2000);
    const classification = classifyTask(cleanObjective, {
      preferredAgent: input.preferredAgent,
    });
    const leadAgent = AGENT_DEFINITIONS[classification.agentId];

    const maxSteps = Math.max(2, Math.min(8, Math.floor(input.maxSteps ?? 5)));
    const maxRetries = Math.max(0, Math.min(2, Math.floor(input.maxRetries ?? 2)));
    const maxElapsedMs = Math.max(5_000, Math.min(45_000, Math.floor(input.maxElapsedMs ?? 30_000)));
    const maxModelCalls = Math.max(1, Math.min(4, Math.floor(input.maxModelCalls ?? 3)));

    const requestedRaw = input.requestedTools ?? [];
    const validTools: ToolName[] = [];
    const rejectedToolNotes: string[] = [];

    for (const rawTool of requestedRaw) {
      const def = TOOL_REGISTRY[rawTool as ToolName];
      if (!def) {
        rejectedToolNotes.push(`Rejected unregistered tool "${rawTool}".`);
        continue;
      }
      if (!leadAgent.permittedTools.includes(def.name)) {
        // Check if another specialist agent permits it safely; otherwise reject
        const fallbackOwner = Object.values(AGENT_DEFINITIONS).find((a) =>
          a.permittedTools.includes(def.name)
        );
        if (fallbackOwner) {
          validTools.push(def.name);
        } else {
          rejectedToolNotes.push(`Tool "${rawTool}" has no authorized specialist agent.`);
        }
      } else {
        validTools.push(def.name);
      }
    }

    for (const suggested of classification.suggestedTools) {
      if (!validTools.includes(suggested) && validTools.length < maxSteps - 2) {
        validTools.push(suggested);
      }
    }
    if (validTools.length === 0) {
      validTools.push('task_planner');
    }

    const subtasks: MissionSubtask[] = [];

    // Step 1: Scope & Decompose Objective (Registered task_planner tool)
    const plannerTool: ToolName = validTools.includes('research_framework')
      ? 'research_framework'
      : 'task_planner';
    const plannerOwner: AgentId =
      plannerTool === 'research_framework' ? 'aurenyx-research' : 'vaelor-core';

    subtasks.push({
      id: 'step-1',
      title: 'Clarify Scope & Decompose Objective',
      description: `Produce structured execution milestones and risk checks for "${cleanTitle}".`,
      dependencies: [],
      completionCriteria: 'Registered planning tool returns structured milestones with zero schema errors.',
      assignedAgent: plannerOwner,
      toolName: plannerTool,
      toolInputPreview: inferToolInputPreview(plannerTool, cleanObjective),
      actionKind: 'proposed',
      consequential: false,
      requiresApproval: false,
      approvedByUser: true,
      status: 'queued',
      retryCount: 0,
    });

    // Step 2..N-2: Domain Tool Execution Steps
    const executionTools = validTools
      .filter((t) => t !== plannerTool)
      .slice(0, Math.max(1, maxSteps - 3));

    let prevStepId = 'step-1';
    executionTools.forEach((toolName, idx) => {
      const stepId = `step-${idx + 2}`;
      const toolDef = TOOL_REGISTRY[toolName];
      const ownerAgent =
        (leadAgent.permittedTools.includes(toolName)
          ? leadAgent.id
          : Object.values(AGENT_DEFINITIONS).find((a) => a.permittedTools.includes(toolName))
              ?.id) ?? 'vaelor-core';

      const isConsequential =
        Boolean(toolDef?.requiresConfirmation) ||
        toolName === 'workflow_connector_gate' ||
        toolName === 'web_search_connector';

      subtasks.push({
        id: stepId,
        title: `Execute Registered Tool: ${toolName}`,
        description: toolDef?.description ?? `Run ${toolName} under ${ownerAgent} permissions.`,
        dependencies: [prevStepId],
        completionCriteria: `Tool "${toolName}" completes within ${toolDef?.timeoutMs ?? 5000}ms with verified output.`,
        assignedAgent: ownerAgent,
        toolName,
        toolInputPreview: inferToolInputPreview(toolName, cleanObjective),
        actionKind: 'proposed',
        consequential: isConsequential,
        requiresApproval: isConsequential,
        approvedByUser: !isConsequential,
        status: 'queued',
        retryCount: 0,
      });
      prevStepId = stepId;
    });

    // If user requested human approval gate explicitly and no execution tool was added, add explicit approval subtask
    if (executionTools.length === 0 && input.requireHumanApproval) {
      const gateId = `step-${subtasks.length + 1}`;
      subtasks.push({
        id: gateId,
        title: 'Human Consequential Action Review Gate',
        description: 'Await explicit operator approval before synthesizing mission recommendations.',
        dependencies: [prevStepId],
        completionCriteria: 'Human operator explicitly approves mission continuation.',
        assignedAgent: 'vaelor-core',
        toolName: 'workflow_connector_gate',
        toolInputPreview: inferToolInputPreview('workflow_connector_gate', cleanObjective),
        actionKind: 'proposed',
        consequential: true,
        requiresApproval: true,
        approvedByUser: false,
        status: 'queued',
        retryCount: 0,
      });
      prevStepId = gateId;
    }

    // Penultimate Step: Specialist Synthesis
    const synthStepId = `step-${subtasks.length + 1}`;
    subtasks.push({
      id: synthStepId,
      title: `Synthesize Deliverable (${leadAgent.name})`,
      description: 'Consolidate verified tool outputs and project context into a structured deliverable.',
      dependencies: [prevStepId],
      completionCriteria: 'Non-empty synthesis produced within model call budget without secret leaks.',
      assignedAgent: leadAgent.id,
      actionKind: 'proposed',
      consequential: Boolean(input.requireHumanApproval) && subtasks.every((s) => !s.requiresApproval),
      requiresApproval: Boolean(input.requireHumanApproval) && subtasks.every((s) => !s.requiresApproval),
      approvedByUser: !(Boolean(input.requireHumanApproval) && subtasks.every((s) => !s.requiresApproval)),
      status: 'queued',
      retryCount: 0,
    });

    // Final Step: Vaelor Sentinel Verification
    const verifyStepId = `step-${subtasks.length + 1}`;
    subtasks.push({
      id: verifyStepId,
      title: 'Vaelor Sentinel Verification & Audit',
      description: 'Check claims against retrieved tool/document evidence and completion criteria.',
      dependencies: [synthStepId],
      completionCriteria: 'Sentinel classifies verified facts, plausible inferences, and unknowns with zero unresolved security flags.',
      assignedAgent: 'vaelor-sentinel',
      actionKind: 'proposed',
      consequential: false,
      requiresApproval: false,
      approvedByUser: true,
      status: 'queued',
      retryCount: 0,
    });

    const historyLog: MissionHistoryEvent[] = [
      makeHistoryEvent(
        'mission_controller',
        'planned',
        `Created mission plan with ${subtasks.length} bounded subtasks (maxSteps=${maxSteps}, maxRetries=${maxRetries}).`
      ),
    ];

    for (const note of rejectedToolNotes) {
      historyLog.push(makeHistoryEvent('mission_controller', 'task_blocked', note));
    }

    // Promote any root task that requires approval immediately to awaiting_approval
    for (const task of subtasks) {
      if (task.dependencies.length === 0 && task.requiresApproval && !task.approvedByUser) {
        task.status = 'awaiting_approval';
      }
    }

    const hasImmediateGate = subtasks.some((s) => s.status === 'awaiting_approval');
    const routeDecision =
      typeof this.gateway.selectRoute === 'function'
        ? this.gateway.selectRoute({
            capability: 'deep_reasoning',
            requestedTier: 'primary',
            estimatedInputChars: cleanObjective.length,
            mockMode: input.mockMode,
          })
        : undefined;

    return {
      id: `mission-${crypto.randomUUID().slice(0, 8)}`,
      title: cleanTitle,
      objective: cleanObjective,
      projectId: input.projectId,
      status: hasImmediateGate ? 'awaiting_approval' : 'planned',
      subtasks,
      bounds: {
        maxSteps: Math.max(maxSteps, subtasks.length),
        stepsUsed: 0,
        maxRetries,
        retriesUsed: 0,
        maxElapsedMs,
        elapsedMs: 0,
        maxModelCalls,
        modelCallsUsed: 0,
      },
      historyLog,
      citations: [],
      routeDecision,
      mockMode: Boolean(input.mockMode),
      ownerSessionId: input.ownerSessionId,
      createdAt: now,
      updatedAt: now,
    };
  }

  public applyControlAction(mission: MissionRun, ctrl: MissionControlAction): MissionRun {
    const now = new Date().toISOString();
    if (mission.status === 'cancelled' || mission.status === 'completed') {
      if (ctrl.action !== 'retry_task') {
        return mission;
      }
    }

    if (ctrl.action === 'pause') {
      if (
        mission.status === 'running' ||
        mission.status === 'planned' ||
        mission.status === 'awaiting_approval'
      ) {
        mission.status = 'paused';
        mission.historyLog.push(
          makeHistoryEvent('user', 'paused', 'Mission paused by user; queued subtasks held.')
        );
        mission.updatedAt = now;
      }
      return mission;
    }

    if (ctrl.action === 'resume') {
      if (mission.status === 'paused') {
        const waitingOnApproval = mission.subtasks.some((t) => t.status === 'awaiting_approval');
        mission.status = waitingOnApproval ? 'awaiting_approval' : 'planned';
        mission.historyLog.push(
          makeHistoryEvent('user', 'resumed', 'Mission resumed by user.')
        );
        mission.updatedAt = now;
      }
      return mission;
    }

    if (ctrl.action === 'cancel') {
      mission.status = 'cancelled';
      for (const task of mission.subtasks) {
        if (task.status === 'queued' || task.status === 'awaiting_approval' || task.status === 'running') {
          task.status = 'blocked';
          task.error = 'Mission cancelled by user before execution.';
        }
      }
      mission.historyLog.push(
        makeHistoryEvent('user', 'cancelled', 'Mission cancelled; remaining proposed tasks halted.')
      );
      mission.updatedAt = now;
      return mission;
    }

    if (ctrl.action === 'approve_task') {
      const target = mission.subtasks.find((s) => s.id === ctrl.taskId);
      if (target && target.requiresApproval && !target.approvedByUser) {
        target.approvedByUser = true;
        target.approvedAt = now;
        if (target.status === 'awaiting_approval' || target.status === 'blocked') {
          target.status = 'queued';
          target.error = undefined;
        }
        mission.historyLog.push(
          makeHistoryEvent(
            'user',
            'approved',
            `Human approval granted for consequential subtask "${target.title}" (${target.id}).`,
            target.id
          )
        );
        if (mission.status === 'awaiting_approval' || mission.status === 'blocked') {
          mission.status = 'planned';
        }
        mission.updatedAt = now;
      }
      return mission;
    }

    if (ctrl.action === 'retry_task') {
      const target = mission.subtasks.find((s) => s.id === ctrl.taskId);
      if (target && (target.status === 'failed' || target.status === 'blocked')) {
        if (mission.bounds.retriesUsed >= mission.bounds.maxRetries) {
          target.error = `Retry ceiling (${mission.bounds.maxRetries}) reached for this mission.`;
          mission.historyLog.push(
            makeHistoryEvent(
              'mission_controller',
              'task_blocked',
              `Retry denied for ${target.id}: mission retry ceiling (${mission.bounds.maxRetries}) reached.`,
              target.id
            )
          );
          mission.updatedAt = now;
          return mission;
        }
        target.retryCount += 1;
        mission.bounds.retriesUsed += 1;
        target.status = target.requiresApproval && !target.approvedByUser ? 'awaiting_approval' : 'queued';
        target.error = undefined;
        // Also unblock downstream tasks that were blocked solely because of this task
        for (const sub of mission.subtasks) {
          if (sub.dependencies.includes(target.id) && sub.status === 'blocked') {
            sub.status = sub.requiresApproval && !sub.approvedByUser ? 'awaiting_approval' : 'queued';
            sub.error = undefined;
          }
        }
        mission.status = target.status === 'awaiting_approval' ? 'awaiting_approval' : 'planned';
        mission.historyLog.push(
          makeHistoryEvent(
            'user',
            'retried',
            `Scheduled retry #${target.retryCount} for subtask "${target.title}" (${target.id}).`,
            target.id
          )
        );
        mission.updatedAt = now;
      }
      return mission;
    }

    return mission;
  }

  public async executeReadyTasks(
    mission: MissionRun,
    ctx: MissionExecutionContext
  ): Promise<MissionRun> {
    if (mission.status === 'paused' || mission.status === 'cancelled' || mission.status === 'completed') {
      return mission;
    }

    const runStartedAt = Date.now();
    const effectiveMock = Boolean(ctx.mockMode ?? mission.mockMode);
    mission.mockMode = effectiveMock;
    mission.status = 'running';

    const injectionCheck = assessPromptInjection(mission.objective);
    const collectedToolRecords: ToolCallRecord[] = [];

    for (const t of mission.subtasks) {
      if (t.toolCallRecord) {
        collectedToolRecords.push(t.toolCallRecord);
      }
    }

    for (const task of mission.subtasks) {
      if (task.status === 'completed') continue;

      const elapsedNow = mission.bounds.elapsedMs + (Date.now() - runStartedAt);
      if (elapsedNow > mission.bounds.maxElapsedMs) {
        task.status = 'failed';
        task.error = `Mission elapsed time budget (${mission.bounds.maxElapsedMs}ms) exceeded.`;
        mission.status = 'failed';
        mission.historyLog.push(
          makeHistoryEvent('mission_controller', 'task_failed', task.error, task.id)
        );
        break;
      }

      if (mission.bounds.stepsUsed >= mission.bounds.maxSteps) {
        task.status = 'blocked';
        task.error = `Mission step bound (${mission.bounds.maxSteps}) reached.`;
        mission.status = 'blocked';
        mission.historyLog.push(
          makeHistoryEvent('mission_controller', 'task_blocked', task.error, task.id)
        );
        break;
      }

      // Check upstream dependencies
      const depStates = task.dependencies.map((depId) =>
        mission.subtasks.find((candidate) => candidate.id === depId)
      );
      const failedDep = depStates.find(
        (d) => !d || d.status === 'failed' || d.status === 'blocked'
      );
      if (failedDep) {
        task.status = 'blocked';
        task.error = `Blocked by upstream dependency (${failedDep.id}: ${failedDep.status}).`;
        mission.historyLog.push(
          makeHistoryEvent('mission_controller', 'task_blocked', task.error, task.id)
        );
        continue;
      }

      const unfinishedDep = depStates.find((d) => d && d.status !== 'completed');
      if (unfinishedDep) {
        // Cannot run yet (e.g., upstream awaiting approval)
        continue;
      }

      // Enforce human approval gate for consequential actions
      if (task.requiresApproval && !task.approvedByUser) {
        task.status = 'awaiting_approval';
        mission.status = 'awaiting_approval';
        mission.historyLog.push(
          makeHistoryEvent(
            'mission_controller',
            'approval_requested',
            `Paused at consequential subtask "${task.title}" (${task.id}) awaiting human approval.`,
            task.id
          )
        );
        break;
      }

      // Execute subtask
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      mission.bounds.stepsUsed += 1;
      mission.historyLog.push(
        makeHistoryEvent(
          'mission_controller',
          'task_started',
          `Executing "${task.title}" via ${task.assignedAgent}${task.toolName ? ` [${task.toolName}]` : ''}.`,
          task.id
        )
      );

      try {
        if (task.toolName) {
          // Special handling when workflow_connector_gate has been human-approved: record explicit verified gate authorization
          if (task.toolName === 'workflow_connector_gate' && task.approvedByUser) {
            const gateRecord: ToolCallRecord = {
              tool: 'workflow_connector_gate',
              input: task.toolInputPreview ?? { connectorName: 'human_approved_gate' },
              output: JSON.stringify({
                status: 'human_approved_dry_run',
                approvedAt: task.approvedAt ?? new Date().toISOString(),
                note: 'Human operator approved consequential gate; external third-party mutations remain read-only/dry-run until external OAuth connectors are configured.',
              }),
              status: 'completed',
              durationMs: 2,
            };
            task.toolCallRecord = gateRecord;
            collectedToolRecords.push(gateRecord);
            task.actionKind = 'executed';
            task.outputSummary =
              'Human approval recorded; consequential gate verified in safe dry-run mode.';
          } else {
            let attempt = 0;
            let lastRecord: ToolCallRecord | undefined;
            let lastCitations: CitationItem[] = [];

            while (attempt <= mission.bounds.maxRetries) {
              const rawArgs =
                task.toolInputPreview ?? inferToolInputPreview(task.toolName, mission.objective);
              const { record, citations } = await executeToolWithPermissions({
                agentId: task.assignedAgent,
                toolName: task.toolName,
                rawArgs,
                context: {
                  documents: ctx.documents,
                  memories: ctx.memories,
                  gateway: this.gateway,
                  mockMode: effectiveMock,
                  signal: ctx.signal,
                },
              });
              lastRecord = record;
              lastCitations = citations;
              if (record.status === 'completed' || record.status === 'denied') {
                break;
              }
              if (mission.bounds.retriesUsed < mission.bounds.maxRetries) {
                attempt += 1;
                task.retryCount += 1;
                mission.bounds.retriesUsed += 1;
              } else {
                break;
              }
            }

            if (!lastRecord || lastRecord.status !== 'completed') {
              task.toolCallRecord = lastRecord;
              if (lastRecord) collectedToolRecords.push(lastRecord);
              task.status = lastRecord?.status === 'denied' ? 'blocked' : 'failed';
              task.error = lastRecord?.error ?? `Tool "${task.toolName}" did not complete.`;
              mission.historyLog.push(
                makeHistoryEvent(
                  'mission_controller',
                  task.status === 'blocked' ? 'task_blocked' : 'task_failed',
                  task.error,
                  task.id
                )
              );
              continue;
            }

            task.toolCallRecord = lastRecord;
            collectedToolRecords.push(lastRecord);
            if (lastCitations.length > 0) {
              mission.citations.push(...lastCitations);
            }
            task.actionKind = 'executed';
            task.outputSummary = lastRecord.output.slice(0, 360);
          }
        } else if (task.assignedAgent === 'vaelor-sentinel') {
          // Deterministic Sentinel audit over synthesized deliverable & executed tool records
          const synthTask = mission.subtasks.find(
            (s) => s.assignedAgent !== 'vaelor-sentinel' && !s.toolName && s.outputSummary
          );
          const draftToAudit = synthTask?.outputSummary ?? mission.finalSummary ?? mission.objective;
          const webSearchUsed = mission.citations.some((c) => c.sourceType === 'web');
          const audit = runDeterministicSentinelAudit({
            userRequest: mission.objective,
            draftAnswer: draftToAudit,
            toolCalls: collectedToolRecords,
            citations: mission.citations,
            promptInjectionFlagged: injectionCheck.flagged,
            webSearchUsed,
            researchMode: mission.subtasks.some((s) => s.toolName === 'web_search_connector'),
            isMockResponse: effectiveMock,
            completionCriteria: task.completionCriteria,
          });

          mission.sentinelReview = {
            approved: !audit.requiresRevision,
            status: audit.flags.length > 0 ? 'flagged' : 'verified',
            verificationStatus:
              audit.flags.length > 0
                ? 'unverified'
                : mission.citations.length > 0 || collectedToolRecords.length > 0
                  ? 'verified_evidence'
                  : 'partially_verified',
            verificationLabel:
              audit.flags.length > 0
                ? 'Flags detected by Sentinel'
                : 'Verified against mission tool records',
            flags: audit.flags,
            issues: audit.issues,
            unsupportedClaims: audit.unsupportedClaims,
            verifiedFacts: audit.verifiedFacts,
            plausibleInferences: audit.plausibleInferences,
            unknowns: audit.unknowns,
            contradictions: audit.contradictions,
            completionCriteriaMet: audit.completionCriteriaMet,
            incompleteEvidenceWarning: audit.incompleteEvidenceWarning,
            citationChecks: audit.citationChecks,
            requiredCorrections: audit.requiredCorrections,
            verificationLimitations: audit.verificationLimitations,
            summary:
              audit.flags.length > 0
                ? `Sentinel flagged ${audit.flags.length} item(s) requiring review.`
                : `Sentinel verified ${audit.verifiedFacts.length} grounded fact(s) across ${collectedToolRecords.length} executed tool(s).`,
            revised: false,
          };

          task.actionKind = 'executed';
          task.outputSummary = mission.sentinelReview.summary;
          mission.historyLog.push(
            makeHistoryEvent('sentinel', 'verified', mission.sentinelReview.summary, task.id)
          );
        } else {
          // Specialist synthesis subtask (bounded model call)
          if (mission.bounds.modelCallsUsed >= mission.bounds.maxModelCalls) {
            task.status = 'blocked';
            task.error = `Mission model call cap (${mission.bounds.maxModelCalls}) reached.`;
            mission.historyLog.push(
              makeHistoryEvent('mission_controller', 'task_blocked', task.error, task.id)
            );
            continue;
          }

          mission.bounds.modelCallsUsed += 1;
          const toolDigest = collectedToolRecords
            .filter((r) => r.status === 'completed')
            .map((r) => `Tool [${r.tool}]: ${r.output.slice(0, 500)}`)
            .join('\n');
          const memDigest =
            ctx.memories.length > 0
              ? wrapUntrustedData(
                  'project_memories',
                  ctx.memories
                    .slice(0, 4)
                    .map((m) => `- [${m.memoryType ?? m.category}] ${m.label}: ${m.content}`)
                    .join('\n')
                )
              : '';
          const projectLine = ctx.project
            ? `Project Workspace: "${ctx.project.name}" — Objective: ${ctx.project.objective}`
            : 'Project Workspace: Global';

          const promptText = [
            projectLine,
            memDigest,
            toolDigest ? `Verified Executed Tool Outputs:\n${toolDigest}` : 'Executed Tools: None',
            `Mission Objective:\n${
              injectionCheck.flagged
                ? wrapUntrustedData('flagged_mission_objective', mission.objective)
                : mission.objective
            }`,
            'Produce a concise, structured mission deliverable summarizing verified findings, actionable steps, and explicit unknowns. Never invent external URLs or claim unexecuted actions.',
          ]
            .filter(Boolean)
            .join('\n\n');

          const gen = await this.gateway.generateText({
            systemInstruction: AGENT_SYSTEM_PROMPTS[task.assignedAgent],
            turns: [{ role: 'user', text: promptText }],
            tier: 'primary',
            maxOutputChars: 3_600,
            timeoutMs: 18_000,
            mockMode: effectiveMock,
            signal: ctx.signal,
          });

          const safeText = detectSecretInText(gen.text)
            ? 'Deliverable redacted by Vaelor Sentinel: potential credential pattern detected.'
            : gen.text;

          task.actionKind = 'executed';
          task.outputSummary = safeText.slice(0, 2200);
          mission.finalSummary = safeText.slice(0, 2400);
        }

        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        task.error = undefined;
        mission.historyLog.push(
          makeHistoryEvent(
            'mission_controller',
            'task_completed',
            `Completed "${task.title}" (${task.id}).`,
            task.id
          )
        );
      } catch (err) {
        task.status = 'failed';
        task.error = err instanceof Error ? err.message : 'Subtask execution failed.';
        mission.historyLog.push(
          makeHistoryEvent('mission_controller', 'task_failed', task.error, task.id)
        );
      }
    }

    mission.bounds.elapsedMs += Date.now() - runStartedAt;
    mission.updatedAt = new Date().toISOString();

    // Recompute aggregate mission status deterministically
    if (mission.subtasks.some((s) => s.status === 'awaiting_approval')) {
      mission.status = 'awaiting_approval';
    } else if (mission.subtasks.every((s) => s.status === 'completed')) {
      mission.status = 'completed';
    } else if (mission.subtasks.some((s) => s.status === 'failed')) {
      mission.status = 'failed';
    } else if (mission.subtasks.some((s) => s.status === 'blocked')) {
      mission.status = 'blocked';
    } else {
      mission.status = 'planned';
    }

    return mission;
  }
}
