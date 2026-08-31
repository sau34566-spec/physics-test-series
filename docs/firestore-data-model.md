# Firestore data model

The current migration keeps top-level collections while enforcing tenant scope
with `instituteId`. Every institute-owned document must contain a non-empty
`instituteId`. Every candidate-owned document must additionally contain the
anonymous Firebase Authentication UID in `ownerUid`.

## Identity documents

- `admins/{authUid}`: `role`, `status`, `instituteIds[]`, `examIds[]`,
  `batchIds[]`, and `permissions[]`.
- `candidates/{anonymousAuthUid}`: `ownerUid`, `instituteId`, candidate profile,
  and current attempt status.
- `candidateLocks/{sha256(institute|exam|email)}`: privacy-preserving,
  cross-device one-attempt lock. Super Admin can reset a lock after reviewing
  the corresponding candidate and attempt.

## Institute-scoped operational data

- `institutes/{instituteId}`
- `exams/{examId}`
- `batches/{batchId}`
- `questions/{questionId}`
- `portalConfigs/{scopeId}`
- `attempts/{attemptId}`
- `results/{attemptId}`
- `violations/{violationId}`
- `feedback/{feedbackId}`

## Global control data

- `globalSettings/{settingId}`
- `auditLogs/{logId}`
- `notifications/{notificationId}`
- `presence/{presenceId}`

## Migration constraints

`examSettings/current` and `questionBank/{questionId}` are legacy collections
used by the existing Candidate portal. They remain readable to authenticated
candidate sessions during migration. Because Firestore reads return complete
documents, `questionBank` cannot hide `correctAnswer` from candidates. Moving
question selection and scoring to a trusted backend is required before the
system can claim answer-key confidentiality.

The target tenant hierarchy remains:

`GLOBAL -> INSTITUTE -> EXAM -> BATCH -> ATTEMPT SNAPSHOT`

More specific published configuration will override broader configuration in
later migration steps.

## Runtime integrity additions

- `exams/{examId}.questionIds` is the authoritative Candidate question list.
- `attempts/{attemptId}.configurationSnapshot` freezes exam, security policy
  version and ordered question IDs when an attempt starts.
- `presence/{candidateUid}` stores a 20-second heartbeat; records older than
  60 seconds are treated as offline.
- `securityPolicies/{instituteId}` stores the published policy and
  `securityPolicyVersions/*` stores append-only history.
- Violations, feedback and results carry both `instituteId` and `examId`.

## Free frontend deployment boundary

This deployment intentionally uses Firebase Authentication, Firestore and
GitHub Pages only. Force-submit is a realtime cooperative command processed by
an open candidate browser. A closed/offline browser cannot be forced to submit
until it reconnects. Question documents and scoring logic also reach the
browser, so answer-key secrecy and tamper-proof scoring require a trusted
backend (Cloud Functions/Cloud Run) in a future paid deployment.
