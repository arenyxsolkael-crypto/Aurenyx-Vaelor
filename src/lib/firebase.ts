import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { MissionRun, ProjectWorkspace, SavedMemory } from '../shared/types';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Persist sign-in session across reloads; gracefully fall back to in-memory persistence in strict sandboxes
void setPersistence(auth, browserLocalPersistence).catch(() =>
  setPersistence(auth, inMemoryPersistence).catch(() => {})
);

/**
 * Blueprint-synced validation bounds (synced verbatim with firebase-blueprint.json and firestore.rules)
 */
export const BLUEPRINT_CONSTRAINTS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  ID_MAX_LEN: 128,
  DISPLAY_NAME_MAX_LEN: 80,
  EMAIL_MAX_LEN: 254,
  AUTH_PROVIDERS_MAX_ITEMS: 5,
  PROJECT_NAME_MIN_LEN: 2,
  PROJECT_NAME_MAX_LEN: 80,
  PROJECT_OBJECTIVE_MIN_LEN: 4,
  PROJECT_OBJECTIVE_MAX_LEN: 600,
  PROJECT_DESC_MAX_LEN: 800,
  PROJECT_BRIEF_MAX_LEN: 2400,
  MEMORY_LABEL_MIN_LEN: 2,
  MEMORY_LABEL_MAX_LEN: 80,
  MEMORY_CONTENT_MIN_LEN: 2,
  MEMORY_CONTENT_MAX_LEN: 1200,
  MEMORY_REF_URL_MAX_LEN: 500,
  MISSION_TITLE_MIN_LEN: 2,
  MISSION_TITLE_MAX_LEN: 120,
  MISSION_OBJECTIVE_MIN_LEN: 4,
  MISSION_OBJECTIVE_MAX_LEN: 2000,
  MISSION_SUMMARY_MAX_LEN: 2400,
} as const;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
export async function testFirestoreConnectionOnce(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testFirestoreConnectionOnce();

function sanitizeFirestoreId(rawId: string): string {
  const cleaned = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, BLUEPRINT_CONSTRAINTS.ID_MAX_LEN);
  return cleaned || 'item_default';
}

