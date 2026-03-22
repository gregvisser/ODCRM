# Dashboard tab removal (top-level `reporting-home`)

**Branch:** `codex/remove-dashboard-tab`  
**Start SHA (`origin/main` at branch):** `12ea7339bbf2c5cfd98cc3f67df4b18167054f6e`

## References found (pre-change audit)

| Area | Finding |
|------|---------|
| `src/contracts/nav.ts` | `reporting-home` tab labeled **Dashboard**, path `/reporting` |
| `src/App.tsx` | `DashboardHomePage`, legacy `reporting`/`dashboard` → reporting-home, switch case `reporting-home` |
| `src/tabs/reporting/ReportingHomePage.tsx` | Wrapper exporting `DashboardHomePage`, renders `ReportingDashboard` |
| `src/tabs/marketing/components/ReportingDashboard.tsx` | Large operator dashboard UI (`/api/reporting/*`) |
| `src/components/DashboardTab.tsx` | Unused demo component (not wired to nav) |
| `src/components/MarketingDashboard.tsx` | Unused |
| `scripts/self-test-reporting-home-runtime.mjs` | Nav/App/ReportingHome/ReportingDashboard contract checks |
| `scripts/self-test-dashboard-all-clients-runtime.mjs` | ReportingDashboard markers |
| `package.json` | `test:dashboard-home-runtime`, `test:reporting-home-runtime`, `test:dashboard-all-clients-runtime` |
| `server/tests/dashboard-scope-and-period.test.ts` | Read `ReportingDashboard.tsx`; asserted Dashboard first in nav |
| Backend `server/src/routes/reporting.ts` | **Kept** — API remains for other consumers / future use |

## Files removed

- `src/tabs/reporting/ReportingHomePage.tsx`
- `src/tabs/marketing/components/ReportingDashboard.tsx`
- `src/components/DashboardTab.tsx`
- `src/components/MarketingDashboard.tsx`
- `scripts/self-test-reporting-home-runtime.mjs`
- `scripts/self-test-dashboard-all-clients-runtime.mjs`

## Files modified

- `src/contracts/nav.ts` — removed `reporting-home` from tab union and `CRM_TOP_TABS`
- `src/App.tsx` — removed Dashboard route; legacy `reporting` / `dashboard` query maps to Marketing **Reports**; `?tab=reporting-home` redirects to **Clients** (`customers-home` + `accounts`)
- `src/tabs/marketing/components/ReportsTab.tsx` — renamed `data-testid` from `reports-go-dashboard-triage` to `reports-go-marketing-readiness`
- `scripts/self-test-dashboard-reports-role-separation-runtime.mjs` — marker updated to match new ReportsTab `data-testid`
- `package.json` — removed npm scripts that pointed at deleted self-tests
- `server/tests/dashboard-scope-and-period.test.ts` — dropped frontend file reads for deleted `ReportingDashboard.tsx`; kept reporting route + Marketing Reports guards; added nav check that `reporting-home` is absent
- `docs/audits/LANGUAGE_SELECTOR_STALE_REFERENCE_CLEANUP.md` — note that reporting-home self-test script removed with this work

## Intentionally kept

- **`server/src/routes/reporting.ts`** and `/api/reporting/*` — no schema change; endpoints remain available for API clients and smoke scripts (e.g. `self-test-reporting-dashboard-runtime.mjs`).
- **Historical docs** under `docs/audits/*` that still mention the old Dashboard in narrative form (not updated in bulk; avoid unrelated doc churn).

## Default landing behavior

- Unchanged from prior product behavior for normal loads: **Clients** (`customers-home`, default view `accounts`) per existing `App.tsx` root path handling.
- Old **`?tab=reporting-home`** URLs: redirected to Clients home (`customers-home`, view `accounts`) so bookmarks do not crash.

## Proof searches (after cleanup)

Run on `src`, `scripts`, `server` (excluding this audit file):

- `reporting-home` — **only** in `App.tsx` deprecation handler and in tests/docs as described above
- `ReportingDashboard` / `DashboardHomePage` / `ReportingHomePage` — **no** matches in `src` application code

## Confirmation

The **Dashboard** top-level tab (`reporting-home`) is no longer part of the CRM nav contract or `App.tsx` switch; the operator UI that lived in `ReportingDashboard.tsx` is removed from the frontend bundle.
