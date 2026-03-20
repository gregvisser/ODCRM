# Schedules production audit — 2026-03-19

Evidence from repo at `origin/main` (branch `codex/schedules-truth-and-safe-fixes`). **DB is truth**; **tenant** via **`X-Customer-Id`** or query `customerId` on schedule routes (`server/src/routes/schedules.ts` → `getCustomerId`).

---

## 1. Executive summary

**Marketing → Schedules** is a **single mounted surface**: `src/tabs/marketing/components/SchedulesTab.tsx`, rendered from `MarketingHomePage` when `view === 'schedules'`. It surfaces **EmailCampaign** rows the backend treats as “schedules”: **only `running` or `paused` campaigns with a non-null `sequenceId`**. Draft/completed campaigns **do not appear** in `GET /api/schedules`.

The tab loads **campaign-scoped stats** (`GET /api/schedules/:id/stats`), **upcoming step sends** (`GET /api/schedules/emails`), and for the selected row with a sequence, **send-worker** `sequence-preflight` and `run-history` (72h window). Operators can **pause/resume** (`POST .../pause|resume`) and run **`POST /api/send-worker/sequence-test-send`** (“Test now”) when mailbox/sequence alignment passes UI gates.

**Operator-trust gaps addressed this run:**

1. **Explicit tenant headers** — All schedule and send-worker calls now pass `customerHeaders` from `useScopedCustomerSelection()`, matching Reports/Sequences patterns and avoiding reliance on “implicit” injection alone.
2. **Reload on client change** — `loadData` / `loadSelectedDetails` depend on scoped `customerId` so switching agency client refreshes schedules.
3. **Empty-state truth** — Copy clarifies that only **running/paused + sequence-linked** campaigns list here.

**Send-worker detail window:** `DETAIL_SINCE_HOURS = 72` (under server max 168). Preflight/run-history reflect that window, not “full campaign lifetime.”

---

## 2. Mounted Schedules path

| Step | Location | Role |
|------|----------|------|
| App shell | `src/App.tsx` | `marketing-home`; legacy/deep-link `view` can include `schedules` |
| Marketing chrome | `src/tabs/marketing/MarketingHomePage.tsx` | `id: 'schedules'`, `content: <SchedulesTab />` |
| Mounted UI | `src/tabs/marketing/components/SchedulesTab.tsx` | Full Schedules UX (no child route components) |
| Guard | `RequireActiveClient` | Hides tab body when no effective customer |

**Deep-link:** `?tab=marketing-home&view=schedules`

---

## 3. Frontend surface map

- **Summary cards:** counts of schedules, active, “need attention”, earliest `nextScheduledAt` across listed rows.
- **Schedule list:** per-row status, mailbox, sequence, mismatch flag, pause/resume, select for detail.
- **Detail (selected):** stats card, preflight GO/WARNING/NO_GO, run-history table, upcoming emails slice, “Test now”.
- **Locales:** `useLocale` for loading string only; primary copy is English inline.

**Nested components:** None — single file, Chakra primitives only.

---

## 4. Backend route map

| Method | Path | Auth / tenant | Used by mounted UI? |
|--------|------|---------------|---------------------|
| GET | `/api/schedules` | `getCustomerId` | **Yes** — list |
| GET | `/api/schedules/emails?limit=` | `getCustomerId` | **Yes** — upcoming sends |
| GET | `/api/schedules/:id/stats` | `getCustomerId` | **Yes** — detail stats |
| POST | `/api/schedules/:id/pause` | `getCustomerId` + `requireMarketingMutationAuth` | **Yes** |
| POST | `/api/schedules/:id/resume` | same | **Yes** |
| GET | `/api/send-worker/sequence-preflight` | `requireCustomerId` | **Yes** (if `sequenceId`) |
| GET | `/api/send-worker/run-history` | `requireCustomerId` | **Yes** (if `sequenceId`) |
| POST | `/api/send-worker/sequence-test-send` | `requireCustomerId` + marketing mutation | **Yes** |
| POST/PUT/PATCH/DELETE | other `/api/schedules/*` | various | **No** — not wired in this tab |

**List filter (truth):** `emailCampaign` where `status ∈ { running, paused }` and `sequenceId != null`.

**Partial / legacy:** `emailCampaignProspectStep` queries are wrapped in try/catch (schema drift resilience). Stats `sentSends` / `todaySent` use `emailEvent` — aligned with campaign/identity where implemented.

---

## 5. Current production-usability verdict

- **Strong:** Pause/resume + stats + upcoming emails + preflight/history for sequence-backed schedules; mailbox mismatch surfaced; test-send gated in UI.
- **Partial:** Schedules are a **subset** of campaigns; operators may expect drafts here — they won’t appear.
- **Misleading (pre-fix):** Implicit tenant only; no refetch on agency client switch.
- **Broken:** None critical after prior `api` unwrap fix (#336); this run hardens **tenant + copy**.

---

## 6. What is fully working

- Tenant-scoped schedule CRUD surface as exposed (list/stats/emails/pause/resume).
- Send-worker preflight and run-history for selected sequence (72h).
- Sequence test-send with gate humanization.

---

## 7. What is partial / misleading / broken

| Area | Assessment |
|------|------------|
| **List scope** | **Partial** — only running/paused + sequence; drafts/completed absent. |
| **Detail time window** | **Partial** — 72h worker window vs “schedule lifetime.” |
| **Tenant headers** | **Misleading for reviewers** — was implicit via `api.ts` default; now explicit. |
| **Client switch (agency)** | **Was weak** — stale data until manual refresh; **fixed** via deps. |

---

## 8. Safe-fix candidates for this run

1. **`useScopedCustomerSelection` + `customerHeaders`** on every Schedules API call; guard loads with `cust_` id; dependency on `customerId` for reload.
2. **Empty-state / help copy** — state filter (running/paused + sequence).
3. **Static contract test** — `schedules-tab-contract.test.ts` for headers + no double-unwrap regression on schedule detail paths.

---

## 8b. Selected fixes for this run (implemented)

| Fix | Reason |
|-----|--------|
| Explicit `X-Customer-Id` on all Schedules + send-worker calls in `SchedulesTab.tsx` | Aligns with tenant-isolation expectations and other Marketing tabs. |
| `loadData` / `loadSelectedDetails` keyed to `customerId` | Correct data after agency client change. |
| Copy on empty list | Reduces “where did my campaign go?” confusion. |
| `server/tests/schedules-tab-contract.test.ts` | Regression guard. |

---

## 9. Deferred larger issues

- Surface draft/completed campaigns (filter toggle) — product scope.
- Align `DETAIL_SINCE_HOURS` with operator preference or backend default — product.
- Create/edit schedule from this tab — currently other flows.
- Full calendar UX — out of scope.

---

*Audit: 2026-03-19 — ODCRM.*