async function resolveVerifiedCloudProjectId(user: User, rawProjectId?: string): Promise<string> {
  if (!rawProjectId || !rawProjectId.trim()) return '';
  const safeProjectId = sanitizeFirestoreId(rawProjectId);
  const projectPath = `users/${user.uid}/projects/${safeProjectId}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'projects', safeProjectId));
    return snap.exists() ? safeProjectId : '';
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, projectPath);
  }
}

/**
 * Syncs verified user profile & split PII email record to Firestore under /users/{uid} and /users/{uid}/private/account.
 * Skips silently for unverified Email/Password sign-ups because firestore.rules mandates email_verified == true.
 */
export async function syncVerifiedUserToFirestore(
  user: User,
  themePreference: 'dark' | 'light' = 'dark'
): Promise<void> {
  if (!user.emailVerified || !BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(user.uid)) {
    return;
  }

  const fallbackName = user.email ? user.email.split('@')[0] : 'Vaelor Member';
  const displayName = (user.displayName || fallbackName || 'Vaelor Member')
    .trim()
    .slice(0, BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX_LEN) || 'Vaelor Member';

  const authProviders = user.providerData
    .map((p) => (p.providerId || '').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, BLUEPRINT_CONSTRAINTS.AUTH_PROVIDERS_MAX_ITEMS);

  const safeTheme: 'dark' | 'light' = themePreference === 'light' ? 'light' : 'dark';
  const userDocPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let exists = false;
  try {
    const snap = await getDoc(userRef);
    exists = snap.exists();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userDocPath);
  }

  try {
    if (!exists) {
      await setDoc(userRef, {
        ownerId: user.uid,
        displayName,
        authProviders,
        themePreference: safeTheme,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        authProviders,
        themePreference: safeTheme,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(
      err,
      exists ? OperationType.UPDATE : OperationType.CREATE,
      userDocPath
    );
  }

  if (user.email && user.email.trim().length >= 3) {
    const cleanEmail = user.email.trim().slice(0, BLUEPRINT_CONSTRAINTS.EMAIL_MAX_LEN);
    const privatePath = `users/${user.uid}/private/account`;
    const privateRef = doc(db, 'users', user.uid, 'private', 'account');

    let privExists = false;
    try {
      const privSnap = await getDoc(privateRef);
      privExists = privSnap.exists();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, privatePath);
    }

    try {
      if (!privExists) {
        await setDoc(privateRef, {
          ownerId: user.uid,
          email: cleanEmail,
          emailVerified: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(privateRef, {
          email: cleanEmail,
          emailVerified: true,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(
        err,
        privExists ? OperationType.UPDATE : OperationType.CREATE,
        privatePath
      );
    }
  }
}

export async function syncCloudProjectToFirestore(
  user: User,
  project: ProjectWorkspace
): Promise<void> {
  if (!user.emailVerified || !BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(user.uid)) {
    return;
  }

  const projectId = sanitizeFirestoreId(project.id);
  const path = `users/${user.uid}/projects/${projectId}`;
  const ref = doc(db, 'users', user.uid, 'projects', projectId);

  const name = project.name.trim().slice(0, BLUEPRINT_CONSTRAINTS.PROJECT_NAME_MAX_LEN);
  const objective = project.objective.trim().slice(0, BLUEPRINT_CONSTRAINTS.PROJECT_OBJECTIVE_MAX_LEN);
  if (
    name.length < BLUEPRINT_CONSTRAINTS.PROJECT_NAME_MIN_LEN ||
    objective.length < BLUEPRINT_CONSTRAINTS.PROJECT_OBJECTIVE_MIN_LEN
  ) {
    return;
  }

  const description = (project.description || '').trim().slice(0, BLUEPRINT_CONSTRAINTS.PROJECT_DESC_MAX_LEN);
  const brief = (project.brief || '').trim().slice(0, BLUEPRINT_CONSTRAINTS.PROJECT_BRIEF_MAX_LEN);
  const category = project.category;
  const status = project.status;

  let existingStatus: string | null = null;
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      existingStatus = String(snap.data()?.status || 'active');
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  // Respect terminal state lock in firestore.rules
  if (existingStatus === 'archived') {
    return;
  }

  try {
    if (!existingStatus) {
      await setDoc(ref, {
        ownerId: user.uid,
        name,
        objective,
        description,
        brief,
        category,
        status: status === 'archived' ? 'active' : status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (status === 'archived') {
      await updateDoc(ref, {
        status: 'archived',
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name,
        objective,
        description,
        brief,
        category,
        status,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(
      err,
      existingStatus ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteCloudProjectFromFirestore(
  user: User,
  projectIdRaw: string
): Promise<void> {
  if (!user.emailVerified || !BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(user.uid)) {
    return;
  }
  const projectId = sanitizeFirestoreId(projectIdRaw);
  const path = `users/${user.uid}/projects/${projectId}`;
  const ref = doc(db, 'users', user.uid, 'projects', projectId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncCloudMemoryToFirestore(
  user: User,
  memory: SavedMemory
): Promise<void> {
  if (!user.emailVerified || !BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(user.uid)) {
    return;
  }
  const memoryId = sanitizeFirestoreId(memory.id);
  const path = `users/${user.uid}/memories/${memoryId}`;
  const ref = doc(db, 'users', user.uid, 'memories', memoryId);

  const label = memory.label.trim().slice(0, BLUEPRINT_CONSTRAINTS.MEMORY_LABEL_MAX_LEN);
  const content = memory.content.trim().slice(0, BLUEPRINT_CONSTRAINTS.MEMORY_CONTENT_MAX_LEN);
  if (
    label.length < BLUEPRINT_CONSTRAINTS.MEMORY_LABEL_MIN_LEN ||
    content.length < BLUEPRINT_CONSTRAINTS.MEMORY_CONTENT_MIN_LEN
  ) {
    return;
  }

  const memoryType = memory.memoryType ?? 'note';
  const referenceUrl = (memory.referenceUrl || '')
    .trim()
    .slice(0, BLUEPRINT_CONSTRAINTS.MEMORY_REF_URL_MAX_LEN);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  try {
    if (!exists) {
      const projectId = await resolveVerifiedCloudProjectId(user, memory.projectId);
      await setDoc(ref, {
        ownerId: user.uid,
        label,
        content,
        category: memory.category,
        memoryType,
        projectId,
        referenceUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        label,
        content,
        category: memory.category,
        memoryType,
        referenceUrl,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, exists ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCloudMemoryFromFirestore(
  user: User,
  memoryIdRaw: string
): Promise<void> {
  if (!user.emailVerified || !BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(user.uid)) {
    return;
  }
  const memoryId = sanitizeFirestoreId(memoryIdRaw);
  const path = `users/${user.uid}/memories/${memoryId}`;
  const ref = doc(db, 'users', user.uid, 'memories', memoryId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncCloudMissionToFirestore(
  user: User,
  mission: MissionRun
): Promise<void> {
  if (!user.emailVerified || !BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(user.uid)) {
    return;
  }
  const missionId = sanitizeFirestoreId(mission.id);
  const path = `users/${user.uid}/missions/${missionId}`;
  const ref = doc(db, 'users', user.uid, 'missions', missionId);

  const title = mission.title.trim().slice(0, BLUEPRINT_CONSTRAINTS.MISSION_TITLE_MAX_LEN);
  const objective = mission.objective.trim().slice(0, BLUEPRINT_CONSTRAINTS.MISSION_OBJECTIVE_MAX_LEN);
  if (
    title.length < BLUEPRINT_CONSTRAINTS.MISSION_TITLE_MIN_LEN ||
    objective.length < BLUEPRINT_CONSTRAINTS.MISSION_OBJECTIVE_MIN_LEN
  ) {
    return;
  }

  const stepsUsed = Math.max(0, Math.min(20, Math.round(mission.bounds.stepsUsed)));
  const maxSteps = Math.max(1, Math.min(20, Math.round(mission.bounds.maxSteps)));
  const modelCallsUsed = Math.max(0, Math.min(20, Math.round(mission.bounds.modelCallsUsed)));
  const summary = (mission.finalSummary || mission.sentinelReview?.summary || '')
    .trim()
    .slice(0, BLUEPRINT_CONSTRAINTS.MISSION_SUMMARY_MAX_LEN);

  let existingStatus: string | null = null;
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      existingStatus = String(snap.data()?.status || 'planned');
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (existingStatus === 'completed' || existingStatus === 'cancelled') {
    return;
  }

  try {
    if (!existingStatus) {
      const projectId = await resolveVerifiedCloudProjectId(user, mission.projectId);
      const isTerminal = mission.status === 'completed' || mission.status === 'cancelled';
      await setDoc(ref, {
        ownerId: user.uid,
        title,
        objective,
        projectId,
        status: isTerminal ? 'running' : mission.status,
        stepsUsed,
        maxSteps,
        modelCallsUsed,
        summary,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (isTerminal) {
        await updateDoc(ref, {
          status: mission.status,
          stepsUsed,
          modelCallsUsed,
          summary,
          updatedAt: serverTimestamp(),
        });
      }
    } else if (mission.status === 'completed' || mission.status === 'cancelled') {
      await updateDoc(ref, {
        status: mission.status,
        stepsUsed,
        modelCallsUsed,
        summary,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        title,
        status: mission.status,
        stepsUsed,
        modelCallsUsed,
        summary,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(
      err,
      existingStatus ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteCloudMissionFromFirestore(
  user: User,
  missionIdRaw: string
): Promise<void> {
  if (!user.emailVerified || !BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(user.uid)) {
    return;
  }
  const missionId = sanitizeFirestoreId(missionIdRaw);
  const path = `users/${user.uid}/missions/${missionId}`;
  const ref = doc(db, 'users', user.uid, 'missions', missionId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Deletes all Firestore subcollection records before removing the parent /users/{uid} profile
 * during account cancellation.
 */
export async function deleteAllUserFirestoreData(user: User): Promise<void> {
  if (!user.emailVerified || !BLUEPRINT_CONSTRAINTS.ID_PATTERN.test(user.uid)) {
    return;
  }

  const missionsPath = `users/${user.uid}/missions`;
  try {
    const msnQuery = query(
      collection(db, 'users', user.uid, 'missions'),
      where('ownerId', '==', user.uid)
    );
    const msnSnaps = await getDocs(msnQuery);
    for (const d of msnSnaps.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, missionsPath);
  }

  const memoriesPath = `users/${user.uid}/memories`;
  try {
    const memQuery = query(
      collection(db, 'users', user.uid, 'memories'),
      where('ownerId', '==', user.uid)
    );
    const memSnaps = await getDocs(memQuery);
    for (const d of memSnaps.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, memoriesPath);
  }

  const projectsPath = `users/${user.uid}/projects`;
  try {
    const projQuery = query(
      collection(db, 'users', user.uid, 'projects'),
      where('ownerId', '==', user.uid)
    );
    const projSnaps = await getDocs(projQuery);
    for (const d of projSnaps.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, projectsPath);
  }

  const privatePath = `users/${user.uid}/private/account`;
  try {
    const privRef = doc(db, 'users', user.uid, 'private', 'account');
    const privSnap = await getDoc(privRef);
    if (privSnap.exists()) {
      await deleteDoc(privRef);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, privatePath);
  }

  const userPath = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await deleteDoc(userRef);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, userPath);
  }
}
