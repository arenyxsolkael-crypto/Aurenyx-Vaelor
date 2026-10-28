import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  buildPassportSnapshot,
  createEmptyTrustGridState,
  createSeededTrustGridState,
  DEFAULT_SAFEGUARD_CATALOG,
  evaluateProvisionalRisk,
  TRUSTGRID_BRAND,
  validateAndParseTrustGridState,
  type AssessmentQuestionnaireInput,
  type ContactDraftSubmission,
  type FindingSeverity,
  type FindingStatus,
  type SafeguardStatus,
  type TestOutcomeStatus,
  type TrustGridAssessment,
  type TrustGridFinding,
  type TrustGridPassport,
  type TrustGridSafeguardItem,
  type TrustGridStoreState,
  type TrustGridTestResult,
  type TrustGridTestScenario,
  type TrustGridWorkflow,
} from '../shared/trustgridEngine';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function addDaysIsoDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

interface SaveWorkflowAssessmentResult {
  workflow: TrustGridWorkflow;
  assessment: TrustGridAssessment;
  passport: TrustGridPassport;
}

interface TrustGridContextValue {
  state: TrustGridStoreState;
  storageWarning: string | null;
  saveWorkflowAssessment: (
    answers: AssessmentQuestionnaireInput,
    options?: { existingWorkflowId?: string; isSampleDemo?: boolean }
  ) => SaveWorkflowAssessmentResult;
  duplicateWorkflow: (workflowId: string) => TrustGridPassport | null;
  deleteWorkflow: (workflowId: string) => void;
  recordTestOutcome: (input: {
    workflowId: string;
    scenarioId: string;
    status: TestOutcomeStatus;
    actualResult: string;
    evidenceReference: string;
    tester: string;
    testedAt: string;
    notes: string;
    followUpFinding: string;
  }) => void;
  addCustomScenario: (input: {
    title: string;
    objective: string;
    preconditions: string;
    setupGuidance: string;
    expectedBehavior: string;
  }) => TrustGridTestScenario;
  updateSafeguard: (
    safeguardId: string,
    patch: Partial<Pick<TrustGridSafeguardItem, 'owner' | 'status' | 'evidence' | 'reviewDate'>>
  ) => void;
  ensureWorkflowSafeguards: (workflowId: string) => TrustGridSafeguardItem[];
  addFinding: (input: {
    workflowId: string;
    description: string;
    severity: FindingSeverity;
    owner: string;
    dueDate: string;
    evidence: string;
  }) => TrustGridFinding;
  updateFindingStatus: (findingId: string, status: FindingStatus) => void;
  mintUpdatedPassportSnapshot: (workflowId: string, reviewerName?: string) => TrustGridPassport | null;
  saveContactDraft: (input: {
    name: string;
    email: string;
    enquiryType: string;
    message: string;
  }) => ContactDraftSubmission;
  exportBackupJson: () => string;
  importBackupJson: (rawJson: string) => { ok: boolean; error?: string };
  resetToEmptyWorkspace: () => void;
  restoreSampleDemoData: () => void;
}

const TrustGridContext = createContext<TrustGridContextValue | null>(null);

function loadTrustGridStateFromStorage(storageKey: string): TrustGridStoreState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return createSeededTrustGridState();
    }
    const parsed = JSON.parse(raw) as unknown;
    const validated = validateAndParseTrustGridState(parsed);
    return validated ?? createSeededTrustGridState();
  } catch {
    return createSeededTrustGridState();
  }
}

