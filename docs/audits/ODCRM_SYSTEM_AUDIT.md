# ODCRM System Audit

## Executive Summary
ODCRM is a multi-module CRM SaaS with strong Marketing execution depth and weaker whole-system flow orchestration across Dashboard, Clients, Onboarding, and Settings. The application is tenant-safe by design (strict `X-Customer-Id`, active-client guardrails, client-mode fixed tenant) and already has broad runtime proof coverage. The most mature daily-use module is OpenDoors Marketing; the most fragmented journey is cross-module handoff after sign-in.

## Current Product Shape
Top-level navigation is contract-based in [`src/contracts/nav.ts`](../../src/contracts/nav.ts) and rendered from [`src/App.tsx`](../../src/App.tsx):

1. Dashboards (`/dashboards`)
2. OpenDoors Clients (`/customers`)
3. OpenDoors Marketing (`/marketing`)
4. Onboarding (`/onboarding`)
5. Settings (`/settings`)

Route mounts in [`server/src/index.ts`](../../server/src/index.ts) confirm broad backend surfaces (`/api/customers`, `/api/onboarding`, `/api/reports`, `/api/send-worker`, `/api/send-queue`, `/api/inbox`, `/api/schedules`, `/api/templates`, `/api/lead-sources`, `/api/suppression`, `/api/outlook`, `/api/users`, etc.).

## Tenant And Trust Model (Verified)
- Frontend request layer sets `X-Customer-Id` from active client or fixed client mode only ([`src/utils/api.ts`](../../src/utils/api.ts)).
- No silent first-customer default in client selection state ([`src/platform/stores/settings.ts`](../../src/platform/stores/settings.ts)).
- Tenant-scoped UI is wrapped by [`RequireActiveClient`](../../src/components/RequireActiveClient.tsx) and [`NoActiveClientEmptyState`](../../src/components/NoActiveClientEmptyState.tsx).
- Backend enforces customer id / client mode constraints via [`server/src/utils/tenantId.ts`](../../server/src/utils/tenantId.ts).

## Top-Level Navigation Inventory

| Area | Primary Page | Core Sub-views | Primary Backend Truth | State |
| --- | --- | --- | --- | --- |
| Dashboard | `DashboardsHomePage` | KPI stats, lead source split, account table | `/api/customers`, live leads hooks | Usable but hard to follow |
| OpenDoors Clients | `CustomersHomePage` | Accounts, Contacts, Leads | `/api/customers`, `/api/contacts`, leads endpoints | Usable but hard to follow |
| OpenDoors Marketing | `MarketingHomePage` | 9-tab operator suite incl. readiness/sequences/inbox | `/api/send-worker/*`, `/api/send-queue/*`, `/api/inbox/*`, reports, templates, sheets | Complete |
| Onboarding | `OnboardingHomePage` | Overview, Progress Tracker, Client Onboarding | `/api/onboarding/readiness`, customer onboarding routes | Partial (strong pieces, weak handoff) |
| Settings | `SettingsHomePage` | User Authorization | `/api/users`, user preference routes | Partial (admin-only narrow scope) |

## Area-By-Area Audit

### 1) Dashboard
- Purpose: operational KPI snapshot for selected client.
- Evidence: [`src/tabs/dashboards/DashboardsHomePage.tsx`](../../src/tabs/dashboards/DashboardsHomePage.tsx).
- Current implementation:
  - Pulls customer and live lead data (`useLiveLeadsPolling`, customer sync).
  - Shows totals, percentages, source categorization, account-level table.
- Current state: **USABLE BUT HARD TO FOLLOW**.
- Entry/exit flow:
  - Entry: default post-auth top tab from App.
  - Exit expected: into Clients (data fixes) or Marketing (execution).
  - Gap: weak explicit handoff CTAs into those next steps.
- UX quality: rich data, but mixed admin/debug language and limited explicit “do next”.
- Recommendation: **Polish + add stronger handoff cues**, keep as default landing.

### 2) OpenDoors Clients
- Purpose: maintain customer account/contact truth and lead context.
- Evidence: [`src/tabs/customers/CustomersHomePage.tsx`](../../src/tabs/customers/CustomersHomePage.tsx), large account/contact tabs in `src/components`.
- Current implementation:
  - Sub-nav: Accounts, Contacts, Leads reporting.
  - Heavy data operations and CRM maintenance capabilities.
- Current state: **USABLE BUT HARD TO FOLLOW** (high capability, dense surface).
- Entry/exit flow:
  - Entry: from Dashboard or onboarding setup needs.
  - Exit expected: Onboarding completion or Marketing sequence operations.
  - Gap: practical in-app handoffs to onboarding/marketing readiness are inconsistent.
