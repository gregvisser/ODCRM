# Dashboard — current state audit — 2026-03-19

**Evidence:** `origin/main` @ `8120f272a1b30fdbbcb5a5d7e289746f802542b4` (branch `codex/dashboard-operator-planning`). **DB is truth**; reporting routes derive metrics from Prisma. **Tenant:** `X-Customer-Id`, explicit `scope=all` + header `all` for agency aggregate mode; **client mode** forbids all-clients aggregate (`403` from `server/src/routes/reporting.ts`).

---

## 1. Executive summary

The **mounted Dashboard** is a **single top-level tab** (`reporting-home`, nav label **“Dashboard”**, path `/reporting`) that renders **`ReportingHomePage`** → **`ReportingDashboard`**. The UI is **large, analytics-heavy**, and loads **nine parallel** `GET /api/reporting/*` endpoints per refresh. It is **not** the same surface as **Marketing → Reports** (`/api/reports/outreach` + send-worker reads) — that split is intentional but **easy for operators and contributors to conflate** without reading the code or `REPORTS_PRODUCTION_AUDIT_2026-03-19.md`.

**Verdict:** The Dashboard is **real backend truth**, **well-scoped on tenancy** (including explicit all-clients mode), but **noisy and long** for a default top tab; copy and layout **sell “command center”** more than they **route the next operator action** (which still lives primarily in **Marketing**).

---

## 2. Mounted Dashboard path

| Step | Location | Role |
|------|----------|------|
| Top nav | `src/contracts/nav.ts` | `CRM_TOP_TABS[0]`: `{ id: 'reporting-home', label: 'Dashboard', path: '/reporting' }` |
| App shell | `src/App.tsx` | `case 'reporting-home': return <DashboardHomePage view={activeView} />` |
| Default view | `src/App.tsx` | `getDefaultViewForTab('reporting-home')` → `'reporting-dashboard'` |
| Deep link | `src/App.tsx` | Legacy keys `reporting` / `dashboard` → `{ tab: 'reporting-home', view: 'reporting-dashboard' }` |
| Thin shell | `src/tabs/reporting/ReportingHomePage.tsx` | Title + description + **`<ReportingDashboard />`** |
| **Actual UI** | `src/tabs/marketing/components/ReportingDashboard.tsx` | ~1.5k lines; all charts/tables/exports |

**Note:** The Dashboard **component file lives under `marketing/components/`** while the route wrapper lives under `tabs/reporting/` — a **structural inconsistency** that increases onboarding cost for developers.

---

## 3. Frontend surface map

- **Scope:** `useScopedCustomerSelection()` — client dropdown, optional **“All Clients”** (`__all_clients__`) when `canSelectCustomer` is true (agency).
- **Period:** Rolling **7 / 30 / 90 days**, or **week** (Monday-aligned UTC), or **month** — query params built in `buildRequestSuffix()`.
- **Customer list:** `GET /api/customers` + `normalizeCustomersListResponse` for `<Select>` options.
- **Main panels (when scope valid):** Hero + 7 overview stats, “What matters now” (3 cards), activity trend (SVG), source mix, **five “Performance lanes”** (Leads / Outreach / Replies / Conversions / Risk), team performance (top sourcers, mailboxes, sequences), operational health + funnel, sequence/mailbox detail tables, daily truth table.
- **Exports:** CSV for leads-by-source, top sourcers, outreach-by-sequence.
- **Empty / blocked state:** If single-client scope but no `cust_*` id selected — **no inferred numbers**; explicit messaging (aligned with “no silent tenant default”).

---

## 4. Backend / data contract map

All under `server/src/routes/reporting.ts`, mounted at `app.use('/api/reporting', observabilityHeaders, reportingRoutes)`.

