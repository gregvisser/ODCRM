# Schedules handover — 2026-03-19

## 1. What was audited

Mounted **Marketing → Schedules** (`SchedulesTab.tsx`), backend `server/src/routes/schedules.ts`, and send-worker routes used for detail (`sequence-preflight`, `run-history`, `sequence-test-send`).

## 2. What was proven

- **Mount:** `MarketingHomePage` sub-nav `id: 'schedules'` → `<SchedulesTab />`; deep-link `view=schedules`.
- **List truth:** `GET /api/schedules` returns only **`running` or `paused`** `EmailCampaign` rows with **`sequenceId` set** — drafts/completed are absent by design.
- **Tenant:** Schedule routes use `getCustomerId` (header or query). The tab now passes **`customerHeaders`** from `useScopedCustomerSelection()` on every call and refetches when **`scopedCustomerId`** changes.
- **Detail window:** Preflight + run-history use **`DETAIL_SINCE_HOURS` (72)**; UI already states “last 72 hours” for empty outcomes.

## 3. What safe fixes were completed

- Explicit **`X-Customer-Id`** on list, emails, stats, send-worker GETs, pause/resume POST, test-send POST.
- **Guards** when `cust_*` id missing (no stray API calls).
- **Copy** on empty list: explains running/paused + sequence-linked filter.
- **`server/tests/schedules-tab-contract.test.ts`** — headers + no double-unwrap on detail.

## 4. What remains deferred

- Optional UI to show draft/completed campaigns (filter/toggle) — product.
- Create/edit schedule from this tab — not mounted today.
- Changing 72h vs other defaults — product/ops.

## 5. Current Schedules production truth

Operators see **sequence-backed, active/paused campaigns**, can **pause/resume** (with marketing mutation auth), inspect **stats + upcoming emails**, and run a **capped test send** when mailbox alignment allows.

## 6. Recommended next Schedules/product step

- Smoke-test **agency client switch**: list and detail should refresh without a manual full reload.

## 7. Recommended next repo/ops step

- `npx tsx server/tests/schedules-tab-contract.test.ts` in CI or pre-release.
- After merge: `prod-check` with merge SHA.

---

*Handover: 2026-03-19.*
