# AURENYX VAELOR v0.4 — Firestore & API Security Specification (`security_spec.md`)

## 1. Master Source of Truth & Data Invariants

1. **Root Ownership Anchor (`/users/{userId}`)**:
   - A `UserProfile` document at `/users/{userId}` can only be read, created, updated, or deleted when `request.auth != null` and `request.auth.uid == userId`, with `ownerId == request.auth.uid` and `isValidId(userId)`.
   - All write operations across all collections strictly require `request.auth.token.email_verified == true`.
2. **PII Split Isolation (`/users/{userId}/private/{infoId}`)**:
   - Personally Identifiable Information (`email`) is strictly isolated from `/users/{userId}` inside `/users/{userId}/private/account` (`infoId == 'account'`).
   - Creating or updating `/users/{userId}/private/account` requires the Master Gate: `/users/{userId}` must exist and `get(/databases/$(database)/documents/users/$(userId)).data.ownerId == request.auth.uid`.
   - Blanket `isSignedIn()` reads are forbidden; only `isOwner(userId)` may read `/users/{userId}` or `/users/{userId}/private/{infoId}`.
3. **Subcollection Master Gate & Relational Project Consistency (`/projects/{projectId}`, `/memories/{memoryId}`, `/missions/{missionId}`)**:
   - Subcollection items cannot exist as orphans: single-document reads/writes verify `exists(/databases/$(database)/documents/users/$(userId))` and `get(/databases/$(database)/documents/users/$(userId)).data.ownerId == request.auth.uid`.
   - When `projectId != ''` on `CloudMemory` or `CloudMission` creation, rules verify `exists(/databases/$(database)/documents/users/$(userId)/projects/$(incoming().projectId))` and owner match to prevent orphaned project references.
   - `allow list` enforces `isOwner(userId) && resource.data.ownerId == request.auth.uid` without `get()` or `exists()` calls (preventing O(N) read amplification while rejecting cross-user queries).
4. **Immutability, Strict Keys & Temporal Integrity**:
   - `ownerId`, `projectId` (where present), and `createdAt` are immutable across all updates.
   - Timestamps must equal `request.time` (`createdAt == request.time` on `create`; `updatedAt == request.time` on `update`).
   - Every `create` checks `keys().hasAll(...) && keys().hasOnly(...)`; every `update` begins with `isValid[Entity](incoming())` and restricts mutated keys with `incoming().diff(existing()).affectedKeys().hasOnly(...)`.
5. **Terminal State Locking (`CloudProject` & `CloudMission`)**:
   - Once a `CloudProject` reaches `status == 'archived'`, all further `update` operations are rejected (`existing().status != 'archived'`).
   - Once a `CloudMission` reaches `status == 'completed'` or `status == 'cancelled'`, all further `update` operations are rejected (`existing().status != 'completed' && existing().status != 'cancelled'`).

---

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return `PERMISSION_DENIED`)

1. **Identity Spoofing on Profile Create**: Authenticated `uid_attacker` writes `/users/uid_victim` with `{ "ownerId": "uid_victim", ... }` -> Denied by `isOwner(userId)` and `incoming().ownerId == request.auth.uid`.
2. **Unverified Email Write**: Authenticated `uid_1` with `email_verified: false` attempts `create` on `/users/uid_1` -> Denied by `isVerifiedUser()`.
3. **Shadow Field Injection ("Ghost Field")**: `uid_1` creates `/users/uid_1` with extra `{ "isAdmin": true }` -> Denied by `incoming().keys().hasOnly(...)`.
4. **PII Cross-User Scrape**: Authenticated `uid_attacker` attempts `get` on `/users/uid_victim/private/account` -> Denied by `isOwner(userId)`.
5. **Orphan Subcollection Write**: `uid_1` creates `/users/uid_1/projects/proj_1` or `/users/uid_1/missions/msn_1` before `/users/uid_1` exists -> Denied by Master Gate `hasValidParentUser(userId)`.
6. **ID Poisoning Attack**: `uid_1` creates `/users/uid_1/projects/` with a 200-char or special-char ID `proj$bad/../id` -> Denied by `isValidId(projectId)` (`size <= 128` and `^[a-zA-Z0-9_\-]+$`).
7. **Denial-of-Wallet Oversized String**: `uid_1` creates `CloudProject` with a 50,000-char `brief` -> Denied by `data.brief.size() <= 2400`.
8. **Unbounded Array Injection**: `uid_1` updates `UserProfile.authProviders` with 50 items or non-string element `[123]` -> Denied by `data.authProviders.size() <= 5` and index-0 string check.
9. **Client Timestamp Forgery**: `uid_1` creates `CloudMemory` with `createdAt: Timestamp(2020, 1, 1)` -> Denied by `incoming().createdAt == request.time`.
10. **Immutable Field Mutation**: `uid_1` updates `CloudProject`, `CloudMemory`, or `CloudMission` changing `ownerId`, `projectId`, or `createdAt` -> Denied by immutability checks.
11. **Terminal State Unlock**: `uid_1` attempts to update an `'archived'` `CloudProject` or `'completed'`/`'cancelled'` `CloudMission` -> Denied by terminal state lock.
12. **Value Poisoning on Whitelisted Update Key**: `uid_1` updates `CloudProject.name` to `""` or `CloudMission.stepsUsed` to `999` -> Denied because `isValid[Entity](incoming())` wraps the entire `allow update` expression.

---

## 3. Red Team Audit Matrix

| Collection | Identity Spoofing | Shadow Update | Email Spoofing (`email_verified == false`) | PII Blanket Leak | Query Trust (`allow list`) | Terminal State / Value Poisoning |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/users/{userId}` | Blocked (`isOwner` + `ownerId == auth.uid`) | Blocked (`hasOnly`) | Blocked (`isVerifiedUser`) | Non-PII + Owner-only `get` (`list` disabled) | `list` disabled | Blocked (`isValidUserProfile` wraps `update`) |
| `/users/{userId}/private/{infoId}` | Blocked (`isOwner` + Master Gate) | Blocked (`hasOnly`) | Blocked (`isVerifiedUser`) | Blocked (`isOwner` only, `infoId == 'account'`) | `list` disabled | Blocked (`isValidUserPrivateInfo` wraps `update`) |
| `/users/{userId}/projects/{projectId}` | Blocked (`isOwner` + Master Gate) | Blocked (`hasOnly`) | Blocked (`isVerifiedUser`) | Owner-only | Enforced (`isOwner && resource.data.ownerId == auth.uid`, zero `get()`) | Locked when `existing().status == 'archived'`; `isValidCloudProject` wraps `update` |
| `/users/{userId}/memories/{memoryId}` | Blocked (`isOwner` + Master Gate + Project Ownership Check) | Blocked (`hasOnly`) | Blocked (`isVerifiedUser`) | Owner-only | Enforced (`isOwner && resource.data.ownerId == auth.uid`, zero `get()`) | Immutable `projectId`; `isValidCloudMemory` wraps `update` |
| `/users/{userId}/missions/{missionId}` | Blocked (`isOwner` + Master Gate + Project Ownership Check) | Blocked (`hasOnly`) | Blocked (`isVerifiedUser`) | Owner-only | Enforced (`isOwner && resource.data.ownerId == auth.uid`, zero `get()`) | Locked when `completed` or `cancelled`; `isValidCloudMission` wraps `update` |
