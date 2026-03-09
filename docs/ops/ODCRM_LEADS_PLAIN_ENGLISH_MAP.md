# ODCRM Leads Source-of-Truth Plain-English Map

## What it does now

ODCRM runs a per-client source-of-truth rule for leads:
- If a client has a configured leads Google Sheet (`leadsReportingUrl`), live leads APIs treat Google Sheets as authoritative for that client/section.
- If a client does not have a configured leads Google Sheet, ODCRM DB is authoritative.
- Stale/cached fallback is diagnostic-only and requires an explicit diagnostic flag; it is not default truth.

Evidence status:
- Repo/runtime-proven: yes (live leads routes and UI state handling).
- Greg-confirmed live setup: consistent with this contract.

## What is wired to what

Current wiring (repo-proven):
- Customer config in ODCRM stores leads sheet linkage fields (`leadsReportingUrl`, `leadsGoogleSheetLabel`).
- Live leads reads/metrics endpoints branch source-of-truth by that customer config.
- Frontend live leads hooks consume source metadata (`sourceOfTruth`, `authoritative`, `dataFreshness`) and render status/messaging.
- Dashboard KPI cards for leads use the live leads metrics path and expose truth-state messaging.
- Marketing lead-source operational flows are sheet-centric where sheet-backed setup is active.

## What ODCRM controls today

Repo/runtime-proven:
- Tenant scoping and request context (`X-Customer-Id`) for multi-tenant data access.
- Customer-level lead-sheet configuration fields.
- Source-of-truth branch selection at runtime (sheet-backed vs DB-backed).
- API response truth metadata (`authoritative`, freshness flags, diagnostic fallback indicators).
- UI messaging when a dataset is authoritative vs non-authoritative.

Not claimed as universal ODCRM ownership today:
- For sheet-backed clients/sections, ODCRM is not the final record of lead truth; it brokers and surfaces sheet-derived truth.

## What Google Sheets controls today

Repo/runtime-proven for configured clients/sections:
- Lead truth for sheet-backed paths (including lead-source related structures used by marketing flows).
- Operational edits/updates that are expected to originate or persist in Sheets during transition.

Greg-confirmed live setup:
- Google Sheets remains active in current operations and must stay supported during transition.

## What Dashboard does

Repo/runtime-proven:
- Uses live lead metrics APIs.
- Displays KPI values with source/truth status context.
- Distinguishes authoritative live data from diagnostic stale fallback states.

Inferred but not fully repo-proven:
- Exact operator decision policy for every KPI when non-authoritative states appear (UI messaging exists; operator SOP may also exist outside repo docs).

## What Reports does

Repo/runtime-proven:
- Reporting routes/tabs exist and include outreach/contact/event reporting paths.
- Lead truth branching is explicit in live leads routes; not all reporting routes appear to be first-class lead truth arbiters.

Inferred but not fully repo-proven:
- Full business interpretation of "Reports" as a single canonical lead source across all report types.

## What Customers does

Repo/runtime-proven:
- Customers management includes fields to configure leads sheet URL/label.
- Those fields drive whether that customer is treated as sheet-backed vs DB-backed for leads flows.

Operational implication:
- Customer record setup is the switch that determines which truth path is active for that client/section.

## What Marketing / Lead Sources does

Repo/runtime-proven:
- Marketing lead-source surfaces and backend routes are designed around sheet-linked source structures in the current transition model.
- Lead source handling remains strongly tied to Google Sheets-backed data where configured.

Greg-confirmed business direction:
- This sheet dependency is transitional, not the final end state.

## What is real

Repo/runtime-proven current rule:
- Sheet configured => Sheets authoritative.
- No sheet configured => DB authoritative.
- Diagnostic stale fallback is explicit-only, not default truth.

Greg-confirmed as live business setup:
- Transition model is active in production operations.

## What is transitional

Repo/runtime-proven + docs-proven:
- Mixed-mode operation (some client/sections on Sheets, others on DB).
- Lead-source and related marketing flows still include sheet-first mechanics for sheet-backed clients.

Greg-confirmed:
- Transition period allows activity in ODCRM and Google Sheets, with Sheets still supported.

## What is target future direction

Greg-confirmed business direction:
- ODCRM should become the main operational source of truth for leads.
- Google Sheets remains supported during transition.
- ODCRM should evolve to first-class lead management with manual/scheduled exports back to Sheets as needed.

Repo docs alignment:
- Product transition/target docs describe this trajectory.

## Safe next cleanup ideas

1. Add one shared UI tooltip/text token wherever lead truth is shown so all tabs use identical wording for sheet-backed vs DB-backed states.
2. Add a lightweight operator-facing matrix (client/section -> current truth mode) generated from customer config to reduce ambiguity.
3. Add a small docs cross-link from Dashboard/Marketing tabs to this map so operators can resolve "why this source" quickly.
4. Keep diagnostic fallback language explicitly non-authoritative in every lead-facing screen copy.

## Evidence basis

Primary repo/runtime surfaces used for this map:
- `server/src/routes/liveLeads.ts`
- `server/src/routes/leadSources.ts`
- `server/src/routes/overview.ts`
- `server/src/routes/reports.ts`
- `server/src/routes/customers.ts`
- `src/utils/liveLeadsApi.ts`
- `src/tabs/dashboards/DashboardsHomePage.tsx`
- `src/components/LeadsTab.tsx`
- `src/components/LeadsReportingTab.tsx`
- `src/components/MarketingLeadsTab.tsx`
- `src/tabs/marketing/components/LeadSourcesTab.tsx`
- `src/components/CustomersManagementTab.tsx`
- `docs/product/ODCRM_LEAD_TRUTH_CURRENT_STATE.md`
- `docs/product/ODCRM_LEAD_SOURCE_OF_TRUTH_TARGET.md`
- `docs/product/ODCRM_LEAD_SYNC_TRANSITION_PLAN.md`
- `docs/product/ODCRM_LEAD_IMPLEMENTATION_STAGES.md`
- `docs/product/ODCRM_LEAD_CONFLICT_RULES.md`
