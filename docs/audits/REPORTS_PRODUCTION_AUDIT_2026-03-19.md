# Reports production audit — 2026-03-19

Evidence from repo at `origin/main` (branch `codex/reports-truth-and-safe-fixes`). **DB is truth**; **tenant** is `X-Customer-Id` (and query `customerId` where the route accepts it). **No silent tenant default** in agency mode (active client from scope).

---

## 1. Executive summary

**Marketing → Reports** is a **single mounted surface**: `src/tabs/marketing/components/ReportsTab.tsx`, rendered from `MarketingHomePage` when `view === 'reports'`. It combines:

1. **Outreach aggregates** from `GET /api/reports/outreach` (rolling `sinceDays`, 1–90), driven by `OutboundSendAttemptAudit` + `emailEvent` (replies) + `enrollmentAuditEvent` (opt-outs).
2. **Operational / queue context** from **send-worker read APIs** (`console`, `run-history`, `identity-capacity`, `queue-workbench`), all tenant-scoped via `requireCustomerId` and **`sinceHours` capped at 168 (7 days)** on the server.

**Critical bug found (this audit):** the shared `api` client **unwraps** JSON envelopes that contain a top-level `data` key (`unwrapResponsePayload` in `src/utils/api.ts`). Mounted Reports then read `response.data?.data`, which is **always wrong** for these endpoints — the inner payload was already lifted to `response.data`. Net effect: **outreach tables, run history, console stats, identity capacity, and scheduled queue samples were not bound to API results** (always `null`/empty). This is a **safe, mechanical fix** (use one level of `.data` only).

**Separate product surface:** top-level **Dashboard** (`reporting-home` → `ReportingDashboard.tsx`) uses `/api/reporting/*` with calendar periods — **not** the same code path as Marketing Reports. Both are real; do not conflate them.

---

## 2. Mounted Reports path

| Step | Location | Role |
|------|----------|------|
| App shell | `src/App.tsx` | `marketing-home` tab; `legacyTabMap.reports` → `view: 'reports'`; `navigateToMarketing` supports `view: 'reports'` |
| Marketing chrome | `src/tabs/marketing/MarketingHomePage.tsx` | `import ReportsTab from './components/ReportsTab'`; sub-nav `id: 'reports'`, `content: <ReportsTab />` |
| Mounted UI | `src/tabs/marketing/components/ReportsTab.tsx` | All Marketing Reports UX |
| Guardrails | Same file + `RequireActiveClient` | `useScopedCustomerSelection()` → `customerHeaders` / `selectedCustomerId`; requires `cust_*` id |

**Deep-link:** `?tab=marketing-home&view=reports` (and path-based tab per `CRM_TOP_TABS`).

**Nested components:** Reports is **self-contained** in one file (Chakra primitives only — no separate chart package components). Cross-links: URL `search` updates to `readiness`, `sequences`, `inbox`.

---

## 3. Frontend surface map

- **Client picker:** `GET /api/customers` (list for `<Select>`; scope hook still enforces active client).
- **Outreach block:** Summary stats + “Results by sequence” + “Results by mailbox” from outreach response (`bySequence`, `byIdentity`).
- **Latest send outcomes:** `GET /api/send-worker/run-history` (limit 80), non–`WOULD_SEND` rows sliced for table.
- **Operational follow-up:** Console queue counts, identity capacity summary, `queue-workbench?state=scheduled&limit=5`, attention heuristics.
- **Not rendered from API (backend sends, UI ignores):** `recentReasons` on outreach payload — useful for ops but not shown.

**Date UX:** Dropdown **7 / 30 / 90 days** applies fully to **`/api/reports/outreach`** (`sinceDays`). Send-worker calls use `sinceHours = min(windowDays * 24, 168)` — so for 30/90 day selection, **operational sections still cap at 7 days** (server `SUMMARY_SINCE_HOURS_MAX`). This is easy to misunderstand without copy; **document in UI**.

**Top-level Dashboard:** `ReportingDashboard.tsx` + `/api/reporting/*` — calendar week/month, “all clients” scope, lead targets, trends — **out of scope for this file** but listed so contributors do not “fix Reports” in the wrong tab.

---

## 4. Backend route map

