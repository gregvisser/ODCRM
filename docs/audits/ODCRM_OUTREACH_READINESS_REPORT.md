# ODCRM Outreach Readiness Report

Date: 2026-03-14
Planning base SHA: `1c268db4fc9940bd8daff13a917e1225271db74b`

## Verdict

ODCRM is ready for controlled live outreach today. It is not yet ready for low-friction scale across materially more clients without lead-truth hardening, better scoping discipline, and clearer operator surfaces.

## Live Sending Readiness

Status:
- safe, but UI-heavy

Evidence:
- `server/src/workers/sendQueueWorker.ts`
- `server/src/routes/sendWorker.ts`
- `server/src/utils/emailIdentityLimits.ts`

What is safe right now:
- `processOne(...)` is the guarded send truth path.
- `live-tick` uses it.
- `sequence-test-send` uses it.
- 30/day cap remains intact.

What is unsafe / misleading right now:
- The Sequences surface still exposes too many engine and workbench concepts.

Blockers before scale:
- simplify operator-facing sequence/send workflow

## Suppression / Unsubscribe Readiness

Status:
- strong

Evidence:
- `server/src/routes/suppression.ts`
- `server/src/routes/tracking.ts`
- `server/src/routes/inbox.ts`
- `server/src/workers/sendQueueWorker.ts`

What is safe right now:
- customer-scoped suppression truth is coherent
- inbox opt-out and tracking unsubscribe land in the same suppression truth family
- suppression is enforced before send

What is unsafe / misleading right now:
- very little; this is one of the strongest areas

Blockers before scale:
- none, beyond minor UX polish

## Email Account Readiness

Status:
- usable, but still diagnostic-heavy

Evidence:
- `src/tabs/marketing/components/EmailAccountsTab.tsx`
- `server/src/routes/outlook.ts`
- `server/src/routes/sendWorker.ts`

What is safe right now:
- sending identities are customer-scoped
- identity capacity is visible
- daily cap enforcement is real

What is unsafe / misleading right now:
- mailbox health and reconnect flows are not product-grade enough yet

Blockers before scale:
- clearer mailbox health/failure-state UX

## Template / Rendering Readiness

Status:
- strong

Evidence:
- `src/tabs/marketing/components/TemplatesTab.tsx`
- `server/src/routes/templates.ts`
- `server/src/services/templateRenderer.ts`
- `server/src/services/aiEmailService.ts`

What is safe right now:
- category persistence works
- preview/rendering contract is coherent
- unsubscribe link rendering works
- signature rendering works
- AI flow is non-destructive

What is unsafe / misleading right now:
- not a major blocker

Blockers before scale:
- none

## Sequence Execution Readiness

Status:
- backend-ready, frontend-overloaded

Evidence:
- `src/tabs/marketing/components/SequencesTab.tsx`
- `server/src/routes/sequences.ts`
- `server/src/routes/enrollments.ts`
- `server/src/routes/sendWorker.ts`

What is safe right now:
- test and live send paths are guarded
- sequence and enrollment backend contracts are real

What is unsafe / misleading right now:
- operator mental model is too crowded
- too many adjacent diagnostic and admin concepts are exposed

Blockers before scale:
- reduce operator confusion in the sequence/send control surface

## Reporting Trustworthiness

Status:
- partially ready

Evidence:
- `src/tabs/marketing/components/ReportsTab.tsx`
- `server/src/routes/reports.ts`

What is safe right now:
- client scoping is correct
- real backend aggregate routes exist

What is unsafe / misleading right now:
- some degraded route behavior can flatten reply/opt-out metrics to zero
- reports still feel diagnostic-first

Blockers before scale:
- explicit degraded-state messaging
- operator-grade KPI framing

## Inbox Handling

Status:
- operationally usable

Evidence:
- `src/tabs/marketing/components/InboxTab.tsx`
- `server/src/routes/inbox.ts`

What is safe right now:
- tenant-safe read/reply/opt-out paths
- suppression truth integration

What is unsafe / misleading right now:
- scale/performance/filtering is the main weakness

Blockers before scale:
- better message/thread windowing and filters

## Client Scoping / Tenant Safety

Status:
- backend-strong, frontend-duplicated

Evidence:
- `src/utils/api.ts`
- `src/platform/stores/settings.ts`
- `src/platform/me.ts`
- `server/src/utils/tenantId.ts`

What is safe right now:
- backend enforcement
- client-mode fixed tenant

What is unsafe / misleading right now:
- tabs still duplicate local/global client scope behavior

Blockers before scale:
- one consistent frontend customer-scope contract

## Exact Blockers Before Scaling Live Outreach

1. Lead truth unification for Google Sheets clients
2. Lead sheet sync runtime hardening and trustworthy status messaging
3. Frontend customer-scoping cleanup
4. Reduced operator overload in Sequences/send operations
5. Reporting trust/degraded-state clarity

## What Is Safe Right Now

- tenant isolation
- 30/day cap
- suppression
- unsubscribe handling
- reply-stop
- bounce stop
- template rendering contract
- lead source row-level visibility
- suppression linked-sheet behavior

## What Is Unsafe Or Misleading Right Now

- lead truth variability across sheet shapes
- stale/degraded lead sync operational states
- duplicated frontend customer scope
- oversized sequence/send UX
- reporting that still reads more diagnostic than decisive
