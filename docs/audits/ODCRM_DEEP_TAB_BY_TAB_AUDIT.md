# ODCRM Deep Tab-by-Tab Audit

Actual `origin/main` SHA audited: `028ba87a5efd2e6ba0997a0cc94927682b04d009`

## Executive Summary

ODCRM is no longer a loose prototype. The platform now has real tenant enforcement, real backend truth for customers/templates/sequences/suppression, real parity tooling, and real send guardrails. It is usable for production outreach, but it is not uniformly product-grade. The product still feels split between:

- real operator workflows
- legacy compatibility behavior
- diagnostic/control-room tooling exposed directly in primary tabs

The deepest structural themes are:

- client scoping is functional but duplicated across the frontend
- lead truth is much better but still sheet-heuristic-heavy
- suppression and template truth are relatively clean
- sequences/readiness/reports still expose too much internal operations detail
- accounts/onboarding still carry compatibility-era baggage

Severity scale used below:

- `product-grade`
- `partially wired`
- `misleading`
- `operationally risky`
- `broken`

## Global / Shell

### App shell
- Purpose: own top-level navigation, auth bootstrap, and customer-scoped app mode.
- Frontend entry: `src/App.tsx`
- Backend truth paths: `/api/me`, `/api/users/me`, shared `src/utils/api.ts` headers
- Tenant/scoping model:
  - agency UI: global `currentCustomerId` from `src/platform/stores/settings.ts`
  - client UI: `fixedCustomerId` from `/api/me`
  - `src/utils/api.ts` injects `X-Customer-Id` from fixed client or active client
- Solid:
  - one canonical shared API helper now carries bearer token and customer header
  - `RequireActiveClient` gives a real hard stop for client-scoped tabs
  - client UI correctly prefers fixed tenant over mutable local choice
- Partially wired:
  - shell state is query-param/event-driven instead of router-driven
  - multiple tabs still re-select customers locally and then write back to global store
- Misleading:
  - the app feels routed, but navigation is largely manual state sync in `App.tsx`
- Broken:
  - none proven in current main
- Missing:
  - one explicit scoping contract for “active client only” vs “tab-level selector”
- Verdict: `partially wired`
- Recommended fix shape: frontend-only shell/scoping cleanup, not a backend rewrite

### Navigation
- Frontend entry: `src/contracts/nav.ts`, home pages under `src/tabs/*`
- Solid:
  - top-level information architecture is now intelligible
  - Customers, Marketing, Onboarding, Settings are separated
- Partially wired:
  - compatibility mappings still exist for removed/renamed views
  - some subview ids still reflect old names (`leads-reporting` loads `LeadsTab`)
- Misleading:
  - query param changes and custom events make deep links fragile
- Missing:
  - explicit route ownership per tab
- Verdict: `partially wired`

### Auth / bootstrap / me flow
- Frontend entry: `src/auth/AuthGate.tsx`, `src/auth/apiAuthToken.ts`, `src/platform/me.ts`
- Backend truth: `/api/users/me`, `/api/me`, actor identity parsing in `server/src/utils/actorIdentity.ts`
- Solid:
  - bearer propagation fix is present
  - authenticated actor identity now reaches mutation routes consistently
- Risk:
  - auth success and customer scoping are coupled in UI bootstrap, not isolated
- Verdict: `product-grade` for correctness, `partially wired` for ergonomics

### Parity / deploy / runtime assumptions
- Files: `.github/workflows/deploy-backend-azure.yml`, `.github/workflows/deploy-frontend-azure-static-web-app.yml`, `.github/workflows/prod-parity-after-merge.yml`, `scripts/prod-check.cjs`, `server/src/index.ts`
- Solid:
  - build SHA is emitted on frontend and backend
  - parity checker classifies FE/BE drift and can trigger backend recovery
  - backend deploy is serialized with workflow concurrency
- Misleading:
  - the platform still assumes skew windows are normal and recoverable
- Missing:
  - stronger structural prevention of frontend/backend rollout drift
- Verdict: `product-grade` operationally, but still `operationally risky` under skew

## Customers / CRM

### Accounts
- Purpose: primary CRM client workspace
- Frontend entry: `src/components/AccountsTabDatabase.tsx` wrapping `src/components/AccountsTab.tsx`
- Backend truth:
  - `/api/customers`
  - `/api/customers/:id`
  - `/api/customers/:id/account`
  - `/api/customers/:id/notes`
  - `/api/customers/:id/contacts/*`
  - `/api/customers/:id/attachments*`
  - live lead metrics overlay via `src/utils/liveLeadsApi.ts`
