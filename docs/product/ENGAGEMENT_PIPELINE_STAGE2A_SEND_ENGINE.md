# Engagement Pipeline — Stage 2A: Send Engine (Queue + Dry Run + Audit)

**Contract-only.** This document defines the Stage 2A send-engine contract. Implementation follows in later PRs.

---

## Goals

- **Queue primitives:** Represent “planned send” items (per recipient/step) without sending. Stage 2A defines the contract; no actual send in 2A.
- **Dry Run:** Plan what would be sent (recipients, template, identity, suppression outcome) and return a structured result. No side effects.
- **Audit log:** Append-only log of planned/planned-skip/send (when implemented) events for enrollments. Queryable by enrollment.
- **No send in 2A:** Stage 2A is contract + dry-run + audit shape only. Real send is Stage 2B+.

---

## Entities (contract; may not all exist in DB yet)

- **Send queue item (or equivalent):** One row per “planned send” (enrollment + recipient + step). States: Queued, DryRunPlanned, Skipped, WouldSend, FailedValidation, Paused.
- **Dry-run result:** In-memory or persisted summary of what a dry run would do (recipients, template id, identity id, suppression result per email).
- **Audit log entry:** Immutable record: enrollment id, event type (e.g. `dry_run_planned`, `skipped`, `would_send`), timestamp, actor/customer id, payload (e.g. step order, recipient id, reason).

---

## State machine

- **Queued** — Item is in the queue, not yet planned.
- **DryRunPlanned** — Dry run has been executed; plan stored; no send.
- **Skipped** — Recipient suppressed, invalid, or otherwise excluded at plan time.
- **WouldSend** — Dry run determined this recipient/step would be sent (when send is enabled).
- **FailedValidation** — Validation failed (e.g. missing template, identity, or invalid step).
- **Paused** — Enrollment or batch paused; no planning/send until resumed.

Transitions: Queued → DryRunPlanned (after dry run). DryRunPlanned → WouldSend | Skipped (per recipient). Any → FailedValidation on validation error. Any → Paused on pause.

---

## Invariants

- **Tenant safety:** All queue/audit/dry-run data scoped by tenant (`X-Customer-Id`). No cross-tenant reads or writes.
- **Suppression/opt-out at plan time:** Dry run must consider suppression list and opt-out; skipped recipients never reach WouldSend.
- **Identity selection:** Sender identity is determined by sequence/enrollment config; dry run output must include which identity would be used.
- **Immutable audit:** Audit log is append-only. No deletion or edit of audit entries.

---

## Endpoints (to be implemented)

Contract-only; clearly marked “to be implemented.”

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/enrollments/:id/dry-run` | Run dry run for enrollment; return planned items (no send). |
| GET | `/api/enrollments/:id/audit` | Return audit log entries for enrollment (paginated). |
| GET | `/api/enrollments/:id/queue` | Return queue/dry-run summary for enrollment (or combined with audit as decided in impl). |

All require `X-Customer-Id`. Authorization: tenant must own the enrollment.

---

## Output shapes (JSON examples)

### Dry run response (to be implemented)

```json
{
  "data": {
    "enrollmentId": "...",
    "plannedAt": "2026-02-27T12:00:00Z",
    "items": [
      {
        "recipientId": "...",
        "email": "user@example.com",
        "stepOrder": 1,
        "status": "WouldSend",
        "templateId": "...",
        "identityId": "...",
        "suppressionResult": "allowed"
      },
      {
        "recipientId": "...",
        "email": "opted@example.com",
        "stepOrder": 1,
        "status": "Skipped",
        "reason": "suppressed"
      }
    ]
  }
}
```

### Audit log response (to be implemented)

```json
{
  "data": {
    "enrollmentId": "...",
    "entries": [
      {
        "id": "...",
        "eventType": "dry_run_planned",
        "timestamp": "2026-02-27T12:00:00Z",
        "customerId": "...",
        "payload": { "stepOrder": 1, "recipientCount": 10 }
      }
    ]
  }
}
```

---

## Error taxonomy

- **Validation errors (4xx):** Missing or invalid enrollment id, sequence not active, missing template/identity. Client can fix and retry.
- **Transient (5xx):** DB or downstream failure. Client may retry with backoff.
- **Not found (404):** Enrollment or resource does not exist or not in tenant.

---

## Observability

- **Logging:** Dry-run invocations must log enrollment id, customer id, and outcome (item count, skipped count). No PII in logs beyond configurable redaction.
- **Metrics (future):** Count of dry runs, audit log size per enrollment. TBD in implementation.

---

## Definition of Done (Stage 2A)

- [ ] This contract doc is merged and linked from main engagement contract.
- [ ] Self-test script exists and passes, asserting presence of State machine, Endpoints, Invariants, Definition of Done.
- [ ] No backend send logic or queue consumer in 2A; only contract + dry-run/audit API shape (implementation in follow-up PRs).
