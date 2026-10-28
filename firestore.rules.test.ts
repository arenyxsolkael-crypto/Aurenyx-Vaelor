import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Deterministic Firestore Security Rules Evaluator & Structural Verifier
 * Mirrors the exact predicates in `/firestore.rules` and `/firebase-blueprint.json`
 * to test all 12 "Dirty Dozen" adversarial payloads (from `security_spec.md`)
 * plus positive verified-owner paths in fast offline `node:test` execution.
 */

interface MockAuthContext {
  uid: string;
  token: {
    email?: string;
    email_verified?: boolean;
  };
}

interface MockTimestamp {
  readonly __type: 'timestamp';
  readonly epochMs: number;
}

function makeTimestamp(epochMs: number): MockTimestamp {
  return { __type: 'timestamp', epochMs };
}

function isTimestamp(val: unknown): val is MockTimestamp {
  return Boolean(
    val &&
      typeof val === 'object' &&
      (val as MockTimestamp).__type === 'timestamp' &&
      typeof (val as MockTimestamp).epochMs === 'number'
  );
}

function timestampsEqual(a: unknown, b: unknown): boolean {
  return isTimestamp(a) && isTimestamp(b) && a.epochMs === b.epochMs;
}

const SERVER_NOW = makeTimestamp(1_760_000_000_000);

type RuleDecision = 'ALLOW' | 'PERMISSION_DENIED';

interface MockFirestoreState {
  docs: Map<string, Record<string, unknown>>;
}

function isSignedIn(auth: MockAuthContext | null): auth is MockAuthContext {
  return auth !== null && typeof auth.uid === 'string' && auth.uid.length > 0;
}

function isVerifiedUser(auth: MockAuthContext | null): auth is MockAuthContext {
  return isSignedIn(auth) && auth.token.email_verified === true;
}

function isOwner(auth: MockAuthContext | null, userId: string): boolean {
  return isSignedIn(auth) && auth.uid === userId;
}

function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function hasAllKeys(data: Record<string, unknown>, required: string[]): boolean {
  return required.every((k) => Object.prototype.hasOwnProperty.call(data, k));
}

function hasOnlyKeys(data: Record<string, unknown>, allowed: string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(data).every((k) => allowedSet.has(k));
}

function affectedKeysOnly(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>,
  allowed: string[]
): boolean {
  const allKeys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const key of allKeys) {
    const a = incoming[key];
    const b = existing[key];
    const same = isTimestamp(a) && isTimestamp(b) ? timestampsEqual(a, b) : JSON.stringify(a) === JSON.stringify(b);
    if (!same) {
      changed.push(key);
    }
  }
  const allowedSet = new Set(allowed);
  return changed.every((k) => allowedSet.has(k));
}

function hasValidParentUser(state: MockFirestoreState, auth: MockAuthContext | null, userId: string): boolean {
  if (!isSignedIn(auth)) return false;
  const parent = state.docs.get(`/users/${userId}`);
  return Boolean(parent && parent.ownerId === auth.uid);
}

function isValidUserProfile(auth: MockAuthContext | null, data: Record<string, unknown>): boolean {
  return (
    isSignedIn(auth) &&
    typeof data.ownerId === 'string' &&
    data.ownerId.length >= 1 &&
    data.ownerId.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(data.ownerId) &&
    data.ownerId === auth.uid &&
    typeof data.displayName === 'string' &&
    data.displayName.length >= 1 &&
    data.displayName.length <= 80 &&
    Array.isArray(data.authProviders) &&
    data.authProviders.length <= 5 &&
    (data.authProviders.length === 0 ||
      (typeof data.authProviders[0] === 'string' && data.authProviders[0].length <= 40)) &&
    typeof data.themePreference === 'string' &&
    data.themePreference.length <= 10 &&
    (data.themePreference === 'dark' || data.themePreference === 'light') &&
    isTimestamp(data.createdAt) &&
    isTimestamp(data.updatedAt)
  );
}

function isValidUserPrivateInfo(auth: MockAuthContext | null, data: Record<string, unknown>): boolean {
  return (
    isSignedIn(auth) &&
    typeof data.ownerId === 'string' &&
    data.ownerId.length >= 1 &&
    data.ownerId.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(data.ownerId) &&
    data.ownerId === auth.uid &&
    typeof data.email === 'string' &&
    data.email.length >= 3 &&
    data.email.length <= 254 &&
    typeof data.emailVerified === 'boolean' &&
    isTimestamp(data.createdAt) &&
    isTimestamp(data.updatedAt)
  );
}

