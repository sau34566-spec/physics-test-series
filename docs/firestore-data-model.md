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
