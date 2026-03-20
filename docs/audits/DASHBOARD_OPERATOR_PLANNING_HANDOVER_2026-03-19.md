# Dashboard + operator planning — handover — 2026-03-19

## 1. What was audited

- **Mounted Dashboard** path (`App.tsx` → `ReportingHomePage.tsx` → `ReportingDashboard.tsx`) and **all** `GET /api/reporting/*` dependencies.
- **Operator journey** across top tabs + Marketing subviews, cross-referenced with existing **2026-03-19** audits (Inbox, Marketing sweep, Sequences, Reports, Schedules, Operator workflow).

## 2. What was proven

- Dashboard is **`reporting-home`**, label **Dashboard**, path **`/reporting`**; single component **`ReportingDashboard`** (file under `src/tabs/marketing/components/`).
- **Nine** parallel reporting endpoints; **tenant** via `X-Customer-Id` / `scope=all` / **`all`** header for aggregate; **client mode** blocks all-clients aggregate.
- **Marketing → Reports** uses a **different** API family — documented; not a bug by itself.
- **Execution** work remains concentrated in **Marketing**; Dashboard is **analytic**, not a replacement for Reports/Readiness/Schedules.

## 3. What planning docs were created

| Doc | Purpose |
|-----|---------|
| `docs/audits/DASHBOARD_CURRENT_STATE_2026-03-19.md` | Evidence-based Dashboard audit |
| `docs/audits/OPERATOR_WORKFLOW_MAP_2026-03-19.md` | Operator journey synthesis |
| `docs/product/DASHBOARD_OPERATOR_WORKFLOW_PLAN_2026-03-19.md` | Staged product plan + PR order |

## 4. What tiny doc fixes were made (if any)

- `docs/audits/ODCRM_INFORMATION_ARCHITECTURE.md` — aligned top-level tab names with `src/contracts/nav.ts` (Dashboard vs legacy “Dashboards” wording).

## 5. Current recommendation

Ship **Stage 1** next: **clarifying copy + cross-links** between Dashboard and Marketing Reports; **no** layout redesign until defaults are decided.

## 6. Exact next build step

**PR 1 (implementation):** Add **short, truthful subtitles** on `ReportingDashboard` hero (and optionally Reports hero) stating which **API family** each uses and **where to go for queue/sender detail** — deep-links to `?tab=marketing-home&view=reports` / `readiness` as appropriate.

## 7. What Greg needs to decide before bigger work starts

- **Default top tab** after login: **Dashboard** vs **Marketing** for primary operators.
- Whether **“operator home”** should ever **merge** KPI + action, or stay **two surfaces** with clearer naming.

---

*Handover: 2026-03-19.*