function isValidCloudProject(auth: MockAuthContext | null, data: Record<string, unknown>): boolean {
  return (
    isSignedIn(auth) &&
    typeof data.ownerId === 'string' &&
    data.ownerId.length >= 1 &&
    data.ownerId.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(data.ownerId) &&
    data.ownerId === auth.uid &&
    typeof data.name === 'string' &&
    data.name.length >= 2 &&
    data.name.length <= 80 &&
    typeof data.objective === 'string' &&
    data.objective.length >= 4 &&
    data.objective.length <= 600 &&
    typeof data.description === 'string' &&
    data.description.length <= 800 &&
    typeof data.brief === 'string' &&
    data.brief.length <= 2400 &&
    typeof data.category === 'string' &&
    data.category.length <= 24 &&
    ['software', 'research', 'strategy', 'documentation'].includes(data.category) &&
    typeof data.status === 'string' &&
    data.status.length <= 16 &&
    ['active', 'planning', 'paused', 'archived'].includes(data.status) &&
    isTimestamp(data.createdAt) &&
    isTimestamp(data.updatedAt)
  );
}

function isValidCloudMemory(auth: MockAuthContext | null, data: Record<string, unknown>): boolean {
  return (
    isSignedIn(auth) &&
    typeof data.ownerId === 'string' &&
    data.ownerId.length >= 1 &&
    data.ownerId.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(data.ownerId) &&
    data.ownerId === auth.uid &&
    typeof data.label === 'string' &&
    data.label.length >= 2 &&
    data.label.length <= 80 &&
    typeof data.content === 'string' &&
    data.content.length >= 2 &&
    data.content.length <= 1200 &&
    typeof data.category === 'string' &&
    data.category.length <= 24 &&
    ['preference', 'project-fact', 'constraint', 'note'].includes(data.category) &&
    isTimestamp(data.createdAt) &&
    isTimestamp(data.updatedAt)
  );
}

