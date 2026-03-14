# ODCRM Remediation Master Plan

Date: 2026-03-14
Planning branch: `codex/odcrm-remediation-roadmap`
Actual origin/main SHA used: `1c268db4fc9940bd8daff13a917e1225271db74b`

This document is the execution layer for the current ODCRM audit set. It supersedes the older audit docs for planning priority and PR sequencing. The earlier deep audit docs remain useful as evidence and supporting detail; this is the roadmap to act on them.

## Executive Summary

ODCRM is production-usable for real outreach operations today, but only because the backend safety model is stronger than the frontend product model. The biggest remaining risks are:
- Google Sheets lead truth is still too heuristic and too fragmented across sync and read paths.
- Frontend client scoping is still duplicated across many tabs.
- Core operator surfaces such as Accounts and Sequences remain too large and too mixed in responsibility.
- Some screens are still closer to diagnostics/workbench tooling than to polished operator product surfaces.

The next phase should not be a giant rewrite. It should be a sequence of small safe PRs that:
1. protect truth
2. reduce state duplication
3. reduce operator confusion
4. improve scale resilience

## Current Platform Verdict

### Production-usable

- Tenant isolation via `X-Customer-Id` and `fixedCustomerId` client-mode enforcement is real.
- Send protections are materially real:
  - 30/day cap
  - suppression
  - unsubscribe
  - reply-stop
  - bounce stop
- Templates are now coherent enough to rely on:
  - category persistence
  - preview/rendering alignment
  - clickable unsubscribe rendering
  - preserved signature behavior
  - non-destructive AI flow
- Lead Sources, live leads, MarketingLeadsTab, and Suppression now use real server-side pagination on the high-volume surfaces.
- Suppression is one of the cleanest end-to-end modules in the system.
- Parity tooling is trustworthy and gives a real operational guardrail.

### Risky

- Lead truth still depends on fragmented classification logic and multiple sheet-backed read/write paths.
- Sync/runtime behavior for lead sheets can still be stale or degraded in ways that undermine trust.
- Frontend client scoping still depends on tabs hand-syncing local and global state correctly.
- Accounts and Sequences remain regression-prone because the components are too large.

### Misleading

- Readiness is useful, but still more diagnostic than product-grade.
- Reports are useful, but still close to route-level aggregates and can degrade some metrics quietly.
- Sequences exposes too many engine concepts and admin/workbench ideas in one surface.
- Schedules is real, but still reads partly like a projection of send-worker internals rather than a clean operator schedule model.

### Still Not Product-Grade

- Unified lead truth model
- Unified client-scoping model
- Unified onboarding/readiness/operator journey
- Operator-grade reporting
- Simpler sequence authoring and operations experience

## Top 10 Issues Ranked By Business / Operational Risk

1. Lead truth is still split across sync/import/live-read paths.
2. Sheet sync runtime can degrade into stale/failing states while operators still see apparently usable counts.
3. Frontend client scoping is duplicated across many tabs and remains a class of regression risk.
4. Accounts still mixes DB-backed truth with local compatibility mirrors and old storage-era behavior.
5. Sequences is too overloaded to be a clean operator screen.
6. Reports are not yet trustworthy enough for hard business review without caveats.
7. Readiness overlaps onboarding and send diagnostics too heavily.
8. Inbox will hit scale limits before other major areas do.
9. Old workflow/runtime naming still adds cognitive drag to operations and diagnostics.
10. Query-state navigation plus custom events still acts as a weak shell/router layer.

## Top 10 Improvement Opportunities Ranked By Impact

1. One shared lead truth contract across import, live reads, and metrics.
2. One frontend customer-scope contract.
3. One operator-grade readiness/activation contract.
4. Separate sequence authoring from send diagnostics and queue workbench concepts.
5. Remove local lead-count mirrors from the CRM side.
6. Improve operator messaging around sheet health, stale syncs, and fallback scope.
7. Refine Reports into a business-usable outreach dashboard.
8. Clarify the role of Schedules relative to the actual send engine.
9. Improve mailbox health UX in Email Accounts.
10. Improve inbox filtering/windowing before data volume grows further.

