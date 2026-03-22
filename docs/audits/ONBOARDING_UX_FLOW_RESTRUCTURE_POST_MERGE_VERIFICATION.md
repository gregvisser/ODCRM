# Onboarding UX flow restructure — Post-merge verification

**Date:** 2026-03-22 (UTC)

## PR

| Field | Value |
| --- | --- |
| **PR** | [#347](https://github.com/gregvisser/ODCRM/pull/347) |
| **Merge SHA** | `22745b184928fa0a25b38bc86176a4e21ac473cf` |
| **Merge commit message** | `Merge pull request #347 from gregvisser/codex/restructure-onboarding-flow` |

This verification note is **documentation only**. Parity proof below applies to the **feature merge SHA** above (not this doc commit).

## Production parity (`scripts/prod-check.cjs`)

**Command used (retries required — backend lagged frontend after deploy):**

```text
npx --yes cross-env EXPECT_SHA=22745b184928fa0a25b38bc86176a4e21ac473cf PARITY_MAX_ATTEMPTS=60 PARITY_RETRY_DELAY_MS=10000 node scripts/prod-check.cjs
```

**Result:** Exit **0** — final line: `✅ FRONTEND and BACKEND SHAs match expected: 22745b184928fa0a25b38bc86176a4e21ac473cf` (`PARITY_STATE: PARITY_OK`)

| Endpoint | SHA (at parity) |
| --- | --- |
| Frontend `https://odcrm.bidlow.co.uk/__build.json` | `22745b184928fa0a25b38bc86176a4e21ac473cf` |
| Backend `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build` | `22745b184928fa0a25b38bc86176a4e21ac473cf` |

**Rollout note:** Early attempts showed both endpoints on prior SHA `b61800d…`, then **frontend** moved to `22745b1…` while **backend** remained stale for an extended period (`FE_UPDATED_BE_STALE`). Parity succeeded on **attempt 49** once the App Service build caught up.

## GitHub Actions (merge push)

- **Deploy Frontend to Azure Static Web Apps** (workflow run for merge): **success**
- **Deploy Backend to Azure App Service**: **success** (backend `_build` SHA updated after frontend)

## Signed-in production smoke (Onboarding)

**Environment:** `https://odcrm.bidlow.co.uk` — authenticated session, **Onboarding** top-level tab, client **Bidlow** selected (`/onboarding?tab=onboarding-home&view=accounts`).

| Check | Result |
| --- | --- |
| Onboarding loads correctly | **Yes** — form, client selector, and sections render; build stamp visible in UI. |
| No separate **Progress Tracker** tab/sub-tab | **Yes** — top-level nav shows OpensDoors Clients / Marketing / **Onboarding** / Settings only; no Progress Tracker entry. |
| **Commercial & contract** block | **Yes** — section present with monthly revenue, agreement upload, first payment row. |
| Agreement status next to agreement upload | **Yes** — status appears in the commercial block beside/above agreement controls. |
| Payment status next to payment upload | **Yes** — first payment row with upload + status. |
| Start date status next to date field | **Yes** — inline auto/status adjacent to Start Date Agreed. |
| Assigned AM status next to AM selection | **Yes** — inline status beside Assigned Account Manager. |
| DDI / CRM / weekly target rows local & readable | **Yes** — flex rows with inline badges/status; CRM checkbox + status; weekly target + inline readiness. |
| Lead tracker status beside lead tracker field | **Yes** — copy under Leads Google Sheet URL (sheet URL drives auto-complete). |
| Suppression / DNC beside suppression setup | **Yes** — DNC / suppression status under Open Suppression List area. |
| Email linked status beside email setup | **Yes** — “Linked mailboxes” banner above Email Accounts; requirement copy visible. |
| Ops documents uploads | **Yes** — Operations documents card with per-row Add file + status. |
| Targeting readiness strip | **Acceptable** — “Campaign readiness” grid present after qualifying questions; not overly cramped on desktop snapshot. |
| Sticky summary | **Helps** — anchor links (Commercial, Team & data, Emails, Ops docs, Profile, Confirmations) + Sales/Ops/AM counts; compact navigation. |
| Remaining accordion | **Yes** — “Confirmations & sign-offs” with Sales / Operations / Account manager accordions for explicit ticks/dates; intro text notes inline completion elsewhere. |
| No need to scroll only to verify key completion | **Yes** — key auto/manual states appear adjacent to their fields; remainder section holds sign-offs only. |

**Browser console:** No `error`-level messages captured in the automated session log for this flow (warnings only, e.g. dev-style logs).

## Conclusion

| Item | Value |
| --- | --- |
| **Parity confirmed** | **Yes** — FE and BE SHAs match merge SHA `22745b184928fa0a25b38bc86176a4e21ac473cf` with **PARITY_OK**. |
| **Signed-in smoke completed** | **Yes** — Onboarding exercised in production with a real session. |
| **Onboarding UX restructure acceptable in production** | **Yes** — **READY / VERIFIED** for the inline-completion layout and removal of the bottom-only mega-checklist pattern. |
| **Issues found** | **None** blocking in this pass. |
| **Follow-up PR needed** | **No** — none identified from deploy + smoke. |
