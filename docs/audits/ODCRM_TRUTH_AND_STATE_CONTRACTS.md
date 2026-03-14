# ODCRM Truth And State Contracts

Date: 2026-03-14
Planning base SHA: `1c268db4fc9940bd8daff13a917e1225271db74b`

## Client Selection / `currentCustomerId` / `fixedCustomerId`

Source of truth:
- Agency mode: `src/platform/stores/settings.ts`
- Client mode: `/api/me` via `src/platform/me.ts`

Duplicate mirrors:
- local `selectedCustomerId` state in many tabs

Risk caused by duplicates:
- UI/header mismatches when local and global scope drift

What to consolidate later:
- one explicit frontend customer-scope contract for active-client tabs vs local-selector tabs

## Customer-Scoped Reads / Writes

Source of truth:
- backend route enforcement in `server/src/utils/tenantId.ts`
- customer mutation constraints in `server/src/routes/customers.ts`

Duplicate mirrors:
- frontend caller-built headers in large tab components

Risk caused by duplicates:
- regression risk from incorrect caller header ownership

What to consolidate later:
- shared helper pattern for customer-scoped requests in tabs that act on a selected row/customer

## Lead Truth

Source of truth:
- import/sync in `server/src/workers/leadsSync.ts`
- shared mapping in `server/src/services/leadCanonicalMapping.ts`

Duplicate mirrors:
- `/api/leads`
- `/api/live/leads`
- account/live metrics consumers

Risk caused by duplicates:
- count drift, classification inconsistencies, stale or contradictory read models

What to consolidate later:
- one shared sheet-row eligibility + normalization contract reused everywhere

## Lead Source Truth

Source of truth:
- `server/src/routes/leadSources.ts`
- customer config plus all-accounts fallback

Duplicate mirrors:
- UI representation of source scope and status

Risk caused by duplicates:
- operator misunderstanding of whether data is client-owned or shared fallback

What to consolidate later:
- clearer source-scope and downstream-impact messaging, not a second truth path

## Suppression Truth

Source of truth:
- `suppressionEntry`

Duplicate mirrors:
- none that materially compete with DB truth

Risk caused by duplicates:
- low

What to consolidate later:
- mostly explanatory/health metadata, not suppression truth itself

## Template Truth

Source of truth:
- `EmailTemplate`
- rendering contract in `templateRenderer.ts`

Duplicate mirrors:
- preview-specific frontend state

Risk caused by duplicates:
- low after recent fixes

What to consolidate later:
- mostly lifecycle/library management, not truth correction

## Sequence Truth

Source of truth:
- sequence, enrollment, queue, campaign records

Duplicate mirrors:
- multiple adjacent operator screens describing similar sequence/send states

Risk caused by duplicates:
- operator confusion more than data corruption

What to consolidate later:
- split authoring, operations, and diagnostics into clearer surfaces

## Send Truth

Source of truth:
- `processOne(...)` in `server/src/workers/sendQueueWorker.ts`

Duplicate mirrors:
- scheduler/campaign sender still enforce similar protections separately

Risk caused by duplicates:
- architectural inconsistency and drift risk over time

What to consolidate later:
- reduce divergence between queue-worker truth and older send-adjacent paths where practical

## Inbox Truth

Source of truth:
- `server/src/routes/inbox.ts`

Duplicate mirrors:
- UI-local threading/message state

Risk caused by duplicates:
- scale/performance and UX drift more than truth corruption

What to consolidate later:
- server-side paging/filtering contracts for large inboxes

## Reporting Truth

Source of truth:
- `server/src/routes/reports.ts`
- send-worker read models

Duplicate mirrors:
- UI-level composition of report + diagnostics

Risk caused by duplicates:
- operator may read diagnostic fallbacks as hard business truth

What to consolidate later:
- explicit degraded-state contract and clearer KPI/reporting layer
