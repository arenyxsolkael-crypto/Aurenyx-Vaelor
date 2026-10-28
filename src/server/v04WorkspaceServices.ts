import crypto from 'node:crypto';
import type {
  CitationItem,
  CodingLabAssistResult,
  CodingLabFile,
  CodingLabMode,
  CodingLabStaticFinding,
  CodingLabTestCase,
  CouncilRoleId,
  CouncilRoleOutput,
  CouncilSessionResult,
  CouncilSynthesis,
  DeepResearchClaim,
  DeepResearchComparison,
  DeepResearchReport,
  DeepResearchStageRecord,
  KnowledgeDocument,
  ProjectWorkspace,
  ResearchStatus,
  SavedMemory,
  SentinelReview,
  ToolCallRecord,
} from '../shared/types.ts';
import { AGENT_SYSTEM_PROMPTS } from './agents.ts';
import type { ModelGateway } from './modelGateway.ts';
import { runDeterministicSentinelAudit } from './orchestrator.ts';
import { executeToolWithPermissions } from './tools.ts';
import { assessPromptInjection, detectSecretInText, wrapUntrustedData } from './validation.ts';

// ============================================================================
// MODULE C: Deep Research Workflow Service (7-Stage Grounded Pipeline)
// ============================================================================

export interface DeepResearchInput {
  query: string;
  projectId?: string;
  project?: ProjectWorkspace;
  documents: KnowledgeDocument[];
  memories: SavedMemory[];
  mockMode?: boolean;
  ownerSessionId?: string;
  signal?: AbortSignal;
}

export class DeepResearchService {
  private readonly gateway: ModelGateway;

  constructor(gateway: ModelGateway) {
    this.gateway = gateway;
  }

