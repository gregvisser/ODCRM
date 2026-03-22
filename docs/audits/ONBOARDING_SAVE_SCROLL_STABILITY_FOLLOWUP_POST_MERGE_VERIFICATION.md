# Onboarding save scroll stability — Post-merge verification

**Date:** 2026-03-22 (UTC)

## PR

| Field | Value |
| --- | --- |
| **PR** | [#349](https://github.com/gregvisser/ODCRM/pull/349) |
| **Merge SHA** | `3f08a9713d3162cab7fe4ee085353478b21ffa21` |
| **Merge commit message** | `Merge pull request #349 from gregvisser/codex/fix-onboarding-scroll-jump-followup` |

This verification note is **documentation only**. Parity proof below applies to the **merge SHA** above.

## Production parity (`scripts/prod-check.cjs`)

**Command used:**

```text
npx --yes cross-env EXPECT_SHA=3f08a9713d3162cab7fe4ee085353478b21ffa21 PARITY_MAX_ATTEMPTS=30 PARITY_RETRY_DELAY_MS=5000 node scripts/prod-check.cjs
```

**Result:** Exit **0** — `PARITY_OK`; final line: `✅ FRONTEND and BACKEND SHAs match expected: 3f08a9713d3162cab7fe4ee085353478b21ffa21`.

**Rollout note:** An earlier run started before **Deploy Backend to Azure App Service** finished; frontend moved to `3f08a97…` while backend stayed on prior SHA until the workflow completed (~7m). After backend deploy finished, parity succeeded on **attempt 1**.

| Endpoint | SHA (at parity) |
| --- | --- |
| Frontend `https://odcrm.bidlow.co.uk/__build.json` | `3f08a9713d3162cab7fe4ee085353478b21ffa21` |
| Backend `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build` | `3f08a9713d3162cab7fe4ee085353478b21ffa21` |

## GitHub Actions

- **Deploy Frontend to Azure Static Web Apps** (merge push): **success** (per `gh run list`).
- **Deploy Backend to Azure App Service** (merge push): **success** — run `23412568602` completed in ~7m35s.

## Signed-in production smoke (scroll stability)

**Automated browser:** Microsoft sign-in gate — **no** signed-in session in the tool; **cannot** tick/save or scroll-verify in automation this pass.

**Recommended manual checks** (operator, signed in):

| Check | How |
| --- | --- |
| **Onboarding** | Scroll mid-page, tick progress or save; confirm **no** jump to top. |
| **Clients → drawer** | Open account, scroll drawer body, trigger an update that emits `customerUpdated`; drawer should **not** reset scroll from list-loading remount. |
| **Clients → table** | Scroll `TableContainer`, trigger `customerUpdated` (e.g. from onboarding save in another tab or any save that emits); table should **not** snap to top / full-page spinner. |

## Conclusion

| Item | Value |
| --- | --- |
| **Parity confirmed** | **Yes** — FE and BE SHAs match merge SHA `3f08a9713d3162cab7fe4ee085353478b21ffa21`. |
| **Interactive scroll smoke in prod** | **Not completed** in automation (auth); **manual** verification recommended. |
