# ODCRM Outreach Execution Audit

Date: 2026-03-14
Audit base SHA: `1c268db4fc9940bd8daff13a917e1225271db74b`

## Executive Conclusion

ODCRM is trustworthy enough to execute real outreach today, provided operators can navigate a UI that still exposes too much engine detail. The send protections are materially real. The main risk is operator confusion and sheet-backed lead truth fragility, not an obvious current send-policy bypass.

## Full Send-Path Audit

### Primary guarded path

Truth path:
- `server/src/workers/sendQueueWorker.ts`
- `processOne(...)`

What it enforces:
- suppression check
- reply-stop
- invalid-recipient hard-bounce suppression
- identity daily cap via `clampDailySendLimit(...)`
- unsubscribe footer enforcement
- customer scoping via queue item customer + tenant-scoped lookups

Assessment:
- solid

### Admin live tick

Truth path:
- `server/src/routes/sendWorker.ts`
- `POST /api/send-worker/live-tick`

Current contract:
- requires admin secret
- requires tenant via `requireCustomerId`
- delegates each item to `processOne(...)`

Assessment:
- solid

Residual risk:
- still an advanced/admin surface that leaks into operator understanding via SequencesTab

### Sequence test send

Truth path:
- `server/src/routes/sendWorker.ts`
- `POST /api/send-worker/sequence-test-send`

Current contract:
- requires marketing mutation auth
- requires tenant
- uses `processOne(...)` with controlled options

Assessment:
- solid

### Scheduler / campaign sender

Truth path:
- `server/src/workers/emailScheduler.ts`
- `server/src/workers/campaignSender.ts`

Current contract:
- still enforce identity cap
- preload and enforce customer-scoped suppression
- stop on reply, bounce, unsubscribed
- apply unsubscribe link/footer rendering

Assessment:
- wired but older and rougher than the main queue worker path

## Protection Review

### 30/day cap

Evidence:
- `server/src/utils/emailIdentityLimits.ts`
- used by `sendQueueWorker.ts`, `emailScheduler.ts`, `campaignSender.ts`, and send-worker diagnostic paths

Assessment:
- intact

### Suppression

Evidence:
- `server/src/routes/suppression.ts`
- `server/src/routes/tracking.ts`
- `server/src/routes/inbox.ts`
- `server/src/workers/sendQueueWorker.ts`
- `server/src/workers/emailScheduler.ts`
- `server/src/workers/campaignSender.ts`

Assessment:
- intact and customer-scoped

### Unsubscribe

Evidence:
- `server/src/routes/tracking.ts`
- `server/src/services/templateRenderer.ts`
- `server/src/workers/sendQueueWorker.ts`
- `server/src/workers/emailScheduler.ts`

Assessment:
- intact

### Reply-stop

Evidence:
- `server/src/workers/sendQueueWorker.ts`
- `server/src/workers/emailScheduler.ts`
- `server/src/workers/campaignSender.ts`

Assessment:
- intact

### Bounce stop

Evidence:
- `server/src/workers/sendQueueWorker.ts`
- `server/src/workers/emailScheduler.ts`
- `server/src/workers/campaignSender.ts`

Assessment:
- intact

### Tenant isolation

Evidence:
- `server/src/utils/tenantId.ts`
- customer-scoped routes across send, inbox, leads, suppression, lead sources

Assessment:
- intact

## Per-Customer Suppression Truth Review

Truth source:
- `suppressionEntry`

Write paths:
- compliance UI
- tracking unsubscribe route
- inbox opt-out route
- hard-bounce auto-suppression in queue worker

Read/enforcement paths:
- send queue worker
- scheduler
- campaign sender
- suppression summary/health reads

Assessment:
- one of the strongest end-to-end truths in the system

## Inbox / Outreach Interaction Review

Evidence:
- `server/src/routes/inbox.ts`
- `src/tabs/marketing/components/InboxTab.tsx`

What is good:
- reply surfaces are customer-scoped
- opt-out writes feed suppression truth
- reply action uses mailbox identity-backed send/reply services

What is rough:
- inbox still needs better scale handling and filtering

Assessment:
- trustworthy, but not yet elegant

## Remaining Execution Risks

1. The backend send model is coherent, but the Sequences UI still exposes too many admin/workbench concepts.
2. Scheduler/campaign sender paths are safe, but architecturally older than the queue-worker truth path.
3. Operators can still misunderstand the difference between planning surfaces and live-send surfaces.
4. Reports and readiness use execution data well, but not yet with one unified operator model.

## Is Real Outreach Trustworthy Today?

Yes.

The execution engine is trustworthy enough for production use because:
- protections are enforced in the backend
- tenant scoping is real
- unsubscribe and suppression writes land in customer-scoped truth
- live-tick no longer bypasses the guarded worker path

The remaining weaknesses are product/UX clarity and lead-source truth fragility, not a proven current send-policy bypass.