| Route | Router | Tenant / customer | Used by mounted Reports? |
|-------|--------|-------------------|---------------------------|
| `GET /api/reports/outreach` | `server/src/routes/reports.ts` | `getCustomerId`: header `X-Customer-Id` **or** query `customerId` | **Yes** — primary aggregates |
| `GET /api/reports/customer` | same | same | **No** (legacy/alternate customer report; London calendar buckets) |
| `GET /api/reports/customers` | same | **Not customer-scoped** (lists all customers + event counts) | **No** (Reports uses `/api/customers` for picker) |
| `GET /api/send-worker/run-history` | `server/src/routes/sendWorker.ts` | `requireCustomerId` | **Yes** |
| `GET /api/send-worker/console` | same | same | **Yes** |
| `GET /api/send-worker/identity-capacity` | same | same | **Yes** |
| `GET /api/send-worker/queue-workbench` | same | same | **Yes** (`state=scheduled`) |
| `GET /api/reporting/*` | `server/src/routes/reporting.ts` | varies by endpoint | **No** (Dashboard only) |

**Outreach implementation notes:**

- Audits capped at 5000 rows (`take: 5000`) — very active tenants may truncate oldest rows in window.
- Replies: `emailEvent` type `replied` with optional try/catch — enum lag → replies/opt-out stream may zero out with a server warning.
- Opt-outs: `enrollmentAuditEvent` `send_skipped` + message `unsubscribe_link_clicked`.

**Send-worker `sinceHours`:** `parseSinceHours` clamps to **max 168**.

---

## 5. Current production-usability verdict

- **Strong (after unwrap fix):** Single place for outreach rollups + queue snapshot; tenant headers respected; links to Sequences/Inbox/Readiness.
- **Partial:** 30/90 day selector does **not** extend operational panels past 7 days — only outreach aggregates do.
- **Misleading (pre-fix):** Appeared “empty” despite backend data due to double-unwrap bug.
- **Honest gap:** Marketing Reports ≠ Executive Dashboard; different APIs and mental models.

---

## 6. What is fully working

- Mount path and navigation from App, Marketing home, Inbox, Readiness, Sequences “Open Reports”.
- Backend contracts for outreach + send-worker reads under tenant.
- **After fix:** Client-side binding to unwrapped `api` payloads.

---

## 7. What is partial / misleading / broken

| Area | Assessment |
|------|------------|
| **API unwrap vs `response.data.data`** | **Broken** — `api` already unwraps `data`; Reports must use `response.data` only. |
| **Window selector vs send-worker** | **Misleading** — labels imply one window; server caps operational history at 168h. |
| **`recentReasons` in outreach** | **Unsurfaced** — backend truth not shown. |
| **`/api/reports/customer`** | **Unused** by mounted Marketing Reports — alternate email-event-based report (London ranges). |
| **Suppressed summary stat** | **Mixed semantics** — uses queue `suppressed` **or** falls back to outreach `sequenceTotals.suppressed` (`\|\|`). |

---

## 8. Safe-fix candidates for this run

1. **Fix Reports `api` payload handling** — use single-level `.data` matching `unwrapResponsePayload`; correct generics. *Highest impact, zero product ambiguity.*
2. **Clarify operational time window in UI** — short copy that send-worker sections are limited to 7 days (168h) while outreach tables follow the selected days. *Truth-only, no redesign.*

---

## 8b. Selected fixes implemented (this run)

| Fix | Rationale |
|-----|-----------|
| `ReportsTab.tsx`: set state from `*Res.data` (not `.data.data`) | Restores binding to real backend payloads. |
| `ReportsTab.tsx`: operator note on 7-day cap for queue/run-history/capacity | Aligns UI claims with `SUMMARY_SINCE_HOURS_MAX`. |
| `server/tests/dashboard-scope-and-period.test.ts`: assert no double-unwrap in ReportsTab | Regression guardrail. |

---

## 9. Deferred larger issues

- Surface `recentReasons` or remove from payload if permanently unused.
- Align operational window with 30/90d (requires backend/product decision on `SUMMARY_SINCE_HOURS_MAX` and query cost).
- Split monolith `ReportsTab` / richer charts — product scope.
- Wire or document `/api/reports/customer` if it should replace or complement outreach for some operators.

---

*Audit completed: 2026-03-19. Repo: ODCRM.*
