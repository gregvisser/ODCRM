# Flow 05 — Sequence activate and enroll

```mermaid
sequenceDiagram
  autonumber
  participant User as User
  participant FE as Frontend Screen<br/>marketing.sequences (SequencesTab) + marketing.people (PeopleTab)
  participant API as API Route Group<br/>/api/sequences (+ /api/schedules, /api/inbox)
  participant DB as DB Models<br/>EmailSequence + EmailSequenceStep + SequenceEnrollment + Contact + EmailIdentity + EmailEvent + EmailMessageMetadata
  participant W as Worker<br/>replyDetection.ts (startReplyDetectionWorker) *(reply processing)*
  participant EXT as External<br/>Microsoft Graph / Outlook

  User->>FE: Creates/edits a sequence (steps, templates) and activates it
  FE->>FE: Validate required fields (sequence name, at least 1 step)
  FE->>API: POST/PUT /api/sequences (whitelisted fields only)
  API->>API: Validate input (schema)
  API->>API: Enforce whitelist writes
  API->>DB: Write EmailSequence
  API->>DB: Write EmailSequenceStep (step definitions)
  API-->>FE: 200 OK
  FE->>FE: Rehydrate after save (refetch sequences)

  User->>FE: Enroll contacts into the sequence
  FE->>API: POST/PUT /api/sequences (enrollment action; whitelisted)
  API->>API: Validate + whitelist writes
  API->>DB: Write SequenceEnrollment (links Contact to EmailSequence)
  API-->>FE: 200 OK
  FE->>FE: Rehydrate after save (refetch enrollments)

  Note over FE,API: Scheduling and inbox views are read/write adjacent controls
  FE->>API: GET/PUT /api/schedules (view/adjust send windows where applicable)
  FE->>API: GET /api/inbox (view activity and replies)

  Note over W,EXT: Reply detection runs every 5 minutes if ENABLE_REPLY_DETECTOR=true
  W->>EXT: Fetch recent inbound messages (Microsoft Graph / Outlook)
  W->>DB: Store EmailMessageMetadata (inbound)
  W->>DB: Record EmailEvent(type=replied) when matched
```

## Inputs
- Sequence definition (steps)
- Contact selection for enrollment
- Connected sender identity (when sending)

## Outputs
- **`EmailSequence`**, **`EmailSequenceStep`**
- **`SequenceEnrollment`** rows
- Reply telemetry (when applicable): **`EmailMessageMetadata`**, **`EmailEvent`**

## Non-negotiable rules
- **Whitelist writes only** for sequence definitions and enrollments.
- **Rehydrate after save**: refresh sequence state from API/DB after updates.
- **Suppression enforcement** (send-time) must apply when sequences result in outbound sends.
- **No destructive overwrites**: partial updates must not wipe unrelated fields.

## Failure cases
- Validation errors (no steps, bad content) → reject save.
- Worker disabled (`ENABLE_REPLY_DETECTOR!=true`) → replies may not be detected automatically.
- Outlook access failure → inbound fetch fails; surface operational errors in logs/diagnostics.
