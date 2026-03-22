# Onboarding hardening (identity, save stability, flow) — Post-merge verification

**Date:** 2026-03-22 (UTC)

## PR

| Field | Value |
| --- | --- |
| **PR** | [#348](https://github.com/gregvisser/ODCRM/pull/348) |
| **Merge SHA** | `509857286054556aa3c65be5c2a33c420462c51c` |
| **Merge commit message** | `Merge pull request #348 from gregvisser/codex/harden-onboarding-identity-flow-save-stability` |

This verification note is **documentation only**. Parity proof below applies to the **feature merge SHA** above (not this doc commit).

## Production parity (`scripts/prod-check.cjs`)

**Command used:**

```text
npx --yes cross-env EXPECT_SHA=509857286054556aa3c65be5c2a33c420462c51c PARITY_MAX_ATTEMPTS=30 PARITY_RETRY_DELAY_MS=5000 node scripts/prod-check.cjs
```

**Result:** Exit **0** — final line: `✅ FRONTEND and BACKEND SHAs match expected: 509857286054556aa3c65be5c2a33c420462c51c` (`PARITY_STATE: PARITY_OK` on **attempt 1** in this run).

| Endpoint | SHA (at parity) |
| --- | --- |
| Frontend `https://odcrm.bidlow.co.uk/__build.json` | `509857286054556aa3c65be5c2a33c420462c51c` |
| Backend `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build` | `509857286054556aa3c65be5c2a33c420462c51c` |

**Earlier merge rollout note (same SHA):** A prior verification pass required **many retries** (`PARITY_MAX_ATTEMPTS=60`, `PARITY_RETRY_DELAY_MS=10000`) because the App Service `_build` SHA lagged the Static Web Apps deploy; parity eventually succeeded (~attempt 50). The short retry run above confirms both endpoints are aligned now.

## GitHub Actions (merge push)

- **Deploy Frontend to Azure Static Web Apps** (workflow run for merge): **success** (per session log).
- **Deploy Backend to Azure App Service**: **success** (per session log).

## Signed-in production smoke (target checks)

**Environment:** `https://odcrm.bidlow.co.uk` — authenticated session where available.

| Check | Result |
| --- | --- |
| **Scope remains onboarding hardening only** (identity + refresh + placement + read-only strip) | **Yes** — matches PR #348 / audit `ONBOARDING_HARDENING_IDENTITY_FLOW_AND_SAVE_STABILITY.md`. |
| **Sticky summary** — Ops coordination, Delivery & launch, Final sign-offs | **Yes** — links and labels present in production UI pass. |
| **Commercial confirmations & handover** — placed with commercial block | **Yes** — section title + copy visible. |
| **Operations coordination** — placed after suppression / before contacts | **Yes** — section present with expected anchor `#onb-ops-coordination`. |
| **Delivery, meetings & go-live** — after targeting readiness, before case studies | **Yes** — section present with anchor `#onb-delivery-launch`. |
| **Final sign-offs** — compact bottom block (`#onb-confirmations`) | **Yes** — appropriate density vs prior mega-accordion. |
| **Manual tick → not “By unknown”** (current user) | **Not re-verified in this doc run** — automated browser session hit Microsoft sign-in gate; **recommend one manual tick** on any manual row and confirm meta shows a real name/email or neutral legacy line (not “By unknown”). Code path: `getVerifiedActorIdentity` on `PUT /progress-tracker` + `resolveUserLabel`. |
| **Save/tick → no scroll jump** | **Not re-verified in this doc run** — same auth limitation; **recommend** tick while scrolled mid-page and confirm position holds (background `fetchCustomer` + scroll restore). |
| **Clients account drawer — read-only onboarding summary** | **Partial** — Bidlow account drawer opens in production; **“Onboarding (read-only summary)”** block not confirmed in automated a11y snapshot (layout/loading). **Recommend** open **Clients → Bidlow** and confirm strip + **Open onboarding** only (no duplicate editable onboarding fields). |

**Browser console:** Prior session: no blocking `error`-level noise for onboarding navigation; warnings only.

## Conclusion

| Item | Value |
| --- | --- |
| **Parity confirmed** | **Yes** — FE and BE SHAs match merge SHA `509857286054556aa3c65be5c2a33c420462c51c` with **PARITY_OK**. |
| **Structural / placement smoke** | **Yes** — sections and sticky nav align with PR #348. |
| **Interactive attribution + scroll + drawer strip** | **Follow-up manual spot-check** recommended where Microsoft auth prevents automation. |
| **Follow-up PR needed for hardening** | **No** — none identified from deploy + structural smoke. |