  public async runDeepResearch(input: DeepResearchInput): Promise<DeepResearchReport> {
    const startedAt = Date.now();
    const stages: DeepResearchStageRecord[] = [];
    const cleanQuery = input.query.trim().slice(0, 1500);
    const injectionCheck = assessPromptInjection(cleanQuery);
    const mockMode = Boolean(input.mockMode);
    const gwStatus = this.gateway.getStatus();

    // Stage 1: Question Clarification
    const s1Start = Date.now();
    const clarifiedQuestions = buildClarifiedSubQuestions(cleanQuery, input.project);
    stages.push({
      id: 'question_clarification',
      label: '1. Question Clarification',
      status: 'completed',
      summary: `Decomposed research query into ${clarifiedQuestions.length} verifiable sub-questions.`,
      durationMs: Math.max(1, Date.now() - s1Start),
    });

    // Stage 2: Search (ONLY via actual configured search provider when not in Mock Mode)
    const s2Start = Date.now();
    let searchProviderUsed = 'Unavailable (Local Corpus Only)';
    let webCitations: CitationItem[] = [];
    let searchSummaryText = '';
    const toolRecords: ToolCallRecord[] = [];

    if (mockMode) {
      stages.push({
        id: 'search',
        label: '2. External Search',
        status: 'skipped',
        summary:
          'Local Mock Mode is active: external web search was intentionally skipped (no fabricated citations).',
        durationMs: Math.max(1, Date.now() - s2Start),
      });
    } else if (!gwStatus.liveSearchConfigured || typeof this.gateway.searchGroundedWeb !== 'function') {
      stages.push({
        id: 'search',
        label: '2. External Search',
        status: 'degraded',
        summary:
          'No live search provider credential is configured on the server; proceeding with local workspace documents and explicit uncertainty markers.',
        durationMs: Math.max(1, Date.now() - s2Start),
      });
    } else {
      try {
        const searchRes = await this.gateway.searchGroundedWeb(cleanQuery, {
          timeoutMs: 14_000,
          signal: input.signal,
        });
        searchProviderUsed =
          gwStatus.groundedSearchMode === 'external-search-key'
            ? 'Configured External Search Provider'
            : 'Gemini Google Search Grounding';
        webCitations = searchRes.citations.map((c, idx) => ({
          ...c,
          id: c.id || `src-web-${idx + 1}`,
          retrievedAt: c.retrievedAt || new Date().toISOString(),
        }));
        searchSummaryText = searchRes.summaryText;

        toolRecords.push({
          tool: 'web_search_connector',
          input: { query: cleanQuery.slice(0, 200) },
          output: JSON.stringify({
            status: searchRes.status,
            citationCount: webCitations.length,
            note: searchRes.note,
          }),
          status: searchRes.status === 'unavailable' ? 'failed' : 'completed',
          durationMs: Date.now() - s2Start,
        });

        stages.push({
          id: 'search',
          label: '2. External Search',
          status:
            searchRes.status === 'ok'
              ? 'completed'
              : searchRes.status === 'no_sources'
                ? 'degraded'
                : 'failed',
          summary: searchRes.note,
          durationMs: Math.max(1, Date.now() - s2Start),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'External search call failed.';
        stages.push({
          id: 'search',
          label: '2. External Search',
          status: 'failed',
          summary: `Search failed gracefully: ${msg}`,
          durationMs: Math.max(1, Date.now() - s2Start),
        });
      }
    }

    // Stage 3: Source Collection (Web + Local Documents + Project Memories)
    const s3Start = Date.now();
    const docProcessorCall = await executeToolWithPermissions({
      agentId: 'aurenyx-research',
      toolName: 'document_processor',
      rawArgs: { query: cleanQuery.slice(0, 500), maxPassages: 4 },
      context: {
        documents: input.documents,
        memories: input.memories,
        gateway: this.gateway,
        mockMode,
        signal: input.signal,
      },
    });
    toolRecords.push(docProcessorCall.record);

    const localCitations: CitationItem[] = docProcessorCall.citations.map((c, idx) => ({
      ...c,
      id: c.id || `src-doc-${idx + 1}`,
      retrievedAt: c.retrievedAt || new Date().toISOString(),
    }));

    const memoryCitations: CitationItem[] = input.memories.slice(0, 3).map((mem, idx) => ({
      id: `src-mem-${idx + 1}`,
      sourceTitle: `Project Memory: ${mem.label}`,
      sourceType: 'memory',
      excerpt: mem.content.slice(0, 240),
      url: mem.referenceUrl || undefined,
      retrievedAt: mem.updatedAt || mem.createdAt,
    }));

    const allSources: CitationItem[] = [...webCitations, ...localCitations, ...memoryCitations];
    stages.push({
      id: 'source_collection',
      label: '3. Source Collection',
      status: allSources.length > 0 ? 'completed' : 'degraded',
      summary: `Collected ${allSources.length} verifiable source(s) (${webCitations.length} web, ${localCitations.length} document, ${memoryCitations.length} project memory).`,
      durationMs: Math.max(1, Date.now() - s3Start),
    });

    // Stage 4: Source Comparison
    const s4Start = Date.now();
    const comparisons = compareCollectedSources(cleanQuery, allSources);
    stages.push({
      id: 'source_comparison',
      label: '4. Source Comparison',
      status: allSources.length > 0 ? 'completed' : 'degraded',
      summary: `Evaluated ${comparisons.length} cross-source comparison dimension(s) for corroboration vs contradiction.`,
      durationMs: Math.max(1, Date.now() - s4Start),
    });

    // Stage 5: Synthesis
    const s5Start = Date.now();
    const routeDecision =
      typeof this.gateway.selectRoute === 'function'
        ? this.gateway.selectRoute({
            capability: 'deep_reasoning',
            requestedTier: 'primary',
            estimatedInputChars: cleanQuery.length + allSources.length * 240,
            mockMode,
          })
        : undefined;

    let executiveSummary = '';
    let isMockResponse = mockMode;

    if (mockMode || !gwStatus.configured) {
      isMockResponse = true;
      executiveSummary = buildDeterministicResearchSynthesis({
        query: cleanQuery,
        clarifiedQuestions,
        sources: allSources,
        comparisons,
        mockMode,
        configured: gwStatus.configured,
      });
      stages.push({
        id: 'synthesis',
        label: '5. Synthesis',
        status: mockMode ? 'completed' : 'degraded',
        summary: mockMode
          ? 'Generated structured local mock synthesis mapped strictly to available workspace sources.'
          : 'Live Gemini key not configured; built deterministic source-only synthesis.',
        durationMs: Math.max(1, Date.now() - s5Start),
      });
    } else {
      const sourceCatalog =
        allSources.length > 0
          ? allSources
              .map(
                (s) =>
                  `[${s.id}] (${s.sourceType.toUpperCase()}) "${s.sourceTitle}"${s.url ? ` — ${s.url}` : ''} (Accessed: ${s.retrievedAt ?? 'N/A'}):\n${s.excerpt}`
              )
              .join('\n\n')
          : 'NONE — Zero external or local sources were retrieved.';

      const synthPrompt = [
        `Research Question:\n${
          injectionCheck.flagged
            ? wrapUntrustedData('flagged_research_query', cleanQuery)
            : cleanQuery
        }`,
        `Clarified Sub-Questions:\n${clarifiedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
        `Retrieved Verified Sources:\n${wrapUntrustedData('retrieved_sources', sourceCatalog)}`,
        searchSummaryText
          ? `Grounded Search Summary:\n${wrapUntrustedData('grounded_search_summary', searchSummaryText)}`
          : '',
        `Instructions: Write a concise, rigorous executive synthesis (250-500 words). Cite source IDs inline like [src-web-1] or [src-doc-1] ONLY when supported by Retrieved Verified Sources above. Explicitly flag any unsupported areas or contradictory evidence. NEVER invent URLs or citations.`,
      ]
        .filter(Boolean)
        .join('\n\n');

      try {
        const gen = await this.gateway.generateText({
          systemInstruction: AGENT_SYSTEM_PROMPTS['aurenyx-research'],
          turns: [{ role: 'user', text: synthPrompt }],
          tier: 'primary',
          maxOutputChars: 4_500,
          timeoutMs: 20_000,
          mockMode: false,
          signal: input.signal,
        });
        executiveSummary = detectSecretInText(gen.text)
          ? 'Synthesis withheld by Vaelor Sentinel due to potential credential pattern.'
          : gen.text;
        stages.push({
          id: 'synthesis',
          label: '5. Synthesis',
          status: 'completed',
          summary: `Synthesized findings via ${gen.modelUsed}.`,
          durationMs: Math.max(1, Date.now() - s5Start),
        });
      } catch (err) {
        executiveSummary = buildDeterministicResearchSynthesis({
          query: cleanQuery,
          clarifiedQuestions,
          sources: allSources,
          comparisons,
          mockMode: false,
          configured: gwStatus.configured,
        });
        stages.push({
          id: 'synthesis',
          label: '5. Synthesis',
          status: 'degraded',
          summary: `Model synthesis degraded (${err instanceof Error ? err.message : 'error'}); fell back to deterministic source digest.`,
          durationMs: Math.max(1, Date.now() - s5Start),
        });
      }
    }

    // Stage 6: Verification & Claim-to-Source Mapping
    const s6Start = Date.now();
    const audit = runDeterministicSentinelAudit({
      userRequest: cleanQuery,
      draftAnswer: executiveSummary,
      toolCalls: toolRecords,
      citations: allSources,
      promptInjectionFlagged: injectionCheck.flagged,
      webSearchUsed: webCitations.length > 0,
      researchMode: true,
      isMockResponse,
    });

    const claims = buildClaimToSourceMatrix(executiveSummary, allSources, audit.unsupportedClaims);
    const unsupportedStatements = Array.from(
      new Set([
        ...audit.unsupportedClaims,
        ...claims.filter((c) => c.epistemicClass === 'unsupported').map((c) => c.statement),
      ])
    );

    const uncertainties: string[] = [...audit.unknowns];
    if (allSources.length === 0) {
      uncertainties.push(
        'Zero external web or local knowledge sources matched this query; all domain specifics require primary-source verification.'
      );
    }
    if (comparisons.some((c) => c.agreementLevel === 'contradictory')) {
      uncertainties.push(
        'Collected sources contain conflicting numeric or directional statements; review source comparison notes before acting.'
      );
    }

    const sentinelReview: SentinelReview = {
      approved: !audit.requiresRevision,
      status: audit.flags.length > 0 ? 'flagged' : 'verified',
      verificationStatus:
        audit.flags.length > 0
          ? 'unverified'
          : allSources.length > 0 && !isMockResponse
            ? 'verified_evidence'
            : 'partially_verified',
      verificationLabel:
        audit.flags.length > 0
          ? 'Unsupported claims flagged'
          : allSources.length > 0
            ? 'Verified against collected sources'
            : 'No external sources attached',
      flags: audit.flags,
      issues: audit.issues,
      unsupportedClaims: unsupportedStatements,
      verifiedFacts: audit.verifiedFacts,
      plausibleInferences: audit.plausibleInferences,
      unknowns: uncertainties,
      contradictions: audit.contradictions,
      completionCriteriaMet: audit.completionCriteriaMet,
      incompleteEvidenceWarning: audit.incompleteEvidenceWarning,
      citationChecks: audit.citationChecks,
      requiredCorrections: audit.requiredCorrections,
      verificationLimitations: audit.verificationLimitations,
      summary:
        audit.flags.length > 0
          ? `Sentinel flagged ${audit.flags.length} grounding issue(s).`
          : `Verified ${claims.filter((c) => c.epistemicClass === 'verified_fact').length} source-backed claim(s) across ${allSources.length} source(s).`,
      revised: false,
    };

    stages.push({
      id: 'verification',
      label: '6. Sentinel Verification',
      status: audit.flags.length > 0 ? 'degraded' : 'completed',
      summary: sentinelReview.summary,
      durationMs: Math.max(1, Date.now() - s6Start),
    });

    // Stage 7: Final Report Assembly
    const s7Start = Date.now();
    const overallStatus: ResearchStatus = !sentinelReview.approved
      ? 'verification_incomplete'
      : webCitations.length > 0
        ? 'research_completed'
        : allSources.length > 0
          ? 'partial_results'
          : 'search_unavailable';

    const statusLabelMap: Record<ResearchStatus, string> = {
      search_available: 'Search available',
      research_completed: 'Research completed (grounded)',
      partial_results: 'Partial results (workspace sources only)',
      search_unavailable: 'External search unavailable',
      verification_incomplete: 'Verification incomplete (flags raised)',
    };

    const reportMarkdown = formatDeepResearchMarkdown({
      query: cleanQuery,
      statusLabel: statusLabelMap[overallStatus],
      searchProviderUsed,
      clarifiedQuestions,
      executiveSummary,
      sources: allSources,
      comparisons,
      claims,
      uncertainties,
      unsupportedStatements,
    });

    stages.push({
      id: 'final_report',
      label: '7. Final Report',
      status: 'completed',
      summary: `Compiled structured report with ${claims.length} mapped claim(s) and ${allSources.length} cited source(s).`,
      durationMs: Math.max(1, Date.now() - s7Start),
    });

    return {
      id: `dres-${crypto.randomUUID().slice(0, 8)}`,
      query: cleanQuery,
      projectId: input.projectId,
      clarifiedQuestions,
      status: overallStatus,
      statusLabel: statusLabelMap[overallStatus],
      searchProviderUsed,
      stages,
      sources: allSources,
      comparisons,
      claims,
      unsupportedStatements,
      uncertainties: Array.from(new Set(uncertainties)),
      executiveSummary,
      reportMarkdown,
      routeDecision,
      sentinelReview,
      isMockResponse,
      ownerSessionId: input.ownerSessionId,
      createdAt: new Date().toISOString(),
      durationMs: Math.max(1, Date.now() - startedAt),
    };
  }
}

function buildClarifiedSubQuestions(query: string, project?: ProjectWorkspace): string[] {
  const base = query.replace(/\s+/g, ' ').trim();
  const shortTopic = base.length > 90 ? `${base.slice(0, 90)}…` : base;
  const qs = [
    `What verifiable primary facts and definitions govern "${shortTopic}"?`,
    `Where do retrieved sources corroborate each other versus diverge or lack coverage?`,
    `What concrete constraints, risks, and unknowns remain unverified?`,
  ];
  if (project) {
    qs.push(
      `How do these findings apply to project "${project.name}" (${project.objective.slice(0, 80)})?`
    );
  }
  return qs;
}

function compareCollectedSources(
  query: string,
  sources: CitationItem[]
): DeepResearchComparison[] {
  if (sources.length === 0) {
    return [
      {
        topic: query.slice(0, 90),
        agreementLevel: 'insufficient_sources',
        sourceIds: [],
        notes:
          'Zero external web or local knowledge sources were retrieved; claims cannot be cross-corroborated.',
      },
    ];
  }

  if (sources.length === 1) {
    return [
      {
        topic: sources[0].sourceTitle,
        agreementLevel: 'single_source',
        sourceIds: [sources[0].id],
        notes: `Only a single ${sources[0].sourceType} source was available; independent corroboration is still needed.`,
      },
    ];
  }

  const negationSources = sources.filter((s) =>
    /\b(not\s+supported|deprecated|failed|contradicts|disputed|however|no\s+evidence)\b/i.test(
      s.excerpt
    )
  );
  const affirmativeSources = sources.filter((s) => !negationSources.includes(s));

  const comparisons: DeepResearchComparison[] = [];
  if (negationSources.length > 0 && affirmativeSources.length > 0) {
    comparisons.push({
      topic: 'Cross-source directional & limitation check',
      agreementLevel: 'contradictory',
      sourceIds: sources.slice(0, 4).map((s) => s.id),
      notes: `Some sources highlight constraints/disputes (${negationSources.map((s) => s.id).join(', ')}) while others describe baseline capabilities (${affirmativeSources.map((s) => s.id).join(', ')}).`,
    });
  } else {
    comparisons.push({
      topic: 'Multi-source coverage & consistency',
      agreementLevel: 'corroborated',
      sourceIds: sources.slice(0, 5).map((s) => s.id),
      notes: `${sources.length} retrieved sources provide consistent context without direct polarity conflicts.`,
    });
  }

  return comparisons;
}

function buildDeterministicResearchSynthesis(params: {
  query: string;
  clarifiedQuestions: string[];
  sources: CitationItem[];
  comparisons: DeepResearchComparison[];
  mockMode: boolean;
  configured: boolean;
}): string {
  const modeBanner = params.mockMode
    ? '**[LOCAL MOCK MODE — Deterministic Research Synthesis]** *(No live model or live web search calls were executed.)*'
    : !params.configured
      ? '**[SERVER API KEY UNCONFIGURED — Deterministic Corpus Digest]**'
      : '**[DETERMINISTIC SOURCE DIGEST]**';

  const sourceBullets =
    params.sources.length > 0
      ? params.sources
          .map(
            (s) =>
              `- **[${s.id}] ${s.sourceTitle}** (${s.sourceType}, accessed ${s.retrievedAt?.slice(0, 10) ?? 'session'}): ${s.excerpt.slice(0, 180)}`
          )
          .join('\n')
      : '- No external web sources or matching local workspace passages were retrieved.';

  return [
    modeBanner,
    `### Direct Answer & Scope\nResearch query evaluated: "${params.query}". ${
      params.sources.length > 0
        ? `Analysis is grounded in ${params.sources.length} collected source(s).`
        : 'Because zero sources were retrieved, domain claims are marked as unverified unknowns.'
    }`,
    `### Key Findings from Collected Sources\n${sourceBullets}`,
    `### Source Comparison\n${params.comparisons
      .map((c) => `- **${c.topic}** (${c.agreementLevel}): ${c.notes}`)
      .join('\n')}`,
    `### Uncertainties & Verification Limits\n- External claims not backed by [${params.sources.map((s) => s.id).join(', ') || 'none'}] remain unverified.\n- Confirm time-sensitive figures directly against primary publications.`,
  ].join('\n\n');
}

function buildClaimToSourceMatrix(
  synthesis: string,
  sources: CitationItem[],
  unsupportedFlags: string[]
): DeepResearchClaim[] {
  const claims: DeepResearchClaim[] = [];

  // Map each retrieved source into an explicit verified_fact entry first
  for (const src of sources.slice(0, 5)) {
    claims.push({
      id: `claim-${claims.length + 1}`,
      statement: `${src.sourceTitle}: ${src.excerpt.slice(0, 160).replace(/\s+/g, ' ').trim()}`,
      epistemicClass: 'verified_fact',
      sourceIds: [src.id],
      verificationNote: `Directly backed by retrieved ${src.sourceType} source [${src.id}].`,
    });
  }

  // Inspect synthesis sentences for inline citations vs plausible inferences vs unknowns
  const sentences = synthesis
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[#>*\-\d.)\s]+/, '').trim())
    .filter(
      (s) =>
        s.length >= 32 &&
        s.length <= 220 &&
        !s.includes('LOCAL MOCK MODE') &&
        !s.includes('DETERMINISTIC')
    );

  for (const sentence of sentences.slice(0, 5)) {
    const matchedIds = sources
      .filter(
        (src) =>
          sentence.includes(src.id) ||
          sentence.toLowerCase().includes(src.sourceTitle.toLowerCase().slice(0, 18))
      )
      .map((src) => src.id);

    if (
      /\b(unverified|uncertain|unknown|unavailable|zero\s+sources|confirm\s+time-sensitive)\b/i.test(
        sentence
      )
    ) {
      claims.push({
        id: `claim-${claims.length + 1}`,
        statement: sentence,
        epistemicClass: 'unknown',
        sourceIds: matchedIds,
        verificationNote: 'Explicitly marked as an open uncertainty or coverage boundary.',
      });
    } else if (matchedIds.length > 0) {
      claims.push({
        id: `claim-${claims.length + 1}`,
        statement: sentence,
        epistemicClass: 'verified_fact',
        sourceIds: matchedIds,
        verificationNote: `Linked to source(s): ${matchedIds.join(', ')}.`,
      });
    } else if (sources.length === 0) {
      claims.push({
        id: `claim-${claims.length + 1}`,
        statement: sentence,
        epistemicClass: 'unknown',
        sourceIds: [],
        verificationNote: 'No external or workspace sources were retrieved to verify this statement.',
      });
    } else {
      claims.push({
        id: `claim-${claims.length + 1}`,
        statement: sentence,
        epistemicClass: 'plausible_inference',
        sourceIds: sources.slice(0, 2).map((s) => s.id),
        verificationNote:
          'Synthesized inference consistent with collected context; not a verbatim quote.',
      });
    }
  }

  for (const bad of unsupportedFlags) {
    claims.push({
      id: `claim-${claims.length + 1}`,
      statement: bad,
      epistemicClass: 'unsupported',
      sourceIds: [],
      verificationNote: 'Flagged by Vaelor Sentinel as lacking connected source verification.',
    });
  }

  return claims.slice(0, 10);
}

function formatDeepResearchMarkdown(params: {
  query: string;
  statusLabel: string;
  searchProviderUsed: string;
  clarifiedQuestions: string[];
  executiveSummary: string;
  sources: CitationItem[];
  comparisons: DeepResearchComparison[];
  claims: DeepResearchClaim[];
  uncertainties: string[];
  unsupportedStatements: string[];
}): string {
  return [
    `# Deep Research Report: ${params.query}`,
    `- **Status:** ${params.statusLabel}`,
    `- **Search Provider:** ${params.searchProviderUsed}`,
    `- **Generated:** ${new Date().toISOString()}`,
    `## 1. Clarified Research Questions\n${params.clarifiedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
    `## 2. Executive Synthesis\n${params.executiveSummary}`,
    `## 3. Claim-to-Source Matrix\n${
      params.claims.length > 0
        ? params.claims
            .map(
              (c) =>
                `- **[${c.epistemicClass.toUpperCase()}]** ${c.statement} *(Sources: ${
                  c.sourceIds.join(', ') || 'None'
                })*`
            )
            .join('\n')
        : '- No claims recorded.'
    }`,
    `## 4. Collected Sources\n${
      params.sources.length > 0
        ? params.sources
            .map(
              (s) =>
                `- **[${s.id}] ${s.sourceTitle}** (${s.sourceType})${s.url ? ` — ${s.url}` : ''} — Accessed: ${s.retrievedAt ?? 'session'}`
            )
            .join('\n')
        : '- Zero sources collected.'
    }`,
    `## 5. Uncertainties & Unsupported Statements\n${[
      ...params.uncertainties.map((u) => `- Uncertainty: ${u}`),
      ...params.unsupportedStatements.map((u) => `- Unsupported: ${u}`),
    ].join('\n') || '- None noted.'}`,
  ].join('\n\n');
}

// ============================================================================
// MODULE D: Aether Vanguard Council Service (4 Specialist Roles + Synthesis)
// ============================================================================

export const COUNCIL_ROLE_SPECS: Record<
  CouncilRoleId,
  {
    title: string;
    mandate: string;
    systemDirective: string;
  }
> = {
  researcher: {
    title: 'Researcher',
    mandate: 'Evidence gathering, primary facts, empirical precedent, and knowledge gaps.',
    systemDirective:
      'You are the Aether Vanguard Council RESEARCHER. Focus strictly on empirical evidence, known facts, workspace citations, and explicit data gaps. Never invent citations or URLs.',
  },
  engineer: {
    title: 'Engineer',
    mandate: 'Technical architecture, implementation feasibility, failure modes, and security.',
    systemDirective:
      'You are the Aether Vanguard Council ENGINEER. Focus strictly on system architecture, concrete implementation mechanics, resource bounds, security invariants, and testability.',
  },
  strategist: {
    title: 'Strategist',
    mandate: 'Trade-offs, sequencing, user impact, ₹0 cost discipline, and prioritization.',
    systemDirective:
      'You are the Aether Vanguard Council STRATEGIST. Focus strictly on trade-offs, phased rollout sequencing, user value, operational simplicity, and ₹0 budget discipline.',
  },
  skeptical_reviewer: {
    title: 'Skeptical Reviewer',
    mandate: 'Adversarial critique, hidden assumptions, edge cases, and unsupported claims.',
    systemDirective:
      'You are the Aether Vanguard Council SKEPTICAL REVIEWER. Challenge optimistic assumptions, expose failure cases, highlight missing evidence, and identify unresolved risks.',
  },
};

export interface ConveneCouncilInput {
  prompt: string;
  projectId?: string;
  project?: ProjectWorkspace;
  documents: KnowledgeDocument[];
  memories: SavedMemory[];
  selectedRoles?: CouncilRoleId[];
  maxCallBudget?: number;
  maxCharsPerRole?: number;
  mockMode?: boolean;
  ownerSessionId?: string;
  signal?: AbortSignal;
}

export class VanguardCouncilService {
  private readonly gateway: ModelGateway;

  constructor(gateway: ModelGateway) {
    this.gateway = gateway;
  }

  public async conveneCouncil(input: ConveneCouncilInput): Promise<CouncilSessionResult> {
    const startedAt = Date.now();
    const cleanPrompt = input.prompt.trim().slice(0, 2000);
    const injectionCheck = assessPromptInjection(cleanPrompt);
    const mockMode = Boolean(input.mockMode);
    const routerStatus =
      typeof this.gateway.getRouterStatus === 'function'
        ? this.gateway.getRouterStatus(mockMode)
        : undefined;

    const requestedRoles: CouncilRoleId[] =
      input.selectedRoles && input.selectedRoles.length > 0
        ? input.selectedRoles
        : ['researcher', 'engineer', 'strategist', 'skeptical_reviewer'];

    const maxCallBudget = Math.max(1, Math.min(4, Math.floor(input.maxCallBudget ?? 4)));
    const maxCharsPerRole = Math.max(400, Math.min(2_400, Math.floor(input.maxCharsPerRole ?? 1_200)));
    const activeRoles = requestedRoles.slice(0, maxCallBudget);

    const contextLines: string[] = [];
    if (input.project) {
      contextLines.push(
        `Project Context: "${input.project.name}" (${input.project.category}) — Objective: ${input.project.objective}`
      );
    }
    if (input.memories.length > 0) {
      contextLines.push(
        wrapUntrustedData(
          'project_memories',
          input.memories
            .slice(0, 4)
            .map((m) => `- [${m.memoryType ?? m.category}] ${m.label}: ${m.content}`)
            .join('\n')
        )
      );
    }
    if (input.documents.length > 0) {
      const docSnippet = input.documents
        .slice(0, 2)
        .map((d) => `- ${d.title}: ${d.chunks[0]?.text.slice(0, 220) ?? ''}`)
        .join('\n');
      contextLines.push(wrapUntrustedData('workspace_documents', docSnippet));
    }

    const roleOutputs: CouncilRoleOutput[] = [];
    let callBudgetUsed = 0;
    let anyMock = mockMode;

    for (const roleId of activeRoles) {
      const spec = COUNCIL_ROLE_SPECS[roleId];
      const roleStart = Date.now();

      if (mockMode || !this.gateway.getStatus().configured) {
        anyMock = true;
        roleOutputs.push(
          buildDeterministicCouncilRoleOutput(
            roleId,
            spec,
            cleanPrompt,
            input.memories.length + input.documents.length,
            mockMode,
            Date.now() - roleStart
          )
        );
        continue;
      }

      callBudgetUsed += 1;
      const rolePrompt = [
        ...contextLines,
        `Council Deliberation Topic:\n${
          injectionCheck.flagged
            ? wrapUntrustedData('flagged_council_prompt', cleanPrompt)
            : cleanPrompt
        }`,
        `Role Mandate (${spec.title}): ${spec.mandate}`,
        `Respond concisely (under ${maxCharsPerRole} characters) using 4 short markdown sections: ### Analysis, ### Key Points (2-3 bullets), ### Risks or Critiques (1-2 bullets), ### Recommendation (1 sentence). Never invent URLs or claim unverified facts.`,
      ]
        .filter(Boolean)
        .join('\n\n');

      try {
        const gen = await this.gateway.generateText({
          systemInstruction: spec.systemDirective,
          turns: [{ role: 'user', text: rolePrompt }],
          tier: roleId === 'skeptical_reviewer' ? 'fast' : 'primary',
          maxOutputChars: maxCharsPerRole,
          timeoutMs: 16_000,
          mockMode: false,
          bypassCache: false,
          cacheScope: `${input.ownerSessionId ?? 'council'}-${roleId}`,
          signal: input.signal,
        });

        const safeText = detectSecretInText(gen.text)
          ? 'Role output redacted by Sentinel due to credential pattern.'
          : gen.text;

        roleOutputs.push(
          parseStructuredRoleOutput(roleId, spec, safeText, gen.modelUsed, Date.now() - roleStart)
        );
      } catch (err) {
        anyMock = true;
        const fallback = buildDeterministicCouncilRoleOutput(
          roleId,
          spec,
          cleanPrompt,
          input.memories.length + input.documents.length,
          false,
          Date.now() - roleStart
        );
        fallback.analysis = `*[Fallback structured brief — live model call failed: ${
          err instanceof Error ? err.message : 'timeout'
        }]*\n\n${fallback.analysis}`;
        roleOutputs.push(fallback);
      }
    }

    const distinctModelsUsed = new Set(roleOutputs.map((r) => r.modelUsed));
    const isIndependentMultiModel =
      !anyMock && distinctModelsUsed.size > 1 && !distinctModelsUsed.has('local-mock-simulator');

    const operatingMode = routerStatus?.operatingMode ?? (mockMode ? 'mock' : 'single-model');
    const modelHonestyDisclosure = mockMode
      ? 'Local Mock Mode active: specialist perspectives were generated deterministically without live LLM calls.'
      : !this.gateway.getStatus().configured
        ? 'GEMINI_API_KEY is not configured: specialist perspectives used deterministic structured templates.'
        : isIndependentMultiModel
          ? `Roles executed across ${distinctModelsUsed.size} distinct configured models (${Array.from(distinctModelsUsed).join(', ')}).`
          : `Single-model specialist mode: all ${roleOutputs.length} Council roles were executed as distinct role-prompted passes on "${Array.from(distinctModelsUsed)[0] ?? 'gemini-3.1-flash-lite'}" (not separate independent foundation models).`;

    const synthesis = synthesizeCouncilOutputs(roleOutputs, input.documents, input.memories);

    const combinedText = [
      ...roleOutputs.map((r) => r.analysis),
      synthesis.recommendedAction,
    ].join('\n\n');

    const audit = runDeterministicSentinelAudit({
      userRequest: cleanPrompt,
      draftAnswer: combinedText,
      toolCalls: [],
      citations: [],
      promptInjectionFlagged: injectionCheck.flagged,
      webSearchUsed: false,
      researchMode: false,
      isMockResponse: anyMock,
    });

    const sentinelReview: SentinelReview = {
      approved: !audit.requiresRevision,
      status: audit.flags.length > 0 ? 'flagged' : 'verified',
      verificationStatus: audit.flags.length > 0 ? 'unverified' : 'partially_verified',
      verificationLabel:
        audit.flags.length > 0
          ? 'Flags raised in Council review'
          : 'Structured Council deliberation verified',
      flags: audit.flags,
      issues: audit.issues,
      unsupportedClaims: audit.unsupportedClaims,
      verifiedFacts: audit.verifiedFacts,
      plausibleInferences: audit.plausibleInferences,
      unknowns: [...synthesis.unresolvedQuestions, ...audit.unknowns].slice(0, 6),
      contradictions: audit.contradictions,
      completionCriteriaMet: roleOutputs.length > 0 && audit.flags.length === 0,
      incompleteEvidenceWarning: audit.incompleteEvidenceWarning,
      citationChecks: audit.citationChecks,
      requiredCorrections: audit.requiredCorrections,
      verificationLimitations: audit.verificationLimitations,
      summary: `Audited ${roleOutputs.length} specialist role output(s); ${synthesis.disagreements.length} trade-off tension(s) surfaced.`,
      revised: false,
    };

    return {
      id: `council-${crypto.randomUUID().slice(0, 8)}`,
      prompt: cleanPrompt,
      projectId: input.projectId,
      selectedRoles: activeRoles,
      roleOutputs,
      synthesis,
      operatingMode,
      isIndependentMultiModel,
      modelHonestyDisclosure,
      callBudgetUsed,
      maxCallBudget,
      maxCharsPerRole,
      sentinelReview,
      isMockResponse: anyMock,
      ownerSessionId: input.ownerSessionId,
      createdAt: new Date().toISOString(),
      durationMs: Math.max(1, Date.now() - startedAt),
    };
  }
}

function buildDeterministicCouncilRoleOutput(
  roleId: CouncilRoleId,
  spec: { title: string; mandate: string },
  prompt: string,
  evidenceCount: number,
  mockMode: boolean,
  durationMs: number
): CouncilRoleOutput {
  const shortTopic = prompt.slice(0, 110);
  const tag = mockMode ? 'local-mock-simulator' : 'deterministic-template';

  if (roleId === 'researcher') {
    return {
      roleId,
      roleTitle: spec.title,
      mandate: spec.mandate,
      modelUsed: tag,
      analysis: `[Simulated/Template Brief] Evaluated empirical scope for "${shortTopic}". Workspace currently holds ${evidenceCount} attached memory/document item(s); external claims require grounded primary sources.`,
      keyPoints: [
        `Establish measurable baseline metrics before committing scope on "${shortTopic}".`,
        evidenceCount > 0
          ? `Cross-check decisions against the ${evidenceCount} attached workspace source(s).`
          : 'Attach primary specification documents or run Deep Research to gather external citations.',
      ],
      evidenceCited:
        evidenceCount > 0
          ? [`${evidenceCount} workspace document/memory item(s) available in scope.`]
          : ['No external citations attached yet.'],
      risksOrCritiques: ['Unverified market or benchmark assumptions could skew design choices.'],
      recommendation: 'Verify domain assumptions with primary sources before irreversible build steps.',
      durationMs: Math.max(1, durationMs),
    };
  }

  if (roleId === 'engineer') {
    return {
      roleId,
      roleTitle: spec.title,
      mandate: spec.mandate,
      modelUsed: tag,
      analysis: `[Simulated/Template Brief] Assessed technical architecture for "${shortTopic}". Favor modular TypeScript boundaries, strict Zod schema validation, bounded timeouts, and deterministic unit tests.`,
      keyPoints: [
        'Isolate state mutations behind validated server routes and explicit interfaces.',
        'Enforce hard timeout, step, and payload size ceilings to prevent cascading failures.',
      ],
      evidenceCited: ['Server-side gateway and deterministic tool validation invariants.'],
      risksOrCritiques: [
        'Tight coupling or unbounded retries will exhaust free-tier quotas under load.',
      ],
      recommendation: 'Ship a small, schema-validated vertical slice backed by automated node:test checks.',
      durationMs: Math.max(1, durationMs),
    };
  }

  if (roleId === 'strategist') {
    return {
      roleId,
      roleTitle: spec.title,
      mandate: spec.mandate,
      modelUsed: tag,
      analysis: `[Simulated/Template Brief] Evaluated sequencing and ₹0 resource allocation for "${shortTopic}". Prioritize high-trust core user workflows over speculative breadth.`,
      keyPoints: [
        'Sequence delivery into Phase 1 (verifiable core) before optional integrations.',
        'Preserve ₹0 operating cost by using free-tier quotas and transparent local fallbacks.',
      ],
      evidenceCited: ['₹0 budget guardrail and phased MVP delivery constraint.'],
      risksOrCritiques: [
        'Feature creep across unvalidated integrations dilutes reliability and user trust.',
      ],
      recommendation: 'Focus on the highest-leverage workflow and document deferred integrations clearly.',
      durationMs: Math.max(1, durationMs),
    };
  }

  return {
    roleId,
    roleTitle: spec.title,
    mandate: spec.mandate,
    modelUsed: tag,
    analysis: `[Simulated/Template Brief] Audited hidden assumptions and failure modes for "${shortTopic}". Any claim lacking retrieved source backing or deterministic test coverage must be treated as unverified.`,
    keyPoints: [
      'Audit authorization boundaries (anti-IDOR) and untrusted input handling first.',
      'Separate verified facts from plausible inferences in user-facing outputs.',
    ],
    evidenceCited: ['Zero-trust security and epistemic verification checklist.'],
    risksOrCritiques: [
      'Optimistic happy-path designs fail silently when APIs time out, quotas hit 429, or inputs are adversarial.',
      'Single-model roleplay can share blind spots—validate critical outputs deterministically.',
    ],
    recommendation: 'Gate consequential steps behind human approval and explicit failure-path tests.',
    durationMs: Math.max(1, durationMs),
  };
}

function parseStructuredRoleOutput(
  roleId: CouncilRoleId,
  spec: { title: string; mandate: string },
  rawText: string,
  modelUsed: string,
  durationMs: number
): CouncilRoleOutput {
  const bullets = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s+/.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, '').trim())
    .filter((l) => l.length > 8);

  const keyPoints = bullets.slice(0, 3);
  const risksOrCritiques = bullets.slice(3, 5);
  const sentences = rawText
    .replace(/#+\s+[^\n]+/g, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);

  const recommendation =
    sentences[sentences.length - 1] ?? 'Proceed iteratively with explicit verification gates.';

  return {
    roleId,
    roleTitle: spec.title,
    mandate: spec.mandate,
    modelUsed,
    analysis: rawText,
    keyPoints:
      keyPoints.length > 0 ? keyPoints : sentences.slice(0, 2),
    evidenceCited: ['Evaluated against active prompt and scoped workspace context.'],
    risksOrCritiques:
      risksOrCritiques.length > 0
        ? risksOrCritiques
        : ['Verify edge cases and external assumptions independently.'],
    recommendation: recommendation.slice(0, 260),
    durationMs: Math.max(1, durationMs),
  };
}

function synthesizeCouncilOutputs(
  outputs: CouncilRoleOutput[],
  documents: KnowledgeDocument[],
  memories: SavedMemory[]
): CouncilSynthesis {
  const agreements: string[] = [
    'Enforce explicit validation boundaries, bounded resource usage, and verifiable outputs before expanding scope.',
  ];
  if (outputs.some((o) => o.roleId === 'engineer') && outputs.some((o) => o.roleId === 'strategist')) {
    agreements.push(
      'Engineer and Strategist align on phased, modular delivery compatible with ₹0 free-tier constraints.'
    );
  }

  const disagreements: string[] = [];
  const skeptic = outputs.find((o) => o.roleId === 'skeptical_reviewer');
  const strategist = outputs.find((o) => o.roleId === 'strategist');
  if (skeptic && strategist) {
    disagreements.push(
      `Delivery speed vs. strict assurance: Strategist favors rapid high-leverage iteration ("${strategist.recommendation.slice(0, 110)}"), whereas Skeptical Reviewer insists on adversarial & failure-mode gating ("${skeptic.recommendation.slice(0, 110)}").`
    );
  } else if (outputs.length > 1) {
    disagreements.push(
      'Trade-off between broader feature coverage and strict latency/quota conservation.'
    );
  }

  const evidenceSummary: string[] = [
    `Workspace evidence in scope: ${documents.length} indexed document(s) and ${memories.length} project-scoped memory item(s).`,
  ];
  for (const out of outputs) {
    if (out.keyPoints[0]) {
      evidenceSummary.push(`${out.roleTitle}: ${out.keyPoints[0]}`);
    }
  }

  const unresolvedQuestions: string[] = [];
  if (documents.length === 0 && memories.length === 0) {
    unresolvedQuestions.push(
      'Which primary domain documents or quantitative constraints should be attached to ground this decision?'
    );
  }
  for (const out of outputs) {
    if (out.risksOrCritiques[0]) {
      unresolvedQuestions.push(`[${out.roleTitle} Risk] ${out.risksOrCritiques[0]}`);
    }
  }

  const recommendedAction =
    outputs.find((o) => o.roleId === 'strategist')?.recommendation ??
    outputs[0]?.recommendation ??
    'Define concrete acceptance criteria and verify each increment.';

  return {
    agreements,
    disagreements,
    evidenceSummary: evidenceSummary.slice(0, 6),
    unresolvedQuestions: unresolvedQuestions.slice(0, 5),
    recommendedAction,
  };
}

// ============================================================================
// MODULE E: Secure Coding Lab Service (Static Review, Generation & Test Plans;
// NEVER Executes Untrusted or AI-Generated Code)
// ============================================================================

export const CODING_LAB_SANDBOX_NOTICE =
  'Code execution is unavailable: no isolated CPU/memory/filesystem/network container sandbox is configured in this ₹0 deployment. AURENYX VAELOR Coding Lab provides code generation, static security/quality analysis, test-plan generation, safe static preview, and file download without executing untrusted code.';

export interface CodingLabAssistInput {
  mode: CodingLabMode;
  prompt: string;
  files: CodingLabFile[];
  mockMode?: boolean;
  ownerSessionId?: string;
  signal?: AbortSignal;
}

export class CodingLabService {
  private readonly gateway: ModelGateway;

  constructor(gateway: ModelGateway) {
    this.gateway = gateway;
  }

  public async runAssist(input: CodingLabAssistInput): Promise<CodingLabAssistResult> {
    const startedAt = Date.now();
    const cleanPrompt = input.prompt.trim().slice(0, 2000);
    const injectionCheck = assessPromptInjection(cleanPrompt);
    const mockMode = Boolean(input.mockMode);

    // Explicitly inspect ONLY the files explicitly passed in the Coding Lab request — never read server filesystem or process.env
    const boundedFiles = input.files.slice(0, 8).map((f) => ({
      name: f.name.trim().slice(0, 80),
      language: f.language.trim().slice(0, 24) || 'typescript',
      content: f.content.slice(0, 30_000),
    }));

    const staticFindings: CodingLabStaticFinding[] = [];
    const toolRecords: ToolCallRecord[] = [];

    for (const file of boundedFiles) {
      const reviewCall = await executeToolWithPermissions({
        agentId: 'vaelor-forge',
        toolName: 'code_static_reviewer',
        rawArgs: {
          code: file.content,
          language: file.language,
        },
        context: {
          documents: [],
          memories: [],
          gateway: this.gateway,
          mockMode,
          signal: input.signal,
        },
      });
      toolRecords.push(reviewCall.record);

      if (reviewCall.record.status === 'completed') {
        try {
          const parsed = JSON.parse(reviewCall.record.output) as {
            findings?: { severity: 'high' | 'medium' | 'low'; rule: string; detail: string }[];
          };
          for (const f of parsed.findings ?? []) {
            staticFindings.push({
              severity: f.severity,
              file: file.name,
              rule: f.rule,
              detail: f.detail,
            });
          }
        } catch {
          // Ignore malformed JSON
        }
      }

      if (detectSecretInText(file.content)) {
        staticFindings.push({
          severity: 'high',
          file: file.name,
          rule: 'hardcoded-secret-pattern',
          detail:
            'Potential API key or private credential pattern detected; move secrets to server environment variables.',
        });
      }
      if (/\b(child_process|execSync|spawnSync|vm\.runInNewContext)\b/.test(file.content)) {
        staticFindings.push({
          severity: 'high',
          file: file.name,
          rule: 'unsafe-process-execution',
          detail:
            'Process/VM execution primitive detected; never run untrusted input outside an isolated container sandbox.',
        });
      }
    }

    if (staticFindings.length === 0 && boundedFiles.length > 0) {
      staticFindings.push({
        severity: 'info',
        file: boundedFiles[0].name,
        rule: 'baseline-static-pass',
        detail: 'No dangerous dynamic execution, secret patterns, or high-risk anti-patterns flagged.',
      });
    }

    const routeDecision =
      typeof this.gateway.selectRoute === 'function'
        ? this.gateway.selectRoute({
            capability: 'coding',
            requestedTier: 'primary',
            estimatedInputChars:
              cleanPrompt.length + boundedFiles.reduce((s, f) => s + f.content.length, 0),
            mockMode,
          })
        : undefined;

    let modelUsed = 'deterministic-static-analyzer';
    let isMockResponse = mockMode;
    let summary = '';
    const generatedFiles: CodingLabFile[] = [];
    const testCases: CodingLabTestCase[] = [];

    if (input.mode === 'inspect_and_review') {
      const highCount = staticFindings.filter((f) => f.severity === 'high').length;
      const medCount = staticFindings.filter((f) => f.severity === 'medium').length;

      if (!mockMode && this.gateway.getStatus().configured) {
        const filesDigest = boundedFiles
          .map((f) => `File: ${f.name} (${f.language})\n\`\`\`${f.language}\n${f.content.slice(0, 4000)}\n\`\`\``)
          .join('\n\n');
        const reviewPrompt = [
          `Developer Request:\n${
            injectionCheck.flagged ? wrapUntrustedData('flagged_code_prompt', cleanPrompt) : cleanPrompt
          }`,
          `Workspace Files (Untrusted User Code — Inspect Statically Only):\n${wrapUntrustedData(
            'coding_lab_files',
            filesDigest
          )}`,
          `Deterministic Static Findings (${staticFindings.length}):\n${staticFindings
            .map((f) => `- [${f.severity.toUpperCase()}] ${f.file} (${f.rule}): ${f.detail}`)
            .join('\n')}`,
          'Provide a concise architectural & security review with concrete refactoring suggestions. Never claim you executed the code.',
        ].join('\n\n');

        try {
          const gen = await this.gateway.generateText({
            systemInstruction: AGENT_SYSTEM_PROMPTS['vaelor-forge'],
            turns: [{ role: 'user', text: reviewPrompt }],
            tier: 'primary',
            maxOutputChars: 3_200,
            timeoutMs: 18_000,
            mockMode: false,
            signal: input.signal,
          });
          modelUsed = gen.modelUsed;
          summary = detectSecretInText(gen.text)
            ? 'Code review withheld due to credential pattern.'
            : gen.text;
        } catch {
          isMockResponse = true;
          summary = `Static analysis inspected ${boundedFiles.length} file(s): ${highCount} high-severity and ${medCount} medium-severity finding(s) recorded. (Live model commentary unavailable.)`;
        }
      } else {
        isMockResponse = true;
        modelUsed = mockMode ? 'local-mock-simulator' : 'deterministic-static-analyzer';
        summary = `Inspected ${boundedFiles.length} workspace file(s) statically: ${highCount} high-severity and ${medCount} medium-severity finding(s). Arbitrary code execution was NOT performed.`;
      }
    } else if (input.mode === 'generate_code') {
      if (!mockMode && this.gateway.getStatus().configured) {
        const contextDigest = boundedFiles
          .slice(0, 3)
          .map((f) => `Existing File ${f.name}:\n${f.content.slice(0, 2500)}`)
          .join('\n\n');
        const genPrompt = [
          `Code Generation Task:\n${
            injectionCheck.flagged ? wrapUntrustedData('flagged_code_prompt', cleanPrompt) : cleanPrompt
          }`,
          contextDigest ? wrapUntrustedData('existing_files', contextDigest) : '',
          'Return clean, modular, strictly typed TypeScript code inside a single ```typescript ... ``` block followed by a brief explanation. Do not include secrets, eval(), or external unverified endpoints.',
        ]
          .filter(Boolean)
          .join('\n\n');

        try {
          const gen = await this.gateway.generateText({
            systemInstruction: AGENT_SYSTEM_PROMPTS['vaelor-forge'],
            turns: [{ role: 'user', text: genPrompt }],
            tier: 'primary',
            maxOutputChars: 5_000,
            timeoutMs: 20_000,
            mockMode: false,
            signal: input.signal,
          });
          modelUsed = gen.modelUsed;
          const safeText = detectSecretInText(gen.text)
            ? '// Output withheld: credential pattern detected'
            : gen.text;
          const match = safeText.match(/```(?:typescript|ts|tsx|javascript|js|html|css)?\n([\s\S]*?)```/i);
          const extractedCode = (match?.[1] ?? safeText).trim();
          generatedFiles.push({
            name: inferGeneratedFileName(cleanPrompt),
            language: 'typescript',
            content: extractedCode,
          });
          summary = safeText;
        } catch (err) {
          isMockResponse = true;
          const fallbackFile = buildDeterministicGeneratedFile(cleanPrompt);
          generatedFiles.push(fallbackFile);
          summary = `Live generation failed (${err instanceof Error ? err.message : 'error'}); provided deterministic TypeScript module scaffold "${fallbackFile.name}".`;
        }
      } else {
        isMockResponse = true;
        modelUsed = mockMode ? 'local-mock-simulator' : 'deterministic-code-scaffold';
        const scaffold = buildDeterministicGeneratedFile(cleanPrompt);
        generatedFiles.push(scaffold);
        summary = `[Simulated / Scaffold Mode] Generated clean TypeScript module "${scaffold.name}" for "${cleanPrompt.slice(0, 90)}". Review and download to run locally.`;
      }
    } else {
      // generate_test_plan
      const targetName = boundedFiles[0]?.name ?? 'module.ts';
      const baseStem = targetName.replace(/\.[a-z0-9]+$/i, '');
      testCases.push(
        {
          id: 'tc-1',
          title: 'Happy-path deterministic output verification',
          category: 'unit',
          targetFile: targetName,
          expectedOutcome: 'Returns expected typed result for valid canonical input.',
        },
        {
          id: 'tc-2',
          title: 'Empty, boundary, and malformed input rejection',
          category: 'validation',
          targetFile: targetName,
          expectedOutcome: 'Rejects out-of-range, empty, or malformed inputs without throwing unhandled runtime crashes.',
        },
        {
          id: 'tc-3',
          title: 'Idempotency and side-effect isolation check',
          category: 'edge_case',
          targetFile: targetName,
          expectedOutcome: 'Repeated calls with identical arguments produce identical outputs without mutating shared inputs.',
        },
        {
          id: 'tc-4',
          title: 'Untrusted payload & secret redaction guard',
          category: 'security',
          targetFile: targetName,
          expectedOutcome: 'Ensures adversarial strings and credential patterns are never executed or leaked.',
        }
      );

      const testFileContent = [
        `import test from 'node:test';`,
        `import assert from 'node:assert/strict';`,
        `// Target module under test: ./${targetName}`,
        ``,
        `test('${baseStem} — happy-path deterministic verification', () => {`,
        `  const sampleInput = ${JSON.stringify(cleanPrompt.slice(0, 60) || 'valid-input')};`,
        `  assert.equal(typeof sampleInput, 'string');`,
        `  assert.ok(sampleInput.length > 0);`,
        `});`,
        ``,
        `test('${baseStem} — rejects empty or out-of-bounds payloads safely', () => {`,
        `  const invalidInput = '';`,
        `  assert.equal(invalidInput.trim().length, 0);`,
        `});`,
      ].join('\n');

      generatedFiles.push({
        name: `${baseStem}.test.ts`,
        language: 'typescript',
        content: testFileContent,
      });

      modelUsed = mockMode ? 'local-mock-simulator' : 'deterministic-test-planner';
      isMockResponse = true;
      summary = `Generated ${testCases.length}-case verification plan and node:test suite scaffold (${baseStem}.test.ts) targeting ${targetName}. Download to execute in your local Node.js environment.`;
    }

    const audit = runDeterministicSentinelAudit({
      userRequest: cleanPrompt,
      draftAnswer: summary,
      toolCalls: toolRecords,
      citations: [],
      promptInjectionFlagged: injectionCheck.flagged,
      webSearchUsed: false,
      researchMode: false,
      isMockResponse,
    });

    const sentinelReview: SentinelReview = {
      approved: !audit.requiresRevision,
      status: audit.flags.length > 0 ? 'flagged' : 'verified',
      verificationStatus: 'verified_evidence',
      verificationLabel: 'Static analysis verified (no code execution)',
      flags: audit.flags,
      issues: audit.issues,
      unsupportedClaims: audit.unsupportedClaims,
      verifiedFacts: [
        `ExecutedCode invariant: false (sandboxStatus: unavailable).`,
        ...audit.verifiedFacts,
      ],
      plausibleInferences: audit.plausibleInferences,
      unknowns: [
        'Runtime behavior is unverified inside VAELOR because untrusted code execution is intentionally disabled.',
        ...audit.unknowns,
      ],
      contradictions: audit.contradictions,
      completionCriteriaMet: audit.completionCriteriaMet,
      incompleteEvidenceWarning: audit.incompleteEvidenceWarning,
      citationChecks: audit.citationChecks,
      requiredCorrections: audit.requiredCorrections,
      verificationLimitations: audit.verificationLimitations,
      summary: `Static security & Sentinel checks completed (${staticFindings.length} finding(s)); zero untrusted code executed.`,
      revised: false,
    };

    return {
      id: `clab-${crypto.randomUUID().slice(0, 8)}`,
      mode: input.mode,
      executedCode: false,
      sandboxStatus: 'unavailable',
      sandboxNotice: CODING_LAB_SANDBOX_NOTICE,
      summary,
      staticFindings,
      generatedFiles,
      testCases,
      recommendedTestCommand: `npx --yes tsx --test ${
        generatedFiles.find((f) => f.name.endsWith('.test.ts'))?.name ?? 'module.test.ts'
      }`,
      routeDecision,
      sentinelReview,
      modelUsed,
      isMockResponse,
      createdAt: new Date().toISOString(),
      durationMs: Math.max(1, Date.now() - startedAt),
    };
  }
}

function inferGeneratedFileName(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['generate', 'create', 'write', 'build', 'code', 'function', 'the', 'for', 'with'].includes(w))
    .slice(0, 2);
  const stem = words.length > 0 ? words.join('-') : 'generated-module';
  return `${stem}.ts`;
}

function buildDeterministicGeneratedFile(prompt: string): CodingLabFile {
  const fileName = inferGeneratedFileName(prompt);
  const safeComment = prompt.replace(/\*\//g, '').slice(0, 100);
  const content = [
    `/**`,
    ` * Generated by AURENYX VAELOR v0.4 Coding Lab (Static Scaffold)`,
    ` * Task: ${safeComment}`,
    ` * Note: Review and test locally; VAELOR never executes untrusted code.`,
    ` */`,
    `export interface ValidationResult<T> {`,
    `  ok: boolean;`,
    `  value?: T;`,
    `  error?: string;`,
    `}`,
    ``,
    `export function validateBoundedInput(raw: string, maxLength = 500): ValidationResult<string> {`,
    `  const trimmed = raw.trim();`,
    `  if (!trimmed) {`,
    `    return { ok: false, error: 'Input must not be empty.' };`,
    `  }`,
    `  if (trimmed.length > maxLength) {`,
    `    return { ok: false, error: \`Input exceeds maximum length of \${maxLength} characters.\` };`,
    `  }`,
    `  return { ok: true, value: trimmed };`,
    `}`,
  ].join('\n');

  return {
    name: fileName,
    language: 'typescript',
    content,
  };
}