- Tenant/scoping:
  - DB wrapper is clean
  - inner tab still carries local-storage compatibility behavior
- Solid:
  - customer list/detail now come from DB
  - DEFCON editing uses truthful customer patch route
  - sheet-backed customers overlay live lead metrics without hydrating from localStorage first
- Partially wired:
  - `AccountsTab.tsx` still contains deprecated storage types, seed logic, backup logic, sync hashes, and compatibility comments
  - the file is too large to be safely reasoned about as one product surface
- Misleading:
  - UI is database-backed, but implementation still suggests localStorage-era fallback remains a live concern
  - `src/utils/accountsLeadsSync.ts` still mutates local storage copies of account lead counts for some downstream views
- Missing:
  - removal of stale storage-era plumbing
  - decomposition into card, grid, drawer, and persistence modules
- Verdict: `usable but operationally risky`
- Recommended fix: full-stack cleanup, but as micro-PRs around storage mirror removal and component decomposition

### Contacts
- Frontend entry: `src/components/ContactsTab.tsx`
- Backend truth: `/api/customers/:customerId/contacts`, customers list from `/api/customers`
- Solid:
  - DB-backed
  - scoped CRUD is straightforward
- Weak:
  - very thin operator surface
  - no pagination, search depth, edit flow, or richer CRM context
- Verdict: `partially wired`
- Missing:
  - edit path
  - pagination/filtering if contact volumes grow
  - stronger linkage back to Accounts and outreach actions

### Leads
- Frontend entry: `src/components/LeadsTab.tsx`
- Backend truth:
  - `/api/live/leads`
  - `/api/live/leads/metrics`
  - `/api/leads/sync/status`
  - `/api/leads/sync/validate`
  - conversion/status/score/export routes in `/api/leads`
- Solid:
  - server-paginated live rows
  - normalized sync state now distinguishes live/stale/failed/empty/misconfigured
  - add/edit/retry paths exist
- Partially wired:
  - tab still mixes live truth, conversion actions, and empty-state diagnostics
  - it owns its own customer selector instead of following one shell convention
- Misleading:
  - the name suggests one coherent lead model, but it still straddles live rows and older `/api/leads` behavior
- Verdict: `usable but still rough`

### Leads Reporting
- Frontend entry: `src/components/LeadsReportingTab.tsx`
- Backend truth: `/api/live/leads`
- Solid:
  - server pagination
  - honest source-of-truth messaging for DB-backed vs sheet-backed clients
- Misleading:
  - it still writes total lead count back into local storage via `syncSingleAccountLeadCount`
  - “reporting” is mostly filtered row review, not true reporting
- Verdict: `partially wired`

### Marketing Leads
- Frontend entry: `src/components/MarketingLeadsTab.tsx`
- Backend truth:
  - `/api/live/leads`
  - `/api/live/leads/metrics`
  - aggregate multi-customer metric calls through `fetchLiveMetricsForCustomers`
- Solid:
  - server-side pagination/filter/sort/export
  - aggregate metrics and account drilldown are real
- Partially wired:
  - still updates local account count mirrors
  - blends executive-style metrics with operator row workbench in one tab
- Verdict: `usable but overloaded`

## Onboarding

### Onboarding home
- Frontend entry: `src/tabs/onboarding/OnboardingHomePage.tsx`
- Backend truth:
  - customer onboarding data via `/api/customers/:id`
  - readiness via `/api/onboarding/readiness` and `/api/send-worker/console`
- Solid:
  - customer selector only shown in agency UI
  - bridge to Marketing Readiness is explicit
- Partially wired:
  - onboarding uses readiness state from marketing/send diagnostics
  - local selected-customer state still mirrors global store
- Verdict: `partially wired`

### Customer Onboarding
- Frontend entry: `src/tabs/onboarding/CustomerOnboardingTab.tsx`
- Backend truth:
  - `/api/customers/:id`
  - `/api/customers/:id/onboarding`
  - `/api/customers/:id/attachments`
  - `/api/customers/:id/agreement`
  - `/api/job-sectors`
  - `/api/job-roles`
  - place search endpoints
- Solid:
  - DB-backed
  - conflict/dirty-state logic is present
  - onboarding can persist rich customer profile data
- Weak:
  - huge component with many responsibilities
  - still mixes operational onboarding, CRM profile editing, file handling, and account setup
- Verdict: `usable but operationally risky`