function evaluateFirestoreRule(params: {
  state: MockFirestoreState;
  auth: MockAuthContext | null;
  op: 'get' | 'list' | 'create' | 'update' | 'delete';
  docPath: string;
  incomingData?: Record<string, unknown>;
  requestTime?: MockTimestamp;
}): RuleDecision {
  const { state, auth, op, docPath, incomingData = {}, requestTime = SERVER_NOW } = params;
  const existingData = state.docs.get(docPath);
  const segments = docPath.split('/').filter(Boolean);

  // /users/{userId}
  if (segments.length === 2 && segments[0] === 'users') {
    const userId = segments[1];
    if (op === 'list') return 'PERMISSION_DENIED';
    if (op === 'get') {
      return isOwner(auth, userId) && isValidId(userId) && existingData?.ownerId === auth?.uid
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (op === 'create') {
      const ok =
        isVerifiedUser(auth) &&
        isOwner(auth, userId) &&
        isValidId(userId) &&
        isValidUserProfile(auth, incomingData) &&
        hasAllKeys(incomingData, [
          'ownerId',
          'displayName',
          'authProviders',
          'themePreference',
          'createdAt',
          'updatedAt',
        ]) &&
        hasOnlyKeys(incomingData, [
          'ownerId',
          'displayName',
          'authProviders',
          'themePreference',
          'createdAt',
          'updatedAt',
        ]) &&
        timestampsEqual(incomingData.createdAt, requestTime) &&
        timestampsEqual(incomingData.updatedAt, requestTime);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'update') {
      if (!existingData) return 'PERMISSION_DENIED';
      const ok =
        isValidUserProfile(auth, incomingData) &&
        isVerifiedUser(auth) &&
        isOwner(auth, userId) &&
        isValidId(userId) &&
        incomingData.ownerId === existingData.ownerId &&
        timestampsEqual(incomingData.createdAt, existingData.createdAt) &&
        timestampsEqual(incomingData.updatedAt, requestTime) &&
        affectedKeysOnly(incomingData, existingData, [
          'displayName',
          'authProviders',
          'themePreference',
          'updatedAt',
        ]);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'delete') {
      return isVerifiedUser(auth) &&
        isOwner(auth, userId) &&
        isValidId(userId) &&
        existingData?.ownerId === auth?.uid
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
  }

  // /users/{userId}/private/{infoId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'private') {
    const [, userId, , infoId] = segments;
    if (op === 'list') return 'PERMISSION_DENIED';
    if (op === 'get') {
      const ok =
        isOwner(auth, userId) &&
        isValidId(userId) &&
        isValidId(infoId) &&
        infoId === 'account' &&
        existingData?.ownerId === auth?.uid &&
        hasValidParentUser(state, auth, userId);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'create') {
      const ok =
        isVerifiedUser(auth) &&
        isOwner(auth, userId) &&
        isValidId(userId) &&
        isValidId(infoId) &&
        infoId === 'account' &&
        isValidUserPrivateInfo(auth, incomingData) &&
        hasAllKeys(incomingData, ['ownerId', 'email', 'emailVerified', 'createdAt', 'updatedAt']) &&
        hasOnlyKeys(incomingData, ['ownerId', 'email', 'emailVerified', 'createdAt', 'updatedAt']) &&
        timestampsEqual(incomingData.createdAt, requestTime) &&
        timestampsEqual(incomingData.updatedAt, requestTime) &&
        hasValidParentUser(state, auth, userId);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'update') {
      if (!existingData) return 'PERMISSION_DENIED';
      const ok =
        isValidUserPrivateInfo(auth, incomingData) &&
        isVerifiedUser(auth) &&
        isOwner(auth, userId) &&
        isValidId(userId) &&
        isValidId(infoId) &&
        infoId === 'account' &&
        incomingData.ownerId === existingData.ownerId &&
        timestampsEqual(incomingData.createdAt, existingData.createdAt) &&
        timestampsEqual(incomingData.updatedAt, requestTime) &&
        affectedKeysOnly(incomingData, existingData, ['email', 'emailVerified', 'updatedAt']) &&
        hasValidParentUser(state, auth, userId);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  // /users/{userId}/projects/{projectId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'projects') {
    const [, userId, , projectId] = segments;
    if (op === 'list') {
      return isOwner(auth, userId) && existingData?.ownerId === auth?.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'get') {
      const ok =
        isOwner(auth, userId) &&
        isValidId(userId) &&
        isValidId(projectId) &&
        existingData?.ownerId === auth?.uid &&
        hasValidParentUser(state, auth, userId);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'create') {
      const ok =
        isVerifiedUser(auth) &&
        isOwner(auth, userId) &&
        isValidId(userId) &&
        isValidId(projectId) &&
        isValidCloudProject(auth, incomingData) &&
        hasAllKeys(incomingData, [
          'ownerId',
          'name',
          'objective',
          'description',
          'brief',
          'category',
          'status',
          'createdAt',
          'updatedAt',
        ]) &&
        hasOnlyKeys(incomingData, [
          'ownerId',
          'name',
          'objective',
          'description',
          'brief',
          'category',
          'status',
          'createdAt',
          'updatedAt',
        ]) &&
        incomingData.status !== 'archived' &&
        timestampsEqual(incomingData.createdAt, requestTime) &&
        timestampsEqual(incomingData.updatedAt, requestTime) &&
        hasValidParentUser(state, auth, userId);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'update') {
      if (!existingData) return 'PERMISSION_DENIED';
      const standardEdit =
        incomingData.status !== 'archived' &&
        affectedKeysOnly(incomingData, existingData, [
          'name',
          'objective',
          'description',
          'brief',
          'category',
          'status',
          'updatedAt',
        ]);
      const archiveTransition =
        incomingData.status === 'archived' &&
        affectedKeysOnly(incomingData, existingData, ['status', 'updatedAt']);

      const ok =
        isValidCloudProject(auth, incomingData) &&
        isVerifiedUser(auth) &&
        isOwner(auth, userId) &&
        isValidId(userId) &&
        isValidId(projectId) &&
        existingData.status !== 'archived' &&
        incomingData.ownerId === existingData.ownerId &&
        timestampsEqual(incomingData.createdAt, existingData.createdAt) &&
        timestampsEqual(incomingData.updatedAt, requestTime) &&
        (standardEdit || archiveTransition) &&
        hasValidParentUser(state, auth, userId);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  // /users/{userId}/memories/{memoryId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'memories') {
    const [, userId, , memoryId] = segments;
    if (op === 'create') {
      const ok =
        isVerifiedUser(auth) &&
        isOwner(auth, userId) &&
        isValidId(userId) &&
        isValidId(memoryId) &&
        isValidCloudMemory(auth, incomingData) &&
        hasAllKeys(incomingData, ['ownerId', 'label', 'content', 'category', 'createdAt', 'updatedAt']) &&
        hasOnlyKeys(incomingData, ['ownerId', 'label', 'content', 'category', 'createdAt', 'updatedAt']) &&
        timestampsEqual(incomingData.createdAt, requestTime) &&
        timestampsEqual(incomingData.updatedAt, requestTime) &&
        hasValidParentUser(state, auth, userId);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  // Default-deny catch-all
  return 'PERMISSION_DENIED';
}

test('Firestore Rules Spec: Structural & Blueprint synchronicity across all 4 collections', () => {
  const rulesText = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
  const blueprint = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'firebase-blueprint.json'), 'utf8')
  ) as {
    entities: Record<string, { properties: Record<string, { maxLength?: number }> }>;
    firestore: Record<string, unknown>;
  };

  assert.match(rulesText, /rules_version\s*=\s*'2';/);
  assert.match(rulesText, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
  assert.match(rulesText, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rulesText, /existing\(\)\.status\s*!=\s*'archived'/);

  // Every blueprint path has a corresponding match block in firestore.rules
  assert.deepEqual(Object.keys(blueprint.firestore).sort(), [
    '/users/{userId}',
    '/users/{userId}/memories/{memoryId}',
    '/users/{userId}/private/{infoId}',
    '/users/{userId}/projects/{projectId}',
  ]);
  assert.match(rulesText, /match\s+\/users\/\{userId\}/);
  assert.match(rulesText, /match\s+\/private\/\{infoId\}/);
  assert.match(rulesText, /match\s+\/projects\/\{projectId\}/);
  assert.match(rulesText, /match\s+\/memories\/\{memoryId\}/);

  // Ensure no get() or exists() calls appear inside any allow list statement
  const allowListMatches = rulesText.match(/allow\s+list:[^;]+;/g) ?? [];
  assert.equal(allowListMatches.length, 4);
  for (const listBlock of allowListMatches) {
    assert.equal(/\b(get|exists)\s*\(/.test(listBlock), false, `Forbidden DB lookup in allow list: ${listBlock}`);
  }

  // Verify maxLength synchronicity between blueprint and rules
  assert.equal(blueprint.entities.CloudProject.properties.brief.maxLength, 2400);
  assert.match(rulesText, /data\.brief\.size\(\)\s*<=\s*2400/);
  assert.equal(blueprint.entities.CloudMemory.properties.content.maxLength, 1200);
  assert.match(rulesText, /data\.content\.size\(\)\s*<=\s*1200/);
});

test('Firestore Rules Spec: All 12 "Dirty Dozen" adversarial payloads return PERMISSION_DENIED while verified owner succeeds', () => {
  const verifiedVictim: MockAuthContext = {
    uid: 'uid_victim_01',
    token: { email: 'victim@example.com', email_verified: true },
  };
  const verifiedAttacker: MockAuthContext = {
    uid: 'uid_attacker_99',
    token: { email: 'attacker@example.com', email_verified: true },
  };
  const unverifiedUser: MockAuthContext = {
    uid: 'uid_unverified_02',
    token: { email: 'unverified@example.com', email_verified: false },
  };

  const state: MockFirestoreState = { docs: new Map() };

  // Positive control: Verified owner creates root profile, private PII, and active project
  const validProfile = {
    ownerId: 'uid_victim_01',
    displayName: 'Arenyx Builder',
    authProviders: ['google.com'],
    themePreference: 'dark',
    createdAt: SERVER_NOW,
    updatedAt: SERVER_NOW,
  };
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'create',
      docPath: '/users/uid_victim_01',
      incomingData: validProfile,
    }),
    'ALLOW'
  );
  state.docs.set('/users/uid_victim_01', validProfile);

  const validPii = {
    ownerId: 'uid_victim_01',
    email: 'victim@example.com',
    emailVerified: true,
    createdAt: SERVER_NOW,
    updatedAt: SERVER_NOW,
  };
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'create',
      docPath: '/users/uid_victim_01/private/account',
      incomingData: validPii,
    }),
    'ALLOW'
  );
  state.docs.set('/users/uid_victim_01/private/account', validPii);

  const validProject = {
    ownerId: 'uid_victim_01',
    name: 'Vaelor Core Security',
    objective: 'Zero-trust workspace isolation.',
    description: 'Security architecture',
    brief: 'Use strict schema validation.',
    category: 'software',
    status: 'active',
    createdAt: SERVER_NOW,
    updatedAt: SERVER_NOW,
  };
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'create',
      docPath: '/users/uid_victim_01/projects/proj_alpha',
      incomingData: validProject,
    }),
    'ALLOW'
  );
  state.docs.set('/users/uid_victim_01/projects/proj_alpha', validProject);

  // Dirty Dozen #1: Identity Spoofing on Profile Create
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedAttacker,
      op: 'create',
      docPath: '/users/uid_victim_01',
      incomingData: validProfile,
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #2: Unverified Email Write
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: unverifiedUser,
      op: 'create',
      docPath: '/users/uid_unverified_02',
      incomingData: { ...validProfile, ownerId: 'uid_unverified_02' },
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #3: Shadow Field Injection ("Ghost Field" isAdmin: true)
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedAttacker,
      op: 'create',
      docPath: '/users/uid_attacker_99',
      incomingData: {
        ...validProfile,
        ownerId: 'uid_attacker_99',
        isAdmin: true,
      },
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #4: PII Cross-User Scrape
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedAttacker,
      op: 'get',
      docPath: '/users/uid_victim_01/private/account',
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #5: Orphan Subcollection Write (before /users/uid_attacker_99 exists)
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedAttacker,
      op: 'create',
      docPath: '/users/uid_attacker_99/projects/proj_orphan',
      incomingData: { ...validProject, ownerId: 'uid_attacker_99' },
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #6: ID Poisoning Attack (invalid special characters / >128 chars)
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'create',
      docPath: `/users/uid_victim_01/projects/${'x'.repeat(200)}`,
      incomingData: validProject,
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #7: Denial-of-Wallet Oversized String (50,000-char brief > 2400 limit)
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'create',
      docPath: '/users/uid_victim_01/projects/proj_huge',
      incomingData: { ...validProject, brief: 'B'.repeat(50_000) },
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #8: Unbounded Array Injection (50 items in authProviders > max 5)
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'update',
      docPath: '/users/uid_victim_01',
      incomingData: {
        ...validProfile,
        authProviders: Array.from({ length: 50 }, (_, i) => `provider-${i}`),
      },
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #9: Client Timestamp Forgery (past timestamp != request.time)
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'create',
      docPath: '/users/uid_victim_01/memories/mem_forged_time',
      incomingData: {
        ownerId: 'uid_victim_01',
        label: 'Forged Note',
        content: 'Backdated timestamp attempt',
        category: 'note',
        createdAt: makeTimestamp(1_577_836_800_000),
        updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #10: Immutable Field Mutation (changing ownerId or createdAt on update)
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'update',
      docPath: '/users/uid_victim_01/projects/proj_alpha',
      incomingData: {
        ...validProject,
        createdAt: makeTimestamp(SERVER_NOW.epochMs - 99_000),
        updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #11: Terminal State Unlock (updating a project after status == 'archived')
  const archivedProject = {
    ...validProject,
    status: 'archived',
  };
  state.docs.set('/users/uid_victim_01/projects/proj_archived', archivedProject);
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'update',
      docPath: '/users/uid_victim_01/projects/proj_archived',
      incomingData: {
        ...archivedProject,
        status: 'active',
        updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // Dirty Dozen #12: Value Poisoning on Whitelisted Update Key (name set to boolean / empty string)
  assert.equal(
    evaluateFirestoreRule({
      state,
      auth: verifiedVictim,
      op: 'update',
      docPath: '/users/uid_victim_01/projects/proj_alpha',
      incomingData: {
        ...validProject,
        name: '' as unknown as string,
        updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );
});
