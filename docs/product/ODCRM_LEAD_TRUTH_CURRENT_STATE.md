# ODCRM Lead Truth Current State

## Scope
Current-state lead truth behavior in ODCRM as implemented after PR #163.

## Binding Contract (Current)
1. Google Sheets-backed client/section => Google Sheets truth (via backend ingestion/read surfaces).
2. Non-sheet-backed client/section => DB truth.
3. Stale/cached payloads are diagnostic-only, not default authoritative truth.

## Active Truth Paths
## 1) Live leads truth route
- Route: `GET /api/live/leads?customerId=...` in [server/src/routes/liveLeads.ts](/C:/CodeProjects/Clients/Opensdoors/ODCRM/server/src/routes/liveLeads.ts)
- Behavior:
  - If `customer.leadsReportingUrl` exists: sourceOfTruth=`google_sheets`, backend normalizes sheet URL to export CSV and fetches live rows.
  - If no sheet URL: sourceOfTruth=`db`, backend reads `leadRecord` rows.
- Error contract includes actionable classifications (for example `SHEET_NOT_FETCHABLE_AS_CSV`) and hints.

## 2) Live metrics truth route
- Route: `GET /api/live/leads/metrics?customerId=...` in [server/src/routes/liveLeads.ts](/C:/CodeProjects/Clients/Opensdoors/ODCRM/server/src/routes/liveLeads.ts)
- Provides counts and breakdowns from the same source-of-truth mode (sheet-backed or db-backed).

## 3) Frontend consumers
- Hook/API: [src/utils/liveLeadsApi.ts](/C:/CodeProjects/Clients/Opensdoors/ODCRM/src/utils/liveLeadsApi.ts)
- Main surfaces:
  - [src/components/LeadsTab.tsx](/C:/CodeProjects/Clients/Opensdoors/ODCRM/src/components/LeadsTab.tsx)
  - [src/components/LeadsReportingTab.tsx](/C:/CodeProjects/Clients/Opensdoors/ODCRM/src/components/LeadsReportingTab.tsx)
  - [src/components/MarketingLeadsTab.tsx](/C:/CodeProjects/Clients/Opensdoors/ODCRM/src/components/MarketingLeadsTab.tsx)
- These surfaces now expose source-of-truth mode and actionable setup/access guidance.

## 4) Lead Sources and suppression (sheet-linked)
- Lead Sources route group: [server/src/routes/leadSources.ts](/C:/CodeProjects/Clients/Opensdoors/ODCRM/server/src/routes/leadSources.ts)
- Suppression route group: [server/src/routes/suppression.ts](/C:/CodeProjects/Clients/Opensdoors/ODCRM/server/src/routes/suppression.ts)
- Lead Sources remain Google Sheets-linked in current operating model.

## Transitional Limitations
- ODCRM is not yet full native source-of-truth for all lead editing operations.
- Bidirectional ODCRM<->Sheets conflict reconciliation is not yet fully implemented as a first-class domain workflow.
- Some sections already use DB truth where sheet backing is absent, but cross-surface ownership semantics are still transitional.

## Runtime Evidence Anchors
- `test:google-sheets-data-plane-runtime`
- `test:source-of-truth-contract-runtime`
- `test:lead-sheets-connection-contract-runtime`
- `test:customers-leads-reporting-truth-runtime`
- `test:customers-leads-view-runtime`
