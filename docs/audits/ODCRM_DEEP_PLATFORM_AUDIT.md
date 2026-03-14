# ODCRM Deep Platform Audit

Date: 2026-03-14
Audit branch: `codex/deep-odcrm-tab-route-audit`
Actual origin/main SHA used: `1c268db4fc9940bd8daff13a917e1225271db74b`
Scope: audit-only

## Executive Summary

ODCRM now has real production-grade safety on the backend and a mostly credible operator product on the frontend. The platform is no longer a prototype. Tenant scoping, suppression enforcement, unsubscribe handling, reply-stop, bounce stop, and the 30/day identity cap are materially real.

The product is not yet internally clean. The main risks are duplicated frontend client state, multiple lead truth/read paths, oversized tab components, and operator surfaces that still expose too much engine detail. The backend tells a more coherent story than the frontend shell.

## What Is Solid

### Global scoping and tenant enforcement

Status: solid

Evidence:
- `src/utils/api.ts`
- `src/platform/stores/settings.ts`
- `src/platform/me.ts`
- `src/auth/AuthGate.tsx`
- `server/src/utils/tenantId.ts`
- `server/src/routes/customers.ts`

Actual contract:
- Agency mode uses `currentCustomerId` from settings/local storage.
- Client mode ignores that local setting and uses `/api/me` fixed tenant.
- Backend `requireCustomerId` enforces tenant context.
- Customer mutation routes still reject header/URL mismatches.

### Send guardrails

Status: solid

Evidence:
- `server/src/workers/sendQueueWorker.ts`
- `server/src/routes/sendWorker.ts`
- `server/src/utils/emailIdentityLimits.ts`
- `server/src/routes/tracking.ts`
- `server/src/routes/inbox.ts`
- `server/src/routes/suppression.ts`

Actual contract:
- `processOne(...)` remains the guarded truth path.
- `live-tick` delegates into that path.
- `sequence-test-send` also uses the guarded path.
- `clampDailySendLimit(...)` still caps at 30/day.
- Reply-stop, invalid-recipient bounce suppression, suppression checks, and unsubscribe footer handling remain intact.

### Main sheet-backed operator surfaces

Status: solid

Evidence:
- `src/components/LeadsTab.tsx`
- `src/components/LeadsReportingTab.tsx`
- `src/components/MarketingLeadsTab.tsx`
- `src/tabs/marketing/components/ComplianceTab.tsx`
- `src/tabs/marketing/components/LeadSourcesTabNew.tsx`
- `server/src/routes/liveLeads.ts`
- `server/src/routes/suppression.ts`
- `server/src/routes/leadSources.ts`

Actual contract:
- Suppression is server-paginated and sheet sync is delta-aware.
- Live leads simpler views are server-paginated.
- MarketingLeadsTab uses server-side filtering/pagination/export.
- Lead Sources exposes cards, batches, contacts, source-scope, columns, and 50-row pagination in one visible flow.

### Templates and AI safety

Status: solid

Evidence:
- `src/tabs/marketing/components/TemplatesTab.tsx`
- `server/src/routes/templates.ts`
- `server/src/services/templateRenderer.ts`
- `server/src/services/aiEmailService.ts`

Actual contract:
- Category persists.
- Preview uses backend rendering.
- `{{unsubscribe_link}}` is clickable in HTML rendering.
- `{{email_signature}}` still works.
- AI output is suggestion-local until explicit save.

## What Is Partially Wired

### Global client scoping

Status: acceptable but rough

Evidence:
- `src/App.tsx`
- `src/components/RequireActiveClient.tsx`
- `src/tabs/customers/CustomersHomePage.tsx`
- `src/tabs/marketing/MarketingHomePage.tsx`
- `src/tabs/onboarding/OnboardingHomePage.tsx`

Actual contract:
- The app has one canonical active-client store.
- Many tabs still keep local `selectedCustomerId` state and manually sync it back to the global store.
- `RequireActiveClient` only checks presence of a selected client; it does not validate local/global state drift.

### CRM metrics and compatibility layers

Status: acceptable but rough

Evidence:
- `src/components/AccountsTab.tsx`
- `src/utils/accountsLeadsSync.ts`
- `server/src/routes/customers.ts`

Actual contract:
- Customer patch/save truth is backend-driven.
- Account metric display still uses compatibility mirrors in local storage for some lead counts.
- The component still contains old fallback/merge behavior from the local-storage era.

### Readiness vs onboarding vs daily ops

Status: acceptable but rough

Evidence:
- `src/tabs/onboarding/OnboardingHomePage.tsx`
- `src/tabs/onboarding/CustomerOnboardingTab.tsx`
- `src/tabs/marketing/components/ReadinessTab.tsx`
- `src/utils/clientReadinessState.ts`

