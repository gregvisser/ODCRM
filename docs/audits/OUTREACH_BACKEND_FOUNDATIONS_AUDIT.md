# Outreach Backend Foundations Audit

Date: 2026-03-12
Baseline: `origin/main` `0a25edea1676a78cb7050c12b26d92d2677ac56f`

## Current truth path
- Sequence records: `server/src/routes/sequences.ts`
- Queue truth and operator queue mutations: `server/src/routes/sendQueue.ts`
- Read-only send visibility and launch diagnostics: `server/src/routes/sendWorker.ts`
- Live queue processing: `server/src/workers/sendQueueWorker.ts`
- Legacy/parallel scheduled campaign workers: `server/src/workers/emailScheduler.ts`, `server/src/workers/campaignSender.ts`
- Email identity configuration: `server/src/routes/outlook.ts`
- Suppression imports and health: `server/src/routes/suppression.ts`
- Unsubscribe tracking and DNC writes: `server/src/routes/tracking.ts`
- Reporting: `server/src/routes/reports.ts`

## Foundations already implemented correctly
- Per-customer scoping for sequences, queue items, suppression, inbox, and tracking.
- Queue item lifecycle with lock/requeue/send/fail states.
- Stop-on-reply handling and suppression checks before send.
- Unsubscribe links resolve server-side ownership and write client-specific suppression entries.
- Hard-bounce invalid-recipient handling is present in queue/send workers.
- Launch preview, readiness, preflight, queue workbench, and audit history are based on backend truth, not mocked UI counts.

## Safety gaps found
- Daily identity send limits were not hard-limited to 30. Multiple code paths defaulted to 150 or allowed much higher values:
  - `server/src/routes/outlook.ts`
  - `server/src/routes/schedules.ts`
  - `server/src/workers/emailScheduler.ts`
  - `server/src/workers/campaignSender.ts`
  - `server/src/workers/sendQueueWorker.ts`
- Immediate live testing existed only through admin-secret canary routes, which made safe operator testing impractical.

## Safety rules enforced in this PR
- New shared helper: `server/src/utils/emailIdentityLimits.ts`
- Effective hard rule: every sending identity is capped at 30 emails/day in backend truth.
- OAuth-created and SMTP-created identities now default to 30/day.
- Identity updates and schedule-driven updates clamp to 30/day.
- Queue worker, scheduler, campaign sender, and identity-capacity snapshots now all use the enforced cap.

## Immediate testing reality after this PR
- New operator mutation route: `POST /api/send-worker/sequence-test-send`
- Scope: tenant + sequence only
- Safety:
  - requires normal marketing mutation auth
  - still respects live-send canary gates
  - capped to a tiny batch (`<= 3`)
  - optional send-window bypass only when `ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW=true`
  - refreshable through existing run-history and operator-console truth paths

## Remaining backend follow-up
- Decide whether legacy campaign sender/scheduler should be retired or explicitly documented as separate paths.
- Add a dedicated bounce/invalid-recipient operator summary route if Inbox/Reports still feel too indirect after UI cleanup.
