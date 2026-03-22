# Post-merge verification — Dashboard tab removal (PR #345)

**Date:** 2026-03-22  
**PR:** [#345](https://github.com/gregvisser/ODCRM/pull/345) — refactor: remove dashboard tab  
**Merge commit:** `5699b931c85a80d5bf78ec4361701117a6f836ff`

## Local `main`

- `git fetch` / `git pull` fast-forwarded to merge commit `5699b931c85a80d5bf78ec4361701117a6f836ff` (HEAD matches `origin/main` at verification time).

## Production parity (`prod-check`)

Command:

```text
PARITY_MAX_ATTEMPTS=60 PARITY_RETRY_DELAY_MS=10000 \
  npx --yes cross-env EXPECT_SHA=5699b931c85a80d5bf78ec4361701117a6f836ff node scripts/prod-check.cjs
```

| Check | Result |
|--------|--------|
| Exit code | **0** |
| Final state | **PARITY_OK** (attempt **1/60**) |
| Frontend `https://odcrm.bidlow.co.uk/__build.json` | `sha`: **5699b931c85a80d5bf78ec4361701117a6f836ff** |
| Backend `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build` | `sha`: **5699b931c85a80d5bf78ec4361701117a6f836ff** |

## Live smoke (public / unauthenticated signals)

- **Deploy:** Build endpoints prove the merged SHA is what production serves.
- **Top nav “Dashboard”:** Not asserted via full UI (requires sign-in). Supporting check: downloaded main bundle `index-EKMMIOov.js` contains **no** top-level `reporting-home` tab in the nav list; it **does** contain the intentional `tab=== "reporting-home"` branch that redirects to **Clients** (`customers-home` + `accounts`), and legacy keys `reporting` / `dashboard` mapping to **Marketing** `reports` view.
- **Default landing:** Bundle shows initial tab state `customers-home` and view `accounts` (unchanged product default).
- **Marketing → Reports:** Not interactively verified without an authenticated session; **ReportsTab** remains in source and was not removed in PR #345.
- **Blank shell / redirect:** No errors from `__build.json` or `/api/_build`; standard index loads the app module.

## Repo grep (post-merge `main`)

Scoped to application code (`src`, `scripts` self-tests, `server/tests`):

| Pattern | In product source? |
|---------|---------------------|
| `ReportingHomePage` | **No** |
| `ReportingDashboard` | Only in `server/tests/dashboard-scope-and-period.test.ts` (asserts ReportsTab does **not** import it) and `scripts/self-test-reports-tab-runtime.mjs` (same guard) |
| `DashboardTab` / `MarketingDashboard` | **No** in `src` (removed) |
| `reporting-home` | **`src/App.tsx`** only: comment + URL param handler redirecting old bookmarks to Clients |

Historical **markdown** docs may still mention removed files by name; not operational code.

## Conclusion

- **Parity:** Confirmed — frontend and backend production build SHAs match merge commit `5699b931c85a80d5bf78ec4361701117a6f836ff`.
- **Product:** The **Dashboard** top-level tab (`reporting-home`) is **not** a deployable nav surface in this build; legacy query handling remains safe.