export const TrustGridProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const scopedStorageKey = user?.uid
    ? `${TRUSTGRID_BRAND.storageKey}_uid_${user.uid}`
    : `${TRUSTGRID_BRAND.storageKey}_public_demo`;

  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string>(scopedStorageKey);
  const [state, setState] = useState<TrustGridStoreState>(() =>
    loadTrustGridStateFromStorage(scopedStorageKey)
  );

  // Reload isolated TrustGrid state whenever authenticated account UID changes
  useEffect(() => {
    setState(loadTrustGridStateFromStorage(scopedStorageKey));
    setLoadedKey(scopedStorageKey);
  }, [scopedStorageKey]);

  useEffect(() => {
    if (loadedKey !== scopedStorageKey) return;
    try {
      window.localStorage.setItem(scopedStorageKey, JSON.stringify(state));
      setStorageWarning(null);
    } catch {
      setStorageWarning(
        'Browser local storage is unavailable or full. Changes remain active in memory for this tab; export a JSON backup before closing.'
      );
    }
  }, [state, scopedStorageKey, loadedKey]);

  const saveWorkflowAssessment = useCallback(
    (
      answers: AssessmentQuestionnaireInput,
      options?: { existingWorkflowId?: string; isSampleDemo?: boolean }
    ): SaveWorkflowAssessmentResult => {
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);
      const nextReviewDate = addDaysIsoDate(90);
      const evaluation = evaluateProvisionalRisk(answers);

      let resultHolder: SaveWorkflowAssessmentResult | null = null;

      setState((prev) => {
        const existingWf = options?.existingWorkflowId
          ? prev.workflows.find((w) => w.id === options.existingWorkflowId)
          : undefined;

        const workflowId = existingWf?.id ?? makeId('wf');
        const orgNameTrimmed = answers.organizationName.trim();
        const existingOrg = prev.organizations.find(
          (o) => o.name.toLowerCase() === orgNameTrimmed.toLowerCase()
        );
        const orgId = existingOrg?.id ?? makeId('org');
        const nextOrgs = existingOrg
          ? prev.organizations
          : [...prev.organizations, { id: orgId, name: orgNameTrimmed, createdAt: nowIso }];

        const workflow: TrustGridWorkflow = {
          id: workflowId,
          organizationId: orgId,
          organizationName: orgNameTrimmed,
          name: answers.workflowName.trim(),
          purpose: answers.purpose.trim(),
          owner: answers.owner.trim(),
          platform: answers.platform.trim(),
          connectedSystems: answers.connectedSystems.trim(),
          scopeAndLimitations:
            answers.scopeAndLimitations.trim() ||
            'Scoped strictly to the stated workflow purpose; requires reassessment if prompts, models, or tool permissions change.',
          dataSensitivity: answers.dataSensitivity,
          dataSensitivityNotes: answers.dataSensitivityNotes?.trim(),
          autonomyLevel: answers.autonomyLevel,
          autonomyNotes: answers.autonomyNotes?.trim(),
          impactLevel: answers.impactLevel,
          externalInput: answers.externalInput,
          externalInputSources: answers.externalInputSources?.trim(),
          loggingLevel: answers.loggingLevel,
          humanApproval: answers.humanApproval,
          humanApprovalDetails: answers.humanApprovalDetails?.trim(),
          rollbackCapability: answers.rollbackCapability,
          rollbackDetails: answers.rollbackDetails?.trim(),
          safeguards: answers.existingSafeguards.trim(),
          unresolvedIssues: answers.unresolvedIssues.trim(),
          remediationOwner: answers.remediationOwner.trim(),
          remediationDueDate: answers.remediationDueDate || addDaysIsoDate(30),
          reviewerName: (answers.reviewerName || answers.owner).trim(),
          isSampleDemo: Boolean(options?.isSampleDemo ?? false),
          createdAt: existingWf?.createdAt ?? nowIso,
          updatedAt: nowIso,
        };

        const existingWfSafeguards = prev.safeguards.filter((s) => s.workflowId === workflowId);
        const wfSafeguards: TrustGridSafeguardItem[] =
          existingWfSafeguards.length > 0
            ? existingWfSafeguards
            : DEFAULT_SAFEGUARD_CATALOG.map((item, idx) => ({
                ...item,
                id: makeId(`sg-${idx}`),
                workflowId,
                owner: workflow.remediationOwner,
                status: evaluation.recommendedSafeguardCategories.includes(item.category)
                  ? 'planned'
                  : 'recommended',
                evidence: '',
                reviewDate: nextReviewDate,
              }));

        const preservedOtherSafeguards = prev.safeguards.filter((s) => s.workflowId !== workflowId);

        const existingWfFindings = prev.findings.filter((f) => f.workflowId === workflowId);
        const generatedFindings: TrustGridFinding[] = [...existingWfFindings];

        if (
          workflow.unresolvedIssues &&
          !generatedFindings.some((f) => f.description === workflow.unresolvedIssues)
        ) {
          generatedFindings.push({
            id: makeId('fnd'),
            workflowId,
            description: workflow.unresolvedIssues,
            severity:
              evaluation.riskBand === 'Critical'
                ? 'critical'
                : evaluation.riskBand === 'High'
                  ? 'high'
                  : 'moderate',
            owner: workflow.remediationOwner,
            dueDate: workflow.remediationDueDate || addDaysIsoDate(30),
            status: 'open',
            evidence: 'Documented during guided assessment',
            origin: 'user-entered',
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }

        for (const flag of evaluation.criticalReviewFlags) {
          if (!generatedFindings.some((f) => f.description.includes(flag.title))) {
            generatedFindings.push({
              id: makeId('fnd'),
              workflowId,
              description: `${flag.title}: ${flag.recommendedAction}`,
              severity: 'critical',
              owner: workflow.remediationOwner,
              dueDate: workflow.remediationDueDate || addDaysIsoDate(14),
              status: 'open',
              evidence: `Rule flag ${flag.code}`,
              origin: 'rule-generated',
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          }
        }

        const otherFindings = prev.findings.filter((f) => f.workflowId !== workflowId);

        const existingWfTests = prev.testResults.filter((tr) => tr.workflowId === workflowId);
        const wfTests: TrustGridTestResult[] =
          existingWfTests.length > 0
            ? existingWfTests
            : prev.scenarios.map((scn) => ({
                id: makeId('tr'),
                workflowId,
                scenarioId: scn.id,
                scenarioCode: scn.code,
                scenarioTitle: scn.title,
                status: 'not-run',
                expectedResult: scn.expectedBehavior,
                actualResult: '',
                evidenceReference: '',
                tester: '',
                testedAt: '',
                notes: '',
                followUpFinding: '',
              }));
        const otherTests = prev.testResults.filter((tr) => tr.workflowId !== workflowId);

        const assessmentId = makeId('asmt');
        const assessment: TrustGridAssessment = {
          id: assessmentId,
          workflowId,
          methodologyVersion: evaluation.methodologyVersion,
          methodologyLabel: evaluation.methodologyLabel,
          answers,
          score: evaluation.score,
          riskBand: evaluation.riskBand,
          contributions: evaluation.contributions,
          criticalReviewFlags: evaluation.criticalReviewFlags,
          findings: generatedFindings.map((f) => f.description),
          assessor: workflow.reviewerName,
          assessedAt: todayDate,
          nextReviewDate,
        };

        const priorPassportsForWf = prev.passports.filter((p) => p.workflowId === workflowId);
        const nextVersion =
          priorPassportsForWf.reduce((maxV, p) => Math.max(maxV, p.version), 0) + 1;
        const passportCode =
          priorPassportsForWf[0]?.passportCode ??
          `ATP-${new Date().getFullYear()}-${String(prev.passports.length + 1).padStart(4, '0')}`;

        const snapshot = buildPassportSnapshot({
          passportCode,
          versionNumber: nextVersion,
          workflow,
          assessment,
          testResults: wfTests,
          safeguards: wfSafeguards,
          findings: generatedFindings,
        });

        const passport: TrustGridPassport = {
          id: makeId('pp'),
          passportCode,
          workflowId,
          assessmentId,
          version: nextVersion,
          snapshot,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: workflow.reviewerName,
          isSampleDemo: workflow.isSampleDemo,
        };

        resultHolder = { workflow, assessment, passport };

        const nextWorkflows = existingWf
          ? prev.workflows.map((w) => (w.id === workflowId ? workflow : w))
          : [workflow, ...prev.workflows];

        // Preserve historical assessments and Passport snapshots rather than overwriting them!
        return {
          ...prev,
          organizations: nextOrgs,
          workflows: nextWorkflows,
          assessments: [assessment, ...prev.assessments],
          safeguards: [...wfSafeguards, ...preservedOtherSafeguards],
          findings: [...generatedFindings, ...otherFindings],
          testResults: [...wfTests, ...otherTests],
          passports: [passport, ...prev.passports],
        };
      });

      return resultHolder!;
    },
    []
  );

  const duplicateWorkflow = useCallback(
    (workflowId: string): TrustGridPassport | null => {
      const targetWf = state.workflows.find((w) => w.id === workflowId);
      const latestAsmt = state.assessments.find((a) => a.workflowId === workflowId);
      if (!targetWf || !latestAsmt) return null;

      const clonedAnswers: AssessmentQuestionnaireInput = {
        ...latestAsmt.answers,
        workflowName: `${targetWf.name.replace(/\s*\(Sample Demo\)$/i, '')} (Copy)`,
      };
      const created = saveWorkflowAssessment(clonedAnswers, { isSampleDemo: false });
      return created.passport;
    },
    [state.workflows, state.assessments, saveWorkflowAssessment]
  );

  const deleteWorkflow = useCallback((workflowId: string) => {
    setState((prev) => ({
      ...prev,
      workflows: prev.workflows.filter((w) => w.id !== workflowId),
      assessments: prev.assessments.filter((a) => a.workflowId !== workflowId),
      testResults: prev.testResults.filter((t) => t.workflowId !== workflowId),
      safeguards: prev.safeguards.filter((s) => s.workflowId !== workflowId),
      findings: prev.findings.filter((f) => f.workflowId !== workflowId),
      passports: prev.passports.filter((p) => p.workflowId !== workflowId),
    }));
  }, []);

  const recordTestOutcome = useCallback(
    (input: {
      workflowId: string;
      scenarioId: string;
      status: TestOutcomeStatus;
      actualResult: string;
      evidenceReference: string;
      tester: string;
      testedAt: string;
      notes: string;
      followUpFinding: string;
    }) => {
      const nowIso = new Date().toISOString();
      setState((prev) => {
        const scenario = prev.scenarios.find((s) => s.id === input.scenarioId);
        if (!scenario) return prev;
        const wf = prev.workflows.find((w) => w.id === input.workflowId);

        const existingIdx = prev.testResults.findIndex(
          (tr) => tr.workflowId === input.workflowId && tr.scenarioId === input.scenarioId
        );

        const updatedRecord: TrustGridTestResult = {
          id: existingIdx >= 0 ? prev.testResults[existingIdx].id : makeId('tr'),
          workflowId: input.workflowId,
          scenarioId: scenario.id,
          scenarioCode: scenario.code,
          scenarioTitle: scenario.title,
          status: input.status,
          expectedResult: scenario.expectedBehavior,
          actualResult: input.actualResult.trim(),
          evidenceReference: input.evidenceReference.trim(),
          tester: input.tester.trim(),
          testedAt: input.testedAt || nowIso.slice(0, 10),
          notes: input.notes.trim(),
          followUpFinding: input.followUpFinding.trim(),
        };

        const nextResults =
          existingIdx >= 0
            ? prev.testResults.map((tr, i) => (i === existingIdx ? updatedRecord : tr))
            : [...prev.testResults, updatedRecord];

        const nextFindings = [...prev.findings];
        if (input.followUpFinding.trim()) {
          const desc = `[${scenario.code}] ${input.followUpFinding.trim()}`;
          if (!nextFindings.some((f) => f.workflowId === input.workflowId && f.description === desc)) {
            nextFindings.unshift({
              id: makeId('fnd'),
              workflowId: input.workflowId,
              description: desc,
              severity: input.status === 'fail' ? 'high' : 'moderate',
              owner: wf?.remediationOwner || input.tester.trim() || 'Workflow Owner',
              dueDate: addDaysIsoDate(21),
              status: 'open',
              evidence: input.evidenceReference.trim() || `Self-recorded test ${scenario.code}`,
              origin: 'self-reported-test',
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          }
        }

        return {
          ...prev,
          testResults: nextResults,
          findings: nextFindings,
        };
      });
    },
    []
  );

  const addCustomScenario = useCallback(
    (input: {
      title: string;
      objective: string;
      preconditions: string;
      setupGuidance: string;
      expectedBehavior: string;
    }): TrustGridTestScenario => {
      const nowIso = new Date().toISOString();
      const customNumber =
        state.scenarios.filter((s) => s.isCustom).length + 9;
      const newScenario: TrustGridTestScenario = {
        id: makeId('scn-custom'),
        code: `SCN-${String(customNumber).padStart(2, '0')}`,
        title: input.title.trim(),
        objective: input.objective.trim(),
        preconditions: input.preconditions.trim(),
        setupGuidance: input.setupGuidance.trim(),
        expectedBehavior: input.expectedBehavior.trim(),
        isCustom: true,
        createdAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        scenarios: [...prev.scenarios, newScenario],
      }));
      return newScenario;
    },
    [state.scenarios]
  );

  const ensureWorkflowSafeguards = useCallback(
    (workflowId: string): TrustGridSafeguardItem[] => {
      const existing = state.safeguards.filter((s) => s.workflowId === workflowId);
      if (existing.length > 0) return existing;
      return state.safeguards.filter((s) => !s.workflowId);
    },
    [state.safeguards]
  );

  const updateSafeguard = useCallback(
    (
      safeguardId: string,
      patch: Partial<Pick<TrustGridSafeguardItem, 'owner' | 'status' | 'evidence' | 'reviewDate'>>
    ) => {
      setState((prev) => ({
        ...prev,
        safeguards: prev.safeguards.map((sg) =>
          sg.id === safeguardId ? { ...sg, ...patch } : sg
        ),
      }));
    },
    []
  );

  const addFinding = useCallback(
    (input: {
      workflowId: string;
      description: string;
      severity: FindingSeverity;
      owner: string;
      dueDate: string;
      evidence: string;
    }): TrustGridFinding => {
      const nowIso = new Date().toISOString();
      const finding: TrustGridFinding = {
        id: makeId('fnd'),
        workflowId: input.workflowId,
        description: input.description.trim(),
        severity: input.severity,
        owner: input.owner.trim(),
        dueDate: input.dueDate || addDaysIsoDate(30),
        status: 'open',
        evidence: input.evidence.trim(),
        origin: 'user-entered',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        findings: [finding, ...prev.findings],
      }));
      return finding;
    },
    []
  );

  const updateFindingStatus = useCallback((findingId: string, status: FindingStatus) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      findings: prev.findings.map((f) =>
        f.id === findingId ? { ...f, status, updatedAt: nowIso } : f
      ),
    }));
  }, []);

  const mintUpdatedPassportSnapshot = useCallback(
    (workflowId: string, reviewerName?: string): TrustGridPassport | null => {
      let createdPassport: TrustGridPassport | null = null;
      const nowIso = new Date().toISOString();

      setState((prev) => {
        const wf = prev.workflows.find((w) => w.id === workflowId);
        const latestAsmt = prev.assessments.find((a) => a.workflowId === workflowId);
        if (!wf || !latestAsmt) return prev;

        const wfTests = prev.testResults.filter((t) => t.workflowId === workflowId);
        const wfSafeguards = prev.safeguards.filter((s) => s.workflowId === workflowId);
        const wfFindings = prev.findings.filter((f) => f.workflowId === workflowId);

        const priorPassports = prev.passports.filter((p) => p.workflowId === workflowId);
        const nextVersion =
          priorPassports.reduce((maxV, p) => Math.max(maxV, p.version), 0) + 1;
        const passportCode =
          priorPassports[0]?.passportCode ??
          `ATP-${new Date().getFullYear()}-${String(prev.passports.length + 1).padStart(4, '0')}`;

        const snapshot = buildPassportSnapshot({
          passportCode,
          versionNumber: nextVersion,
          workflow: wf,
          assessment: {
            ...latestAsmt,
            assessor: reviewerName?.trim() || latestAsmt.assessor,
            assessedAt: nowIso.slice(0, 10),
          },
          testResults: wfTests,
          safeguards: wfSafeguards,
          findings: wfFindings,
        });

        createdPassport = {
          id: makeId('pp'),
          passportCode,
          workflowId,
          assessmentId: latestAsmt.id,
          version: nextVersion,
          snapshot,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: reviewerName?.trim() || wf.reviewerName,
          isSampleDemo: wf.isSampleDemo,
        };

        return {
          ...prev,
          workflows: prev.workflows.map((w) =>
            w.id === workflowId ? { ...w, updatedAt: nowIso } : w
          ),
          passports: [createdPassport, ...prev.passports],
        };
      });

      return createdPassport;
    },
    []
  );

  const saveContactDraft = useCallback(
    (input: {
      name: string;
      email: string;
      enquiryType: string;
      message: string;
    }): ContactDraftSubmission => {
      const draft: ContactDraftSubmission = {
        id: makeId('contact'),
        name: input.name.trim(),
        email: input.email.trim(),
        enquiryType: input.enquiryType,
        message: input.message.trim(),
        createdAt: new Date().toISOString(),
        deliveryMode: 'local-draft-only',
      };
      setState((prev) => ({
        ...prev,
        contactDrafts: [draft, ...prev.contactDrafts],
      }));
      return draft;
    },
    []
  );

  const exportBackupJson = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importBackupJson = useCallback((rawJson: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      const validated = validateAndParseTrustGridState(parsed);
      if (!validated) {
        return {
          ok: false,
          error:
            'Invalid backup format. Expected an AURENYX TRUSTGRID schemaVersion 1 JSON export.',
        };
      }
      setState(validated);
      return { ok: true };
    } catch {
      return { ok: false, error: 'File does not contain valid JSON.' };
    }
  }, []);

  const resetToEmptyWorkspace = useCallback(() => {
    setState(createEmptyTrustGridState());
  }, []);

  const restoreSampleDemoData = useCallback(() => {
    setState(createSeededTrustGridState());
  }, []);

  const value = useMemo<TrustGridContextValue>(
    () => ({
      state,
      storageWarning,
      saveWorkflowAssessment,
      duplicateWorkflow,
      deleteWorkflow,
      recordTestOutcome,
      addCustomScenario,
      updateSafeguard,
      ensureWorkflowSafeguards,
      addFinding,
      updateFindingStatus,
      mintUpdatedPassportSnapshot,
      saveContactDraft,
      exportBackupJson,
      importBackupJson,
      resetToEmptyWorkspace,
      restoreSampleDemoData,
    }),
    [
      state,
      storageWarning,
      saveWorkflowAssessment,
      duplicateWorkflow,
      deleteWorkflow,
      recordTestOutcome,
      addCustomScenario,
      updateSafeguard,
      ensureWorkflowSafeguards,
      addFinding,
      updateFindingStatus,
      mintUpdatedPassportSnapshot,
      saveContactDraft,
      exportBackupJson,
      importBackupJson,
      resetToEmptyWorkspace,
      restoreSampleDemoData,
    ]
  );

  return <TrustGridContext.Provider value={value}>{children}</TrustGridContext.Provider>;
};

export function useTrustGrid(): TrustGridContextValue {
  const ctx = useContext(TrustGridContext);
  if (!ctx) {
    throw new Error('useTrustGrid must be used within TrustGridProvider');
  }
  return ctx;
}