| Route | Role |
|-------|------|
| `GET /api/reporting/summary` | Core KPIs, targets, rates, risk counts |
| `GET /api/reporting/leads-vs-target` | Target pacing + trend vs previous period |
| `GET /api/reporting/leads-by-source` | `{ bySource: [...] }` |
| `GET /api/reporting/top-sourcers` | `{ sourcers: [...] }` |
| `GET /api/reporting/outreach-performance` | By sequence + identity, totals |
| `GET /api/reporting/funnel` | Funnel + `byLeadStatus` |
| `GET /api/reporting/mailboxes` | `{ mailboxes: [...] }` |
| `GET /api/reporting/compliance` | Suppressions, opt-outs, blocks in window |
| `GET /api/reporting/trends` | `{ trend: TrendRow[] }` |

**Headers:** `ReportingDashboard` sets **`X-Customer-Id: all`** when aggregate scope is selected (see in-file comment: prevents accidental injection of active client id). **Conflicting** `scope=all` + specific customer id returns **400** server-side.

**Truth vs illusion:** File header in `ReportingDashboard.tsx` states metrics come from **`/api/reporting/*` only** — **accurate**. Some metrics show **“Not available”** when backend returns null (e.g. positive reply classification, meetings booked) — **honest**, not placeholder data.

---

## 5. What the Dashboard currently does well

- **Explicit scope and period** — operators can see *what* slice of truth they are viewing.
- **Aggregate mode** for agency (when allowed) with **documented** server rules.
- **No client-side fabrication** of KPIs — failures surface as errors or nulls.
- **Export** hooks for a few key tables (sourcing, sourcers, sequences).
- **Alignment with lead targets** where configured (pacing lane).

---

## 6. What is messy / misleading / noisy / weak

| Issue | Evidence |
|-------|----------|
| **Name collision** | Nav says “Dashboard”; Marketing has **Reports**, **Readiness**, **Schedules** — all “report-like”. Operators may not know **two different API families** (`/api/reporting/*` vs `/api/reports/*` + send-worker). |
| **Top tab priority** | `CRM_TOP_TABS` puts Dashboard **first** — implies “start here,” but **daily execution** is still **Marketing** per `OPERATOR_WORKFLOW_AUDIT` and IA notes. |
| **Scroll depth** | Single page stacks hero + lanes + team + ops + funnel + two detail tables + daily table — **high cognitive load** for “morning standup” use. |
| **“What matters now”** | Heuristic cards are **useful but generic** (scope confirm, target pacing, risk) — not **deep-linked** to Sequences/Inbox/Schedules. |
| **Dev structure** | `ReportingHomePage` in `tabs/reporting/` imports from `marketing/components/ReportingDashboard.tsx` — **confusing** module boundary. |
| **Overlap with Marketing Reports** | Both show outreach-ish metrics; **different windows and backends** — without in-app explanation, **trust can erode** if numbers differ slightly. |

---

## 7. What should probably be removed, simplified, or de-emphasized (product direction — not this sprint)

- **De-emphasize** redundant narrative between Dashboard hero and Marketing Reports (clarify roles in copy or IA — see product plan doc).
- **Simplify** default landing: consider whether **first tab** should be execution (Marketing) vs analytics (Dashboard) — **decision for Greg** (see handover).
- **Reduce** duplicate concepts in one scroll (e.g. funnel + lanes + daily table — may be **three views of similar motion** for some tenants).

---

## 8. What should probably be elevated (future)

- **Action links** from Dashboard attention items → **Readiness / Sequences / Inbox / Schedules** with **preserved tenant scope** (already a pattern elsewhere).
- **One-line “data source”** subtitle: “Executive reporting (`/api/reporting`) — not the same as Marketing → Reports.”
- **Operator-first default** for agency: optional emphasis on **“today’s blockers”** using existing send-worker **read** APIs — **without** duplicating full Marketing Reports.

---

## 9. Product-planning implications

- Treat **Dashboard** as **long-horizon / multi-lane analytics** and **Marketing → Reports** as **operational send + queue context** unless product explicitly merges the mental model.
- Any **redesign** should start from **jobs-to-be-done** (“did we hit target?”, “where is risk?”, “which client is cold?”) rather than **adding more charts**.
- **Tenant rules** (`X-Customer-Id`, `all`, client mode) are **non-negotiable** — already enforced; future UX must **not** weaken them for convenience.

---

*Audit date: 2026-03-19. Repo: ODCRM only.*