## Do Not Disturb

These areas are good enough that they should not be reopened casually:

- Tenant enforcement in backend customer-scoped routes
- `processOne(...)` as the guarded send truth path
- 30/day cap enforcement in `emailIdentityLimits.ts`
- suppression / unsubscribe / reply-stop / bounce-stop enforcement
- template preview/unsubscribe/signature rendering contract
- Lead Sources visible contacts surface with 50-row pagination and column visibility
- suppression pagination and delta-aware linked-sheet import
- MarketingLeadsTab server-side query/pagination/export contract
- build parity tooling in `scripts/prod-check.cjs`

Rule:
- Future PRs should treat these as stable contracts unless there is a proven current-origin/main regression.

## Fix Before Scale

These should be fixed before ODCRM is treated as a serious outreach platform for materially more clients:

1. Lead truth unification
2. Sheet sync runtime hardening
3. Frontend client-scoping cleanup
4. Removal of local storage lead-count compatibility mirrors
5. Sequence surface decomposition or at least separation of authoring vs diagnostics
6. Better reporting trust/degraded-state messaging
7. Inbox scale handling

## Recommended Next 5 PRs In Exact Order

### PR 1: Unify Google Sheets Lead Truth

Type:
- full-stack, backend-heavy

Goal:
- Create one shared contract for Google Sheets lead-row eligibility and normalization across:
  - sync/import
  - `/api/leads`
  - `/api/live/leads`
  - metrics consumers

Why first:
- This is the highest business-risk truth path and the one most likely to regress.

### PR 2: Harden Lead Sheet Sync Runtime And Status

Type:
- backend-only

Goal:
- Make stale/failing/authoritative states operationally trustworthy.
- Reduce long-running transaction brittleness in live sheet sync/upsert paths.

Why second:
- Even correct classification is not enough if runtime sync status remains brittle.

### PR 3: Standardize Frontend Client Scope Contract

Type:
- frontend-only

Goal:
- Define one clean pattern for:
  - global active client tabs
  - tabs with their own selector
  - local selector -> global store sync
  - request header ownership

Why third:
- This removes the class of frontend-scoping regressions without touching backend truth.

### PR 4: Remove Account Lead Count Compatibility Mirrors

Type:
- full-stack light, mostly frontend

Goal:
- Stop using browser compatibility mirrors where backend/live truth is already available.

Why fourth:
- This reduces stale CRM numbers without requiring a redesign.

### PR 5: Split Sequence Authoring From Diagnostic Surfaces

Type:
- frontend-heavy

Goal:
- Keep the current backend send truth, but separate the UI into clearer operator concerns.

Why fifth:
- Sequences is now the biggest product-grade UX debt area after truth-path cleanup.

## Recommended Next 10 PRs If Continuing After That

6. Readiness/activation contract cleanup.
7. Reports trust/degraded-state clarity plus operator-grade KPI framing.
8. AccountsTab decomposition by truth-path boundaries.
9. Inbox thread/message windowing and filtering.
10. Email Accounts mailbox-health UX cleanup.
11. Schedules operator-role clarification.
12. Lead Sources sheet-health and downstream-impact messaging polish.
13. Onboarding/readiness overlap cleanup.
14. Shell routing/navigation cleanup.
15. Workflow/runtime naming cleanup.

## Work Type Separation

### Defects

- lead truth split
- sheet sync degraded-state ambiguity
- report degraded metrics fallback ambiguity

### Architectural Cleanup

- client-scoping duplication
- Accounts local mirrors
- oversized Accounts and Sequences components
- query-state shell/event routing

### UX / Operator Polish

- readiness framing
- report clarity
- mailbox health messaging
- inbox filtering
- sheet health explanations

### Scale / Performance Hardening

- lead sync runtime
- inbox backend pagination/windowing
- residual oversized list/windowing issues if they emerge
