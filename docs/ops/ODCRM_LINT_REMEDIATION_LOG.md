# ODCRM Lint Remediation Log

## Session: Post-PR #169 Dashboard Regression + Full Lint Pass
- Date: 2026-03-08
- Baseline SHA: `39546c59bec16fbb4c4e2f965c48ad837b08fc18`
- Baseline lint: `50 problems / 22 errors / 28 warnings`

## Work Log

| Cluster | File(s) | Rule(s) | Status | Behavior change | Verification | Notes / Next action |
|---|---|---|---|---|---|---|
| Baseline capture | Repo-wide | Mixed (baseline inventory) | Logged | No | `npm run lint` | Proceeding with dashboard regression root-cause fix first, then full lint remediation. |
| Dashboard regression + contract stabilization | `src/tabs/dashboards/DashboardsHomePage.tsx`, `scripts/self-test-dashboard-regression-runtime.mjs`, `package.json` | Product regression, runtime proof gap | Fixed | Yes (intended) | Dashboard proof bundle + full gates | Root cause: KPI cards depended on single selected-client metrics path, causing cross-device divergence when selected-client context differed. Fixed by aggregating backend metrics across current customer scope. |
| Regex lint hard errors | `server/src/lib/enrichment/bing.ts`, `server/src/types/leads.ts`, `server/src/workers/leadsSync.ts` | `no-useless-escape`, `no-control-regex` | Fixed | No | `npm run lint` | Normalized regex patterns and control-char sanitizer. |
| Hook ordering hard error | `src/hooks/useDatabaseFirst.ts` | `react-hooks/rules-of-hooks` | Fixed | No | `npm run lint` | `useToast` is now called unconditionally; toast display remains gated by `showToasts`. |
| Constant expression hard error | `src/components/AccountsTab.tsx` | `no-constant-binary-expression` | Fixed | No | `npm run lint` | Replaced `false && (...)` with explicit feature flag constant. |
| Useless catch hard error | `src/tabs/onboarding/components/CompleteOnboardingButton.tsx` | `no-useless-catch` | Fixed | No | `npm run lint` | Removed rethrow-only wrapper, preserved error propagation semantics. |
| Low-risk warning cleanup batch | `server/scripts/test-onboarding-non-destructive-save.cjs`, `src/components/AccountsTab.tsx`, `src/components/EmailAccountsEnhancedTab.tsx`, `src/tabs/onboarding/OnboardingHomePage.tsx`, `src/tabs/customers/CustomersHomePage.tsx`, `src/components/LeadsTab.tsx`, `src/components/LeadsReportingTab.tsx`, `src/components/MarketingLeadsTab.tsx` | `react-hooks/exhaustive-deps`, stale directive warning | Fixed | No | `npm run lint` | Added safe deps, memoized lead arrays, removed unused eslint directive. |

## Remaining Lint Items (Post-Remediation)

| File | Rule | Fixed? | Why not fully fixed in this pass | Risk | Recommended next action |
|---|---|---|---|---|---|
| `src/components/DataTable.tsx` | `react-hooks/incompatible-library` | No | Warning is emitted because `useReactTable()` is intentionally incompatible with React Compiler memoization heuristics; not a functional bug. | Low | Keep as accepted warning unless migrating table abstraction or disabling React Compiler checks for this component by policy. |
| `src/hooks/useUsersFromDatabase.ts` | `react-hooks/exhaustive-deps` (`migrateFromLocalStorage`) | No | Current `fetchUsers` and `migrateFromLocalStorage` callbacks are mutually recursive; adding dependency directly causes declaration-order/circular callback churn. | Medium | Refactor with a stable internal async function or `useRef` dispatcher to break callback cycle cleanly. |
| `src/tabs/marketing/components/CampaignsTab.tsx` | `react-hooks/exhaustive-deps` | No | Mount effect invokes non-memoized loaders (`loadFormOptions`, `maybeOpenFromSnapshot`). Adding deps without refactor risks repeated reload loops. | Medium | Convert loaders to `useCallback` and move mount/init effect below definitions with explicit deps. |
| `src/tabs/marketing/components/LeadSourcesTab.tsx` | `react-hooks/exhaustive-deps` (2 warnings) | No | Effects call non-memoized `loadCustomers`/`loadSources`; direct dep addition can increase reload churn. | Medium | Wrap loaders in `useCallback` and tighten effect triggers around customer changes. |
| `src/tabs/marketing/components/SchedulesTab.tsx` | `react-hooks/exhaustive-deps` | No | Mount effect uses non-memoized `loadData`; direct dep addition risks repeated loads. | Medium | Memoize `loadData` and update effect deps. |
| `src/tabs/marketing/components/SequencesTab.tsx` | `react-hooks/exhaustive-deps` (4 warnings) | No | Initialization effects currently rely on mount-only semantics with non-memoized loaders. | Medium | Introduce `useCallback` for `loadAuditSummary`, `maybeOpenFromSnapshot`, `loadData`, `loadFormOptions` and use explicit init effect guards. |
| `src/tabs/marketing/components/TemplatesTab.tsx` | `react-hooks/exhaustive-deps` | No | Mount/data-load effect references non-memoized `loadData`; direct dep addition may alter load cadence. | Medium | Convert `loadData` to `useCallback` and update effect deps. |
