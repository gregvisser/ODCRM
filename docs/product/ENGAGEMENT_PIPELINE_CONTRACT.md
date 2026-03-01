# Engagement Pipeline Contract

**Client mode is not enabled in production yet; this contract is agency-mode first.**

---

## Purpose

Single source of truth for the engagement pipeline: Templates → Sequences → Enrollments → Queue/Send. Ensures tenant isolation, audit expectations, and a clear path from current API surface to target enrollments/queue endpoints.

---

## Definitions

- **Template** — Reusable email body/subject (and optional AI variants). Scoped to a customer. States: draft, published, archived.
- **Sequence** — Ordered list of steps (subject + body templates, delays). Used to enroll contacts; each step can send an email. Scoped to a customer.
- **Enrollment** — A contact committed to a sequence; progresses through steps. Has state (e.g. queued, sending, sent, failed, paused, stopped).
- **Queue / Send Queue** — Mechanism that consumes queued enrollments and performs send (e.g. worker reading enrollments, applying templates, calling send API). Not yet exposed as a dedicated API.
- **Identity** — Sender email identity (Outlook/Graph). Used by sequences and campaigns to send mail. Scoped to customer.
- **Suppression** — List of emails/domains that must not receive outreach. Enforced before send.

---

## Invariants (DB as truth)

- **Tenant isolation:** All pipeline data is scoped by tenant. Tenant is provided via `X-Customer-Id` (no silent defaults). Server enforces fixed tenant in client mode when enabled; agency mode uses request header/query only.
- **No silent tenant defaults:** Never infer or default tenant from anything other than explicit request (header/query) or, in client mode, the configured fixed customer id.
- **Immutable audit:** Key actions (enrollment created, step sent, campaign started/paused) are expected to be auditable (e.g. timestamps, actor, customer id). Exact schema TBD in rollout; no deletion of audit trail.

---

## State machine

- **Template states:** `draft` | `published` | `archived`. Draft can be edited; published is used for sends; archived is read-only hidden.
- **Sequence states:** `draft` | `active` | `paused` | `archived`. Only active/paused sequences accept enrollments and send. Draft is editable; archived is read-only.
- **Enrollment states:** `queued` | `sending` | `sent` | `failed` | `paused` | `stopped`. Queued/sending progress through steps; sent/failed/stopped are terminal for that step or sequence.

---

## Minimal API surface (today vs target)

### Today (existing endpoints)

- **Templates:** `GET /api/templates`, `POST /api/templates`, `PATCH /api/templates/:id`, `DELETE /api/templates/:id`, `POST /api/templates/preview`, `POST /api/templates/ai/*`.
- **Sequences:** `GET /api/sequences`, `GET /api/sequences/:id`, `POST /api/sequences`, `PUT /api/sequences/:id`, `DELETE /api/sequences/:id`, `POST /api/sequences/:id/steps`, `PUT /api/sequences/:id/steps/:stepId`, `DELETE /api/sequences/:id/steps/:stepId`, `POST /api/sequences/:id/enroll`, `POST /api/sequences/:id/dry-run`. **Stage 1A shipped:** `GET /api/sequences/:sequenceId/enrollments`, `POST /api/sequences/:sequenceId/enrollments`, `GET /api/enrollments/:enrollmentId` (enrollment batch + recipients; persistence only, no sending).
- **Campaigns:** `POST /api/campaigns`, `GET /api/campaigns`, `GET /api/campaigns/:id`, `PATCH /api/campaigns/:id`, `POST /api/campaigns/:id/start`, `POST /api/campaigns/:id/pause`, `POST /api/campaigns/:id/complete`, `DELETE /api/campaigns/:id`, plus templates/prospects sub-routes.
- **Suppression:** `POST /api/suppression/check`, `GET /api/suppression`, `POST /api/suppression`, etc.
- **Outlook/identities:** `GET/POST /api/outlook/identities`, etc.

Enrollments today are created only via `POST /api/sequences/:id/enroll`; there is no dedicated list/get enrollment or queue API.

### Target (TODOs)

- **Enrollments:** Stage 1A + 1B shipped. List/create batch enrollments + recipients, get by id; pause/resume; `GET /api/enrollments` scoped by customer (optional `?sequenceId=`, `?status=`).
- **Queue:** Observability and/or control endpoints for the send queue (e.g. queue depth, retries). (Future PR.)

---

## Rollout plan

- **Stage 0:** Contract doc + `npm run test:engagement-contract` (done).
- **Stage 1A (shipped):** Enrollments schema (Enrollment, EnrollmentRecipient) + endpoints: `GET/POST /api/sequences/:sequenceId/enrollments`, `GET /api/enrollments/:enrollmentId`. Persistence only; no sending.
- **Stage 1B (shipped):** Pause/resume + list by customer: `POST /api/enrollments/:enrollmentId/pause`, `POST /api/enrollments/:enrollmentId/resume`, `GET /api/enrollments` (tenant-scoped, optional `?sequenceId=`, `?status=`). No sending/queue logic.
- **Stage 1B queue persist (shipped):** Send queue persisted in DB (`OutboundSendQueueItem`); `GET /api/enrollments/:enrollmentId/queue`, `POST /api/enrollments/:enrollmentId/queue/refresh` (idempotent rebuild), enqueue step 0 on enrollment create; worker reads queue from DB with `ENABLE_SEND_QUEUE_WORKER` / `ENABLE_SEND_QUEUE_SENDING` (default off / dry-run).
- **Stage 1D (shipped):** When `ENABLE_SEND_QUEUE_SENDING` is not true, worker performs dry-run and leaves items **QUEUED** (non-destructive); it does not set status=FAILED, so the queue is not poisoned by dry-run.
- **Stage 2:** Queue worker + observability (send queue consumer, metrics, alerts). Future PR.
- **Stage 2A (contract):** Queue + Dry Run + Audit log contract only; no send. See [Stage 2A Send Engine contract](./ENGAGEMENT_PIPELINE_STAGE2A_SEND_ENGINE.md).
- **Stage 2B (contract):** Live sending (kill-switch, canary, throttles, hours, suppression, idempotency). See [Stage 2B Live Sending contract](./ENGAGEMENT_PIPELINE_STAGE2B_LIVE_SENDING.md).
