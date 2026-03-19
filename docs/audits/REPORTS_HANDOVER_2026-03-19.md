# Reports handover — 2026-03-19

## 1. What was audited

- Mounted path: `App.tsx` / `MarketingHomePage.tsx` → `ReportsTab.tsx` (`view === 'reports'`).
- APIs used by mounted UI: `GET /api/reports/outreach`, `GET /api/send-worker/run-history`, `identity-capacity`, `console`, `queue-workbench` (scheduled sample); plus `GET /api/customers` for picker.
- Distinction from top-level **Dashboard** (`ReportingDashboard` + `/api/reporting/*`).
- Server tenant rules: `reports/outreach` accepts `X-Customer-Id` or query `customerId`; send-worker uses `requireCustomerId`.

## 2. What was proven

- Single Marketing Reports surface; `RequireActiveClient` + `useScopedCustomerSelection` (`customerHeaders`, `cust_*` gate).
- `api.get` **unwraps** `{ data: T }` once (`unwrapResponsePayload`); Reports previously read `.data.data` → **always empty binding**.
- Send-worker `sinceHours` is **capped at 168** on the server; 30/90 day dropdown only fully applies to **outreach** `sinceDays`, not operational panels.

## 3. What safe fixes were completed

- **ReportsTab:** bind state to `response.data` (single unwrap) for all five parallel fetches; tighten `api.get<>` generics; comment on 168h cap.
- **Copy:** `data-testid="reports-tab-window-scope-note"` explains outreach window vs 7-day operational cap.
- **Guardrail:** `server/tests/dashboard-scope-and-period.test.ts` — no double-unwrap regression.

## 4. What remains deferred

- Surface or drop `recentReasons` on outreach payload.
- Product/ops decision on extending send-worker history beyond 168h (cost + UX).
- Optional use or deprecation of `GET /api/reports/customer` for Marketing Reports.
- Any Reports UX split / charts — product scope.

## 5. Current Reports production truth

- **Outreach rollups:** `OutboundSendAttemptAudit`-driven metrics + replies/opt-outs from event streams (see `server/src/routes/reports.ts`).
- **Queue / run history:** live queue + recent audits, **max 7-day lookback** for those endpoints as implemented today.
- **Dashboard:** separate tab and API family — do not merge mentally with Marketing Reports.

## 6. Recommended next Reports/product step

- Validate in browser with a busy tenant: cards and tables populate after deploy; confirm 7-day note matches operator expectations.

## 7. Recommended next repo/ops step

- Run `npx tsx server/tests/dashboard-scope-and-period.test.ts` (or CI equivalent) before releases touching Marketing or `api.ts`.
- After merge: `prod-check` with merge SHA.

---

*Handover: 2026-03-19.*
