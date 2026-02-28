# Engagement Pipeline — Stage 2B: Live Sending

**Contract-only.** This document defines the Stage 2B live-sending contract (kill-switch, canary, throttles, hours, suppression, idempotency). Implementation follows in later PRs.

---

## Goals

- **First live send safely:** Enable real email sends from the enrollment/queue pipeline with strict controls.
- **Kill-switch:** Global env flag (default off) to block all sends.
- **Canary:** Limit live sending to one customer and one identity until validated.
- **Throttles:** Per-identity rate limits (per minute/hour/day) and backoff.
- **Working hours:** Timezone-aware send windows; skip outside window.
- **Suppression:** Enforce emails/domains at send-time; never send to suppressed.
- **Idempotency:** Same enrollment + recipient + step never sends twice.
- **Audit:** Append-only events for every send/skip/failure.

---

## Kill-switch

- **Env flag:** `ODCRM_LIVE_SEND_ENABLED` (or equivalent). **Default: off (false/0/unset).**
- **Behavior when off:** All code paths that would perform a live send must check the flag and **block** the send. Dry-run and audit read remain allowed.
- **Testable:** Implementation must gate the actual provider/send call behind this flag; no send occurs when flag is off.

---

## Canary mode

- **Env flag:** `ODCRM_LIVE_SEND_CANARY` (or equivalent). When enabled:
  - **Customer allow-list:** Only one customer ID (e.g. from env) may receive live sends; all others are blocked at send-time.
  - **Identity allow-list:** Only one sender identity ID may be used for live sends; all other identities are blocked.
- **Purpose:** Validate live pipeline with minimal blast radius before full rollout.
- **Testable:** With canary on, only the configured customer + identity can send; others must be rejected or skipped.

---

## Identity selection rules

- **Per customer:** Sender identity is chosen per customer (and sequence). Rules (to be implemented):
  - Sequence has a designated `senderIdentityId`; that identity must belong to the same customer and be active.
  - If no active identity for the customer, no send (treat as validation failure or skip).
- **No cross-tenant identity:** Identity must always belong to the tenant (customer) that owns the enrollment.

---

## Rate limits (per identity)

- **Limits:** Per sender identity, enforce:
  - **Per minute:** Max N emails per minute (configurable; e.g. 5–10 in canary).
  - **Per hour:** Max M emails per hour (e.g. 50–100).
  - **Per day:** Max P emails per day (e.g. 150–500).
- **Backoff:** When a limit is hit, the worker/sender must **back off** (e.g. sleep or defer to next window) and not send until the window resets or the next period allows.
- **Testable:** Sending must not exceed the configured limits for the identity within the given time window.

---

## Working hours and timezone

- **Send window:** Each identity (or customer) may have a send window: start hour and end hour in a given timezone (e.g. 9–17 Europe/London).
- **Skip behavior:** If current time is outside the window, **skip** the send and defer (e.g. re-queue for next window or next run). No send outside the window.
- **Testable:** Implementation must not send when current time in the configured timezone falls outside the window.

---

## Suppression enforcement (at send-time)

- **Enforcement:** Before every live send, check the recipient email (and domain) against the tenant’s suppression list (emails + domains).
- **If suppressed:** Do **not** send; record a skip in audit; do not count toward rate limits as a “sent.”
- **Source of truth:** Same suppression data as dry-run (customer-scoped); must be re-checked at send-time to avoid race conditions.
- **Testable:** A recipient on the suppression list must never receive a live send.

---

## Idempotency

- **Rule:** The same (enrollmentId, recipientId, stepOrder) must **never** result in more than one actual send.
- **Mechanism:** Use a durable idempotency key (e.g. stored in DB or provider) and short-circuit if a send for that key already succeeded.
- **Testable:** Re-running or retrying the same enrollment/recipient/step must not produce a second send; audit should show at most one “sent” per (enrollment, recipient, step).

---

## Required audit events (append-only)

- **Events and fields (minimum):**
  - **send_attempted:** enrollmentId, recipientId, stepOrder, identityId, timestamp, customerId, outcome (sent | skipped | failed).
  - **send_skipped:** reason (suppression | outside_window | rate_limited | canary_blocked | validation_failed), enrollmentId, recipientId, stepOrder, timestamp, customerId.
  - **send_failed:** enrollmentId, recipientId, stepOrder, errorType (validation | transient | provider), timestamp, customerId; no secrets in payload.
- **Append-only:** No deletion or edit of audit entries. Read-only query by enrollment (and optionally by customer/time).

---

## Error taxonomy

- **Validation (4xx):** Invalid enrollment, missing template/identity, invalid step, recipient not in enrollment. Client can fix and retry; do not send.
- **Transient (5xx):** DB or downstream failure, timeout. Retry with backoff; do not double-send (idempotency).
- **Provider:** Email provider (e.g. Graph API) error. Classify as retriable or permanent; audit and backoff accordingly.
- **Testable:** Errors must be categorized and audited without leaking secrets.

---

## Definition of Done (Stage 2B MVP “first live send safely”)

- [ ] Kill-switch env flag is implemented and default is off; no send when off.
- [ ] Canary mode restricts live send to one customer + one identity when enabled.
- [ ] Identity selection uses sequence/customer identity; no cross-tenant identity.
- [ ] Rate limits (per identity per minute/hour/day) and backoff are enforced.
- [ ] Working hours / timezone window are enforced; no send outside window.
- [ ] Suppression is enforced at send-time; suppressed recipients never receive mail.
- [ ] Idempotency ensures (enrollmentId, recipientId, stepOrder) sends at most once.
- [ ] Audit events (send_attempted, send_skipped, send_failed) are written with required fields; append-only.
- [ ] Error taxonomy is applied; no secrets in logs or audit.
- [ ] This contract doc is linked from the main engagement contract and the self-test script passes.
