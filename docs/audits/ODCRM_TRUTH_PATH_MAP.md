# ODCRM Truth Path Map

Date: 2026-03-14
Audit base SHA: `1c268db4fc9940bd8daff13a917e1225271db74b`

## Global Client Scoping Model

Agency mode:
- frontend uses `currentCustomerId`
- `src/platform/stores/settings.ts`
- `src/utils/api.ts` injects `X-Customer-Id` from that store unless caller overrides it

Client mode:
- frontend blocks until `/api/me` returns `fixedCustomerId`
- `src/platform/me.ts`
- `src/utils/api.ts` uses fixed tenant instead of local selector
- backend `server/src/utils/tenantId.ts` blocks mismatched tenants

Where the model is followed correctly:
- customer-scoped backend routes
- lead routes
- lead sources
- suppression
- send-worker routes

Where it drifts:
- tabs with both local selector state and global store sync
- large components that manually build request headers

## Send Truth Paths

Primary guarded path:
- `server/src/workers/sendQueueWorker.ts`

Entry points:
- `server/src/routes/sendWorker.ts`
- `server/src/routes/enrollments.ts`
- `server/src/routes/sequences.ts`

Supporting workers:
- `server/src/workers/emailScheduler.ts`
- `server/src/workers/campaignSender.ts`

Protection points:
- 30/day cap: `server/src/utils/emailIdentityLimits.ts`
- suppression: `server/src/routes/suppression.ts` + worker checks
- unsubscribe: `server/src/routes/tracking.ts` + footer enforcement
- reply-stop: queue worker/scheduler/campaign sender
- bounce stop: queue worker/scheduler/campaign sender

## Lead Truth Paths

Persistent/import path:
- `server/src/workers/leadsSync.ts`

Shared mapping/classification:
- `server/src/services/leadCanonicalMapping.ts`

Legacy/read path:
- `server/src/routes/leads.ts`

Live sheet-backed read path:
- `server/src/routes/liveLeads.ts`
- `server/src/utils/liveSheets.ts`

Truth drift risk:
- these paths are related but not as unified as they should be

## Suppression Truth Paths

Primary truth:
- `suppressionEntry`

Write paths:
- `server/src/routes/suppression.ts`
- `server/src/routes/tracking.ts`
- `server/src/routes/inbox.ts`
- auto-suppression in `server/src/workers/sendQueueWorker.ts`

Read/enforcement paths:
- queue worker
- scheduler
- campaign sender
- compliance UI

## Onboarding / Readiness Truth Paths

Onboarding persistence:
- `server/src/routes/customers.ts`
- `src/tabs/onboarding/CustomerOnboardingTab.tsx`
- `src/tabs/onboarding/ProgressTrackerTab.tsx`

Readiness interpretation:
- `src/utils/clientReadinessState.ts`
- `src/tabs/marketing/components/ReadinessTab.tsx`
- send-worker diagnostics

## Template / Sequence Truth Paths

Templates:
- `server/src/routes/templates.ts`
- `server/src/services/templateRenderer.ts`
- `server/src/services/aiEmailService.ts`

Sequences:
- `server/src/routes/sequences.ts`
- `server/src/routes/enrollments.ts`
- `server/src/routes/sendWorker.ts`

## Where Duplicate Truth Exists Today

1. Active client in global store plus local selectors in multiple tabs.
2. DB-backed lead/account metrics plus local storage compatibility mirrors.
3. Persistent leads truth plus live leads diagnostic truth.
4. Onboarding progress vs readiness interpretation.
5. Reports truth vs send-worker diagnostics for similar operational questions.

## Where Local Mirrors Still Exist

Primary examples:
- `src/utils/accountsLeadsSync.ts`
- local selector state in marketing and customer tabs

## Where Legacy Compatibility Behavior Still Exists

1. `src/components/AccountsTab.tsx`
2. query-state navigation and custom-event cross-navigation in `src/App.tsx`
3. older campaign/scheduler concepts still visible alongside newer queue-worker truth
4. report fallbacks that preserve availability but reduce strict truthfulness
