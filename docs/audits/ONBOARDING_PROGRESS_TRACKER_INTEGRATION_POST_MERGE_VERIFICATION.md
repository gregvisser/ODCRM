# Onboarding + Progress Tracker Integration — Post-merge verification

**Date:** 2026-03-22 (UTC)

## PR

| Field | Value |
| --- | --- |
| **PR** | [#346](https://github.com/gregvisser/ODCRM/pull/346) |
| **Merge SHA** | `3017d7aa44dc29b8a69eb7d50687e8a9c4fe3777` |
| **Merge commit message** | `feat: integrate progress tracker into onboarding (#346)` |

## Production parity (`scripts/prod-check.cjs`)

**Command:**

```text
npx --yes cross-env EXPECT_SHA=3017d7aa44dc29b8a69eb7d50687e8a9c4fe3777 node scripts/prod-check.cjs
```

**Result:** Exit **0** — `PARITY_STATE: PARITY_OK (parity achieved)`

| Endpoint | SHA |
| --- | --- |
| Frontend `https://odcrm.bidlow.co.uk/__build.json` | `3017d7aa44dc29b8a69eb7d50687e8a9c4fe3777` |
| Backend `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build` | `3017d7aa44dc29b8a69eb7d50687e8a9c4fe3777` |

**Notes:** First parity attempt immediately after merge showed both FE/BE on prior SHA (`ff8d545…`); after GitHub Actions deploys completed, parity succeeded.

## GitHub Actions

- **Deploy Frontend to Azure Static Web Apps** (run associated with merge push): **success**
- **Deploy Backend to Azure App Service**: **success**
- **Prod parity after merge**: **success**

## Focused smoke verification (truthful limits)

| Check | Result |
| --- | --- |
| App loads in production | **Yes** — `https://odcrm.bidlow.co.uk/?tab=onboarding` returns the Microsoft sign-in shell (no white screen). |
| Full onboarding UI / integrated checklist | **Not exercised** — requires authenticated session; not verified in this pass. |
| Standalone Progress Tracker tab removed from product code | **Yes** — verified via source inspection on `main` at merge SHA (see grep summary). |
| Dashboard top-level tab (`reporting-home`) | **Unchanged contract** — redirect handler remains in `App.tsx`; nav tests assert tab absent. |
| English-only / no i18n layer in `src` | **No** `LocaleContext`, `useLocale`, or `src/i18n` references under `src/` (grep). |

## Repo grep summary (post-merge `main`)

Patterns run on workspace; **intentional** vs **stale** called out below.

### `ProgressTrackerTab`

- **`src/`:** **No matches** — component file deleted; no imports.
- **Intentional elsewhere:** Historical docs (`PROGRESS-TRACKER-*.md`, `WORKFLOW-SAFETY-AUDIT.md`, audits), `scripts/self-test-onboarding-ui-flow-runtime.mjs` (asserts absence in `OnboardingHomePage.tsx`).

### `progress-tracker` / “Progress Tracker” (TS/TSX/JS)

- **Intentional:** REST route `PUT /api/customers/:id/progress-tracker`, `OnboardingProgressSections.tsx` client calls, `progressAutoTick.ts` / `customers.ts` comments, self-test negative assertions.

### `progressTrackerMeta`

- **Intentional:** Server service, UI (`OnboardingProgressSections.tsx`), self-tests, audit docs — persisted JSON metadata for checklist items.

### `ops_create_emails`

- **Intentional:** Comment in `progressTrackerItems.ts` explaining removal; audit doc row. Legacy JSON keys may still exist in old customer data (documented in integration audit).

### `reporting-home`

- **Intentional:** `App.tsx` bookmark redirect for removed Dashboard tab; `server/tests/dashboard-scope-and-period.test.ts` guard; audit/docs.

### `LocaleContext` / `src/i18n`

- **Docs only** (historical language-selector removal); **`src/`** has **no** matches. No `src/i18n` directory in repo.

## Conclusion

Progress tracker checklist behavior is **integrated into onboarding** (single onboarding surface; **`ProgressTrackerTab.tsx` removed** from the codebase). Persistence and API routes for `progressTracker` / `progressTrackerMeta` remain by design. Production **frontend and backend build SHAs match** merge commit `3017d7aa44dc29b8a69eb7d50687e8a9c4fe3777` with **PARITY_OK**.

**Follow-up (smallest, optional):** Refresh stale docs that still reference `ProgressTrackerTab.tsx` paths (e.g. older audits / `odcrm-visual-map.md`) so ground-truth docs match the integrated UI — **non-blocking** for product behavior.
