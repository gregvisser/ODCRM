# Operator workflow map — 2026-03-19

**Purpose:** Concise **journey map** for how operators move through ODCRM **today**, synthesized from **mounted code paths** and **2026-03-19 source-of-truth audits** (`INBOX_CLOSEOUT`, `MARKETING_TAB_FUNCTIONALITY_SWEEP`, `SEQUENCES_PRODUCTION_AUDIT`, `REPORTS_PRODUCTION_AUDIT`, `SCHEDULES_PRODUCTION_AUDIT`, `OPERATOR_WORKFLOW_AUDIT`, `ODCRM_INFORMATION_ARCHITECTURE`). **Not** a substitute for those documents’ API tables.

---

## 1. Executive summary

Operators **do not** follow a single linear wizard. The **real loop** is: **scope a client (agency)** → **bring leads in** (Lead Sources / lists) → **attach outreach** (Sequences + campaigns + schedules) → **monitor sends and replies** (Reports, Readiness, Schedules, Inbox) → **act** (reply, adjust sequence, pause, compliance). The **top-level Dashboard** (`/api/reporting/*`) answers **“how are we doing on aggregate KPIs?”**; **Marketing** answers **“what do I do next on the send/reply floor?”** Confusing those two **reduces confidence**.

---

## 2. Current operator happy path (realistic)

1. **Land** — Often **Clients** (accounts/contacts) or **Marketing** (Readiness first in default sub-nav, not always first in operator mind).
2. **Confirm tenant** — Agency: pick **active client** (`X-Customer-Id`); client mode: fixed tenant.
3. **Intake leads** — **Lead Sources** (lists/sheets/batches) → materialization into lists/campaigns (handoff into Sequences — **mental stitch**, not one modal).
4. **Configure outreach** — **Sequences** (definition, enrollments, queue), **Templates**, **Email accounts**, **Compliance**.
5. **Run** — **Schedules** (campaign timing, pause/resume, stats, preflight/history), worker/tick paths inside Sequences.
6. **Observe** — **Reports** (outreach + capped send-worker ops context), **Readiness** snapshot, optional **Dashboard** for rolling/calendar KPIs.
7. **Reply path** — **Inbox** (threads, reply send); refresh/copy acknowledges **async** reply detection vs message pull.

---

## 3. Stages in order (conceptual)

| # | Stage | Primary surfaces |
|---|--------|------------------|
| 1 | **Scope / tenant** | App scope hooks, customer pickers, headers on all API calls |
| 2 | **Data in** | Clients (CRM), Lead Sources, lists |
| 3 | **Outreach build** | Sequences, Templates, Email accounts, Compliance |
| 4 | **Execution** | Schedules, send queue, send worker tools in Sequences |
| 5 | **Measurement** | Dashboard (`/api/reporting`), Marketing Reports (`/api/reports` + worker) |
| 6 | **Response** | Inbox, then back to Sequences/Schedules as needed |

---

## 4. Mounted surfaces involved (top-level)

| Top tab | Path (contract) | Role |
|---------|-----------------|------|
| **Dashboard** | `/reporting` | Analytics / KPI / trend / export (`/api/reporting/*`) |
| **OpensDoors Clients** | `/customers` | Accounts, contacts |
| **OpensDoors Marketing** | `/marketing` | Readiness, Reports, Lead Sources, Compliance, Email accounts, Templates, Sequences, Schedules, Inbox |
| **Onboarding** | `/onboarding` | New client setup |
| **Settings** | `/settings` | Admin |

---

## 5. Friction points

| Friction | Why it hurts |
|----------|----------------|
| **Two “reporting” brains** | Dashboard vs Marketing Reports — different APIs, different windows — numbers won’t match 1:1. |
| **Lead Sources → Sequences** | No single guided handoff; operators must **know** the bridge. |
| **Sequences surface area** | Large single tab; high expertise curve (`SEQUENCES_PRODUCTION_AUDIT`). |
| **Schedules vs Sequences** | Campaign schedule vs sequence definition — documented in Schedules audit; still **cognitive tax**. |
| **Inbox refresh vs replies** | Refresh pulls messages; reply list depends on detection pipeline — **trust** requires reading UI copy. |
| **Dashboard first in nav** | May imply “start here” when **execution** is in Marketing (`ODCRM_INFORMATION_ARCHITECTURE` already notes emphasis tension). |

---

## 6. Confidence gaps

- **Comparing** Dashboard stats to Marketing Reports **without** understanding period + API family.
- **Assuming** empty UI means broken backend — historically **`api` unwrap** bugs caused empty panels (fixed in operator-workflow sweep; guardrails added).
- **Agency client switch** — must **refetch**; several tabs now bind scope; any **missed header** breaks trust (Schedules audit called this out).

---

## 7. What is already strong (do not rework lightly)

- **Tenant isolation** pattern (`X-Customer-Id`, no silent default in agency).
- **Marketing** as a **complete** operational chain (mount sweep: all subviews wired).
- **Inbox** — settled, single path (`INBOX_CLOSEOUT`).
- **Deep send tooling** in Sequences + worker routes — **differentiator**, not throwaway UI.
- **Explicit backend contracts** documented in per-module audits.

---

## 8. What should improve next (planning-level)

1. **Clarify roles** of Dashboard vs Marketing Reports in-product (short copy + links).
2. **Optional “operator home”** that prioritizes **action** over **chart density** (see `DASHBOARD_OPERATOR_WORKFLOW_PLAN_2026-03-19.md`).
3. **Preserve** Sequences depth; improve **findability** and **next-step** links rather than a big-bang simplification without direction.

---

*Map date: 2026-03-19. Repo: ODCRM only.*