### Progress Tracker
- Frontend entry: `src/tabs/onboarding/ProgressTrackerTab.tsx`
- Backend truth:
  - `/api/customers/:id`
  - `/api/customers/:id/progress-tracker`
- Solid:
  - DB-backed checklist
  - auto-removes completed clients when toggle is off
- Misleading:
  - checklist is operationally useful, but remains separate from readiness even though operators will read them as one lifecycle
- Verdict: `partially wired`

### Legacy Onboarding Overview
- Frontend entry: `src/tabs/onboarding/OnboardingOverview.tsx`
- Current runtime status: legacy only, not part of live onboarding nav per `src/tabs/onboarding/README.md`
- Misleading:
  - contains stale product branding and old checklist narrative
- Verdict: `misleading legacy residue`

## Marketing Tabs

### Readiness
- Frontend entry: `src/tabs/marketing/components/ReadinessTab.tsx`
- Backend truth:
  - `/api/sequences`
  - `/api/send-worker/exception-center`
  - `/api/send-worker/identity-capacity`
  - `/api/send-worker/run-history`
  - `/api/send-worker/sequence-preflight`
  - `/api/send-worker/launch-preview`
  - `/api/send-worker/preview-vs-outcome`
- Solid:
  - real diagnostics
  - actionable links into Sequences, Inbox, Reports
- Misleading:
  - this is more operational cockpit than clean readiness screen
  - heavily dependent on send-worker internals
- Missing:
  - clearer separation between “client setup readiness” and “today’s send exceptions”
- Verdict: `usable but workbench-heavy`

### Reports
- Frontend entry: `src/tabs/marketing/components/ReportsTab.tsx`
- Backend truth:
  - `/api/reports/outreach`
  - `/api/send-worker/run-history`
  - `/api/send-worker/identity-capacity`
  - `/api/send-worker/console`
  - `/api/send-worker/queue-workbench`
- Solid:
  - client selector is explicit
  - combines outreach aggregates with current queue pressure
- Weak:
  - report meaning depends on diagnostic endpoints
  - fallback behavior in backend can silently zero reply/opt-out metrics if enum/query drift occurs
- Verdict: `partially wired`

### Lead Sources
- Frontend entry: `src/tabs/marketing/components/LeadSourcesTabNew.tsx`
- Backend truth:
  - `/api/lead-sources`
  - `/api/lead-sources/:sourceType/connect`
  - `/api/lead-sources/:sourceType/poll`
  - `/api/lead-sources/:sourceType/batches`
  - `/api/lead-sources/:sourceType/contacts`
  - `/api/lead-sources/:sourceType/open-sheet`
- Solid:
  - cards, batches, contacts table all exist in the main flow
  - 50-row pagination
  - show/hide columns
  - customer vs all-accounts scope message
- Weak:
  - source semantics are still sheet-source/admin-ish, not fully CRM-native
- Verdict: `product-grade for current scope`

### Compliance / Suppression
- Frontend entry: `src/tabs/marketing/components/ComplianceTab.tsx`
- Backend truth:
  - `/api/suppression`
  - `/api/suppression/health`
  - `/api/suppression/emails/import-sheet`
  - `/api/suppression/domains/import-sheet`
- Solid:
  - per-customer scope is explicit
  - linked sheet health is surfaced
  - pagination exists
  - empty connected sheets are treated as valid
- Verdict: `product-grade`

### Email Accounts
- Frontend entry: `src/tabs/marketing/components/EmailAccountsTab.tsx`
- Backend truth:
  - `/api/outlook/auth`
  - `/api/outlook/identities`
  - `/api/outlook/identities/:id`
  - `/api/outlook/identities/:id/signature`
  - `/api/outlook/identities/:id/test-send`
  - `/api/send-worker/identity-capacity`
- Solid:
  - mailbox CRUD and signature handling are real
  - identity capacity is surfaced
  - daily limit clamp is enforced on backend
- Misleading:
  - tab still mixes customer selection, mailbox CRUD, and capacity diagnostics
  - reconnect/health state is present but not especially operator-friendly
- Verdict: `usable but still operational`

### Templates
- Frontend entry: `src/tabs/marketing/components/TemplatesTab.tsx`
- Backend truth:
  - `/api/templates`
  - `/api/templates/preview`
  - `/api/templates/ai/*`
  - renderer in `server/src/services/templateRenderer.ts`
- Solid:
  - category persistence
  - preview rendering
  - unsubscribe/signature placeholders are real
  - AI tweak is non-destructive until save
- Weak:
  - template library UX is still basic
  - preview is trustworthy, but the tab still feels more utilitarian than polished
