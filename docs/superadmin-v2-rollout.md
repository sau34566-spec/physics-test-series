# Super Admin V2: implementation and deployment gate

This branch replaces the conflicting operational Super Admin console with a platform-only console. Institute Admin operational screens remain in their existing files.

## Included

- Authenticated callable platform API requiring both an active admins profile and superAdminAccess authorization on every request.
- Pending institute creation, transactional unique code reservation, automatic code allocation, idempotent retries and mutation rate limits.
- Ten-step wizard, draft persistence, validation, preview, publish, activation, suspend, archive, restore and configuration-only clone.
- Separate private drafts, immutable versions, public configuration projection, atomic platform audit entries and rollback-as-new-version.
- Versioned login/instruction/exam template registry, type registry, configurable fields/instructions, security presets, plan labels and administrator count limits.
- Firebase Auth Institute Admin provisioning and separate profile assignment. Password setup uses the existing project's Firebase password-reset flow, explicitly requested from Institute Admin login.
- Institute lookup through a trusted callable and server-owned institute session mapping.
- Candidate custom field validation on the backend; safe DOM rendering and published configuration integration.
- CBT palette and review markers, section grouping when questions contain a subject/section, configurable security hooks and best-effort screen wake lock.
- Institute-scoped Storage rules and immutable branding asset upload.
- Platform statistics from backend counts, paged search, audit/history screens, responsive UI and error/retry states.

## This is NOT a production-completion claim

Do not deploy this branch to an ongoing examination before the gates below pass.

1. Firebase Functions, Rules Emulator, browser/mobile and live integration tests have NOT run in the assistant environment. Only JavaScript parsing, shared-schema tests and in-memory backend transaction tests ran.
2. Existing question delivery still exposes answer keys and scoring remains client-side. A trusted attempt/question/scoring backend is still required to satisfy the full master prompt's result-integrity requirement.
3. Anonymous identity plus an entered email is not verified student eligibility or a Student Code/OTP system. Candidate lock reads retain the existing broad authenticated get policy; move lock checking/claiming to the trusted attempt backend before claiming complete tenant confidentiality.
4. Legacy questionBank reads and examSettings remain migration exceptions. They must be inventoried and moved to tenant-scoped delivery. registerCandidate now requires an actual LIVE institute-owned exam; legacy-only exams must be migrated before deploying this branch.
5. Admin provisioning retry uses the same request ID. Partial Auth/profile failures preserve the reservation and do not grant admin access, but an administrative reconciliation/cancel UI is still required for existing-email collisions and abandoned reservations.
6. Template versions currently reference built-in renderer layouts. This is not an arbitrary template designer. Registry APIs validate built-in layout IDs; existing saved configurations retain their version.
7. Security preset selection is available in the wizard. Publishing/editing arbitrary preset versions, platform default template settings, detailed health probes, failed-operation dashboards and last-admin-activity tracking need completion.
8. Reports/performance availability is not a complete server entitlement framework. Reports can be hidden in Institute Admin, but reading result data inherently allows a client to reconstruct exports.
9. Search scans actual records in pages of 200, with explicit continuation; it is not a global full-text index.
10. No 500/1000 concurrent-student load test, automated backup/restore rehearsal, full configuration migration, multi-device browser test or independent security assessment has run.
11. Existing running attempts capture settings and do not subscribe to configuration changes. Suspension blocks new access and further protected reads; lifecycle behavior during final save requires an emulator/browser regression gate before production.
12. Review markers are a session UI state; durable restore of those markers and complete CBT section/timer rules remain part of the exam-engine work.

## Deployment order

1. Export/backup production Firestore and Authentication; use a separate staging Firebase project.
2. Inventory existing admins, institutes, codes, exam ownership and legacy questionBank usage. Resolve duplicate codes and normalize statuses. Existing institute administrators need instituteId as well as instituteIds for the new activation check.
3. Ensure the operator has admins/{uid} with role super_admin and status ACTIVE, plus superAdminAccess/{uid}.active true. These records cannot be created from a browser.
4. Install Functions dependencies: cd firebase/functions && npm install.
5. Run schema tests: node --test firebase/functions/test/schema.test.js from repository root.
6. Run in-memory callables: node tests/run-platform.cjs. Run existing smoke checks: node tests/smoke.mjs.
7. Install/run Firebase Emulator Suite and write/execute allow/deny tests against the actual rules. Test both portals in staging. Do not infer rule correctness from the in-memory callable harness.
8. Deploy Functions to staging, followed by Firestore/Storage rules and indexes, then static files. Verify the admin bootstrap before replacing the live console.
9. Verify login, create/save/reload/publish, provisioning, activation, code resolution, custom fields, actual exam start, answer save, final submission, result and feedback.
10. Verify suspension, disable during an active admin session, duplicate create, two-editor conflicts, invalid template, archive/restore, legacy migration and rollback.
11. Only after all gates pass should the branch be merged and the coordinated production deployment performed.

Example deployment command after selecting the correct staging project:
firebase deploy --only functions:platform,firestore,storage

Functions region is asia-south1. Client and server use the same region. No service-account private key is committed.

## Ownership and policies

admins, institutes, drafts, versions, template/settings registry and platformAudit are private control-plane data. Browser writes to privileged records are denied; callable functions use the Admin SDK after authorization.

publicInstitutes is an explicit projection. It omits institute code, administrative contact details, address, plan and admin limit; branding/support fields are intentionally student-visible.

Operational data remains institute-owned. Super Admin's normal role no longer grants operational exam/question/candidate/result reads or writes. Existing legacy collections are documented exceptions to be retired.

A new institute is PENDING. Creating an admin does not activate it. Publish first, then activate with at least one active Institute Admin. ARCHIVED can restore only to PENDING; reactivation revalidates configuration.

Configuration content uses schemaVersion 2. Published version and draft revision are distinct counters. Draft saves check revision; publish/rollback check both counters. Rollback creates a new version and audit event.

Plan labels are informational; maxAdmins is enforced during provisioning. Disabled accounts currently retain their allocated administrator slot.

Branding uploads are immutable PNG/JPEG/WebP objects under institutes/{id}/branding. Download URLs are intentionally usable as public logo references; they must never host private documents.

## Verification evidence from this session

- 15 shared configuration validation cases passed in V8.
- 14 callable authorization/transaction behavior cases passed against an in-memory Firestore mock.
- JavaScript syntax checked without executing browser imports.
- No deployment, Firebase emulator, installed dependency execution or browser verification was performed.