Actual contract:
- Onboarding stores customer setup data.
- Readiness interprets operational state and points to next actions.
- Both surfaces are useful, but the concepts still overlap.

## What Is Misleading

### Sequences and send operations UI

Status: misleading

Evidence:
- `src/tabs/marketing/components/SequencesTab.tsx`
- `src/tabs/marketing/components/SchedulesTab.tsx`
- `server/src/routes/sendWorker.ts`
- `server/src/routes/enrollments.ts`

Actual contract:
- The backend send path is coherent.
- The frontend still mixes sequence authoring, enrollment management, dry-run, launch preview, queue workbench, audits, test send, and live tick controls in one enormous surface.

### Reports

Status: misleading

Evidence:
- `src/tabs/marketing/components/ReportsTab.tsx`
- `server/src/routes/reports.ts`

Actual contract:
- Reports are client-scoped correctly.
- `/api/reports/outreach` is a real aggregate route.
- If reply/opt-out event query support is unavailable, the route falls back to zero for those metrics.

## What Is Broken

### Lead truth is still fragile

Status: broken

Evidence:
- `server/src/workers/leadsSync.ts`
- `server/src/services/leadCanonicalMapping.ts`
- `server/src/routes/leads.ts`
- `server/src/routes/liveLeads.ts`
- `server/src/utils/liveSheets.ts`

Actual contract:
- Recent fixes corrected real production count bugs, but they did so by iterating on heuristic classification and table-boundary logic.
- There is still no single compact lead-truth contract shared across all sheet-backed read and write paths.

### Oversized files are hiding real regressions

Status: broken

Evidence:
- `src/components/AccountsTab.tsx`
- `src/tabs/marketing/components/SequencesTab.tsx`
- `server/src/routes/sendWorker.ts`

Actual contract:
- These files are doing too much.
- Recent bug history maps directly onto these oversized surfaces.

## Top Risks

1. Sheet-backed lead truth remains heuristic-heavy.
2. Frontend client-scoping drift can still reintroduce header mismatch bugs.
3. Oversized operator surfaces are still regression magnets.
4. Reports can look more authoritative than they really are.
5. Readiness is helpful, but not yet a single operational source of truth.
6. Local compatibility count mirrors still exist in the CRM side.
7. Inbox grouping/pagination will become a scale issue.
8. Runtime deploy skew is handled operationally, not structurally.

## Section-By-Section Deep Findings

### A. Global Platform / Shell

Intended contract:
- Tab shell plus auth should establish the current operator mode and customer scope.

Actual code contract:
- `src/App.tsx` uses query/path state, not real app routing.
- Auth is Microsoft-backed and then ODCRM-authorized through `/api/users/me`.
- `src/utils/api.ts` injects `X-Customer-Id` unless the caller overrides it.
- Client mode is enforced by `fixedCustomerId` from `/api/me`.

Assessment:
- Solid backend enforcement.
- Rough frontend state model.

### B. Customers / Accounts / CRM Core

Actual code contract:
- Accounts edits use backend truth.
- Contacts are customer-scoped and simpler.
- Leads surfaces are now stronger than Accounts in architectural clarity.

Assessment:
- Functionally coherent.
- Architecturally uneven.

### C. Onboarding

Actual code contract:
- Onboarding form is DB-backed and autosave-aware.
- Progress tracking is also persisted.
- Readiness bridge is present.

Assessment:
- Useful, but conceptually overlaps with readiness and client-health messaging.

### D. Marketing

Readiness:
- Useful but still diagnostic-heavy.

Reports:
- Client-scoped and real, but still route-aggregate shaped.

Lead Sources:
- Coherent now and one of the strongest operator flows.

Suppression / Compliance:
- Coherent, tenant-safe, and product-grade enough.

Email Accounts:
- Truthful enough, though mailbox health still reads like diagnostics more than a full mailbox-ops model.

Templates:
- Coherent and safe.

Sequences:
- Backend-safe, frontend-heavy.

Schedules:
- Real operator screen, but still partially a projection of send-worker truth rather than a full planning model.

Inbox:
- Production-usable, but still needs stronger scaling/filtering.

## Does This Behave Like A Real Outreach Platform?

Yes, with qualifications.

It behaves like a real outreach platform in the areas that matter most for production safety:
- tenant isolation
- send guardrails
- suppression/unsubscribe handling
- server-backed templates
- scalable list handling on the main sheet-backed surfaces

It does not yet behave like a polished, unified outreach product:
- too much state duplication
- too many oversized control surfaces
- too much diagnostic leakage into operator tabs
- too much lead-truth fragility around Google Sheets
