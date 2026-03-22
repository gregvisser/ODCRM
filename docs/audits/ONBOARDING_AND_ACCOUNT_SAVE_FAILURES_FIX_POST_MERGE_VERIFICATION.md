# Onboarding + account save failures — Post-merge verification

**Date:** 2026-03-22 (UTC)

## PR

| Field | Value |
| --- | --- |
| **PR** | [#350](https://github.com/gregvisser/ODCRM/pull/350) |
| **Merge SHA** | `31d0bde30ff4fd60dcbcb76f9713b3943cbea524` |
| **Merge commit message** | `Merge pull request #350 from gregvisser/codex/fix-onboarding-and-account-save-failures` |

This verification note is **documentation only**. Parity proof below applies to the **merge SHA** above.

## Production parity (`scripts/prod-check.cjs`)

**Command used:**

```text
npx --yes cross-env EXPECT_SHA=31d0bde30ff4fd60dcbcb76f9713b3943cbea524 PARITY_MAX_ATTEMPTS=30 PARITY_RETRY_DELAY_MS=5000 node scripts/prod-check.cjs
```

**Result:** Exit **0** — `PARITY_OK`; `✅ FRONTEND and BACKEND SHAs match expected: 31d0bde30ff4fd60dcbcb76f9713b3943cbea524`.

**Rollout note:** Initial polling showed frontend on `31d0bde…` while backend remained on prior SHA until **Deploy Backend to Azure App Service** (merge run `23413132587`) completed; parity then succeeded on **attempt 1**.

| Endpoint | SHA (at parity) |
| --- | --- |
| Frontend `https://odcrm.bidlow.co.uk/__build.json` | `31d0bde30ff4fd60dcbcb76f9713b3943cbea524` |
| Backend `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build` | `31d0bde30ff4fd60dcbcb76f9713b3943cbea524` |

## GitHub Actions

- **Deploy Frontend to Azure Static Web Apps** (merge push): **success** (per `gh run list`).
- **Deploy Backend to Azure App Service** (merge push): **success** — run `23413132587` completed (~4m visible in watch output).

## Signed-in production smoke (save paths)

**Automated browser:** No Microsoft session in tooling — **interactive** verification not executed here.

**Recommended manual checks** (signed-in operator):

| Check | Expected |
| --- | --- |
| **Onboarding** manual progress checkbox | **200**; no generic **500** “Failed to update progress tracker”. |
| **Clients** account drawer field save (`PATCH /account`) | **200** when JWT is valid; **401** `unauthenticated` if identity empty — **not** generic **500** “Failed to patch customer account”. |
| **Invalid/expired auth** | Truthful **401** / auth messaging rather than **500** from thrown JWT verify. |

## Conclusion

| Item | Value |
| --- | --- |
| **Parity confirmed** | **Yes** |
| **Interactive save smoke** | **Deferred** to manual (auth gate) |