- Verdict: `product-grade for current operational scope`

### Sequences
- Frontend entry: `src/tabs/marketing/components/SequencesTab.tsx`
- Backend truth:
  - `/api/sequences`
  - `/api/enrollments`
  - `/api/send-worker/*`
  - `/api/send-queue/*`
  - `/api/campaigns/*`
  - `/api/lead-sources/batches`
  - `/api/templates`
  - `/api/outlook/identities`
- Solid:
  - real sequence CRUD
  - real enrollments
  - test send, dry run, audits, queue preview, operator console, launch preview, preflight all exist
- Misleading:
  - far too many concepts are exposed in one screen
  - still blends product workflow with operator-control-room tooling
  - sequence vs campaign vs enrollment vs queue is understandable to engineers, not cleanly to operators
- Verdict: `usable but workbench-heavy and operationally risky`

### Schedules
- Frontend entry: `src/tabs/marketing/components/SchedulesTab.tsx`
- Backend truth:
  - `/api/schedules`
  - `/api/schedules/emails`
  - `/api/schedules/:id/stats`
  - send-worker preflight/run-history helpers
- Solid:
  - real schedule rows
  - real pause/resume
  - preflight and recent outcome context
- Weak:
  - depends on schedule/campaign/sequence mental model that is still not product-simple
- Verdict: `partially wired`

### Inbox
- Frontend entry: `src/tabs/marketing/components/InboxTab.tsx`
- Backend truth:
  - `/api/inbox/replies`
  - `/api/inbox/threads`
  - `/api/inbox/threads/:threadId/messages`
  - `/api/inbox/messages/:id/read`
  - `/api/inbox/messages/:id/optout`
  - `/api/inbox/refresh`
  - `/api/inbox/threads/:threadId/reply`
- Solid:
  - customer-scoped
  - can read threads, mark read, refresh, reply, opt out
- Weak:
  - thread loading is coarse and likely to hit scale pain before other areas
  - tab is functional but still plainly operational rather than polished CRM inbox
- Verdict: `usable but likely to strain at scale`

## Execution / Backend Truth Paths

### Outreach execution
- Core truth files:
  - `server/src/workers/sendQueueWorker.ts`
  - `server/src/routes/sendWorker.ts`
  - `server/src/routes/enrollments.ts`
  - `server/src/utils/emailIdentityLimits.ts`
  - `server/src/utils/liveSendGate.ts`
- Solid:
  - 30/day cap enforced centrally
  - reply-stop and bounce-stop enforced in worker decisions
  - suppression enforced in send worker
  - unsubscribe writes land in suppression truth
  - live-send gating is centralized
- Remaining risk:
  - UI around these controls is noisier than the safety model underneath

### Lead truth and sync runtime
- Truth files:
  - `server/src/services/leadCanonicalMapping.ts`
  - `server/src/workers/leadsSync.ts`
  - `server/src/services/leadSyncStatus.ts`
  - `server/src/routes/leads.ts`
  - `server/src/routes/liveLeads.ts`
- Solid:
  - counts are now aligned across main lead surfaces
  - normalized sync state exists
- Risk:
  - sheet interpretation remains heuristic
  - sync/runtime reliability is still an operational concern, even after freshness hardening

## Direct Answers

### Is ODCRM behaving like a real outreach platform?
- Yes in safety-critical backend behavior.
- No in full product polish and coherence. Several primary operator tabs still feel like internal operational consoles.

### Where does it still feel like an internal workbench?
- `Sequences`
- `Readiness`
- parts of `Reports`
- portions of `Accounts` because of legacy storage compatibility residue

### Are suppression lists truly per-customer and enforced everywhere that matters?
- Yes, based on current route and worker paths.

### Are sequences production-grade?
- Functionally yes.
- Product-wise no. The surface is overloaded and too diagnostic-heavy.

### Are reports trustworthy enough for operator/business review?
- Directionally useful, but not clean enough for unquestioned business review.

### Is Accounts still carrying outdated compatibility logic?
- Yes.

### Is client scoping fully consistent across the app?
- No. Backend tenant enforcement is consistent. Frontend scoping is still duplicated.

### Which tabs are product-ready today?
- Lead Sources
- Compliance / Suppression
- Templates

### Which tabs are usable but misleading?
- Accounts
- Leads Reporting
- Readiness
- Reports
- Schedules

### Which tabs need redesign, not just bug fixes?
- Sequences
- Readiness
- likely Inbox once scale grows
