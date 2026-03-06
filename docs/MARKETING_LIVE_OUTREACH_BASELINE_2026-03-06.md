# Marketing Live Outreach Baseline (2026-03-06)

## Scope
This baseline evaluates the current Marketing tab stack for production-safe cold outreach:
- UI surface: `src/tabs/marketing/*`
- APIs: `server/src/routes/{sequences,enrollments,sendQueue,sendWorker,inbox,reports,outlook,suppression,leadSources,schedules,templates}.ts`
- Workers/gates: `server/src/workers/sendQueueWorker.ts`, `server/src/utils/liveSendGate.ts`

## Verified today
- Tenant/admin gating checks passed via existing self-tests:
  - `npm run test:pilot-release-smoke`
  - `npm run test:engagement-stage2b-contract`
  - `npm run test:send-queue-preview-smoke`
  - `npm run test:enrollments-stage1a`
  - `npm run test:enrollment-queue-stage3e`
  - `npm run test:send-worker-live-tick-stage4min`
- Backend build passed:
  - `cd server && npm run build`
- Frontend type-check passed:
  - `npx tsc --noEmit`

## Current strengths
- Strong send safety gates already exist (`ENABLE_SEND_QUEUE_SENDING`, `ENABLE_LIVE_SENDING`, canary customer/identity, per-tick caps).
- Suppression and queue safety controls are implemented in worker and queue APIs.
- Audit trail endpoints exist for send-worker decisions and queue item behavior.
- Marketing UI has deep operational surfaces (sequences, queue preview, dry-run, audits, inbox, suppression, reports).

## High-priority gaps to close before "full live outreach" sign-off
1. **Auth/RBAC consistency across marketing APIs**
   - Some routes are tenant-scoped but not consistently protected by verified actor/role middleware.
2. **Lead source mutation auth hardening**
   - `server/src/routes/leadSources.ts` contains explicit TODO to add production auth guard for connect/poll/materialization mutating operations.
3. **Go-live runbook standardization**
   - Need one canonical operator runbook for enable/disable live sending, canary rollout, and immediate rollback.
4. **Preflight readiness command**
   - Need a single deterministic readiness check that verifies env gates, identity availability, suppression safety, and critical endpoint contracts.
5. **Monitoring/alerting thresholds**
   - Need explicit live-send health thresholds (failure rate, suppression spikes, queue growth, stuck locks) and alert actions.

## Execution phases (strict guardrails)
### Phase 1 - Baseline lock + preflight checker
- Add a single `marketing:readiness` command/script.
- Ensure script fails fast on missing live-send gates or unsafe config.

### Phase 2 - Auth and tenant hardening
- Apply consistent auth/role checks to marketing mutation endpoints.
- Preserve existing tenant guard behavior and backward-compatible error codes.

### Phase 3 - Send path hardening
- Validate idempotency/lock behavior under retries.
- Add explicit protections against duplicate sends in race conditions.

### Phase 4 - Operator UX completeness
- Ensure UI controls for dry-run, queue actions, and live tick are aligned with hardened backend responses.
- Improve actionable error feedback without exposing secrets.

### Phase 5 - Validation and rollout
- Expand self-tests/integration checks for hardened paths.
- Produce final go-live checklist + rollback playbook.

## Non-negotiable guardrails
- No direct live-send behavior change without deterministic tests.
- No route auth changes without backward-compatibility review.
- Every mutation path must be tenant-scoped and auditable.
- Live sending remains canary-gated until explicit sign-off.

## Status
- Baseline complete.
- Phase 1 complete (readiness checker added).
- Phase 2 in progress (mutation auth guard rollout started).

## Phase 2 progress update (2026-03-06)
- Added middleware: `server/src/middleware/marketingMutationAuth.ts`
  - Modes via `MARKETING_MUTATION_AUTH_MODE=off|warn|enforce` (default `warn`)
  - Accepts actor auth from:
    - Azure SWA principal header
    - Microsoft bearer token (verified against Entra JWKS)
    - X-Admin-Secret
- Guard applied to marketing mutation routes:
  - `leadSources.ts`: connect, poll, materialize-list
  - `sheets.ts`: source connect, source sync
  - `inbox.ts`: mark read, optout, refresh, reply
  - `campaigns.ts`: create/update/templates/prospects/start/pause/complete/delete
  - `templates.ts`: CRUD + AI mutation endpoints
  - `lists.ts`: CRUD + list contact mutations
  - `suppression.ts`: all mutation endpoints
  - `schedules.ts`: pause/resume/delete
  - `sequences.ts`: all mutation endpoints + sequence enrollments creation
  - `enrollments.ts`: dry-run/queue/queue-refresh/pause/resume/cancel
- Validation after changes:
  - `cd server && npm run build` PASS
  - `npm run test:pilot-release-smoke` PASS
  - `npm run marketing:readiness` PASS