- UX quality: powerful, but feels closer to power-user/admin tooling.
- Recommendation: **Rewire flow cues** from maintenance actions toward onboarding/marketing next steps.

### 3) OpenDoors Marketing
- Purpose: daily outreach operations execution.
- Evidence: [`src/tabs/marketing/MarketingHomePage.tsx`](../../src/tabs/marketing/MarketingHomePage.tsx) and component suite; backend send-worker/send-queue/report/inbox routes.
- Current implementation:
  - Cohesive operational chain: readiness, preflight, launch preview, queue workbench/remediation, run history, comparison, exception center, identity capacity, inbox reply/send, reports.
  - Extensive runtime proofs in `scripts/self-test-*marketing*`, `*sequences*`, `*inbox*`, `*exception*`, etc.
- Current state: **COMPLETE** (with ongoing polish potential only).
- Entry/exit flow:
  - Entry: from Dashboard (daily action) and from readiness triggers.
  - Exit expected: back to Reports for review or Clients for upstream data corrections.
  - Existing handoffs: readiness/reports/inbox/sequences cross-links present.
- UX quality: strongest employee-facing module in current product.
- Recommendation: **Keep as daily operations home module**.

### 4) Onboarding
- Purpose: initial client setup and readiness tracking.
- Evidence: [`src/tabs/onboarding/OnboardingHomePage.tsx`](../../src/tabs/onboarding/OnboardingHomePage.tsx), [`ProgressTrackerTab.tsx`](../../src/tabs/onboarding/ProgressTrackerTab.tsx), [`CustomerOnboardingTab.tsx`](../../src/tabs/onboarding/CustomerOnboardingTab.tsx).
- Current implementation:
  - Customer selector (non-client mode), overview, progress tracker, and conditional client onboarding form when customer selected.
  - Clear guidance when no customer selected.
- Current state: **PARTIAL**.
- Entry/exit flow:
  - Entry: new client or setup updates.
  - Exit expected: to Marketing readiness/sequences once setup complete.
  - Gap: completion handoff into Marketing daily flow could be stronger and more deterministic.
- UX quality: structured but still split between setup and operational context.
- Recommendation: **Polish + stronger completion-to-operations bridge**.

### 5) Settings
- Purpose: administrative access control.
- Evidence: [`src/tabs/settings/SettingsHomePage.tsx`](../../src/tabs/settings/SettingsHomePage.tsx), [`src/components/UserAuthorizationTab.tsx`](../../src/components/UserAuthorizationTab.tsx).
- Current implementation:
  - Single sub-tab focused on user authorization management.
- Current state: **PARTIAL** (intentionally narrow).
- Entry/exit flow:
  - Entry: admin tasks only.
  - Exit expected: return to active operational area.
  - Gap: none critical; positioning clarity is main need.
- UX quality: admin-oriented, not daily employee flow.
- Recommendation: **Keep as setup/admin area and demote in daily-flow guidance**.

## Strong Areas
- Tenant isolation guardrails are explicit and consistent.
- Marketing control-plane is deep and increasingly operator-usable.
- Runtime proof coverage is broad and practical for production confidence.
- Inbox receive/respond is integrated into Marketing operations.

## Weak / Confusing Areas
- System-level “where to go next” after sign-in remains under-specified outside Marketing.
- Dashboard and Clients are information-dense with weaker action-first framing.
- Onboarding completion handoff into Marketing daily routine is not explicit enough.
- Settings is correctly admin-focused but can feel equivalent in prominence to daily-use modules.

## Current System Risks
1. New/normal employees may bounce between Dashboard/Clients/Onboarding without a clear operational path.
2. Setup tasks and daily operations are mixed in navigation prominence.
3. Some modules prioritize data density over explicit next action guidance.
4. Cross-module transitions depend on user intuition more than guided pathways.
5. Operational trust can degrade if handoffs to remediation paths are not visible at decision points.

## What Already Works Well
- Marketing operational chain from readiness to outcome verification.
- Inbox integration for execution feedback loop.
- Strict no-fallback tenant behavior.
- Route surface maturity across onboarding, reporting, sending, identities, and scheduling.

## Audit Confidence / Unknowns
- Confidence: **High** for architecture, route surfaces, tenant constraints, and Marketing maturity.
- Medium-confidence areas needing runtime walkthrough in next phase: actual employee cognition on Dashboard/Clients/Onboarding transitions under low-data states.
- Unknowns are minimal and not blockers to next-phase planning.
