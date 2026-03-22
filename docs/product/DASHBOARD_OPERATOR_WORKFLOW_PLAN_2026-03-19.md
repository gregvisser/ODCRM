# Dashboard + operator workflow — product plan — 2026-03-19

**Status:** Planning only — **no implementation** in the sprint that created this doc. **Evidence:** `DASHBOARD_CURRENT_STATE_2026-03-19.md`, `OPERATOR_WORKFLOW_MAP_2026-03-19.md`, existing module audits (Marketing, Reports, Sequences, Schedules, Inbox, Operator workflow).

---

## 1. Executive summary

**Problem:** ODCRM has a **strong execution engine** (Marketing + Sequences + Schedules + Inbox) and a **credible analytics stack** (Dashboard `/api/reporting/*` + Marketing Reports `/api/reports/*` + send-worker reads). Operators **lose clarity** when they **conflate** those layers or when the **default navigation** does not match **daily work order**.

**Direction:** Position **Dashboard** as **executive / multi-period performance truth** and **Marketing** as **the floor** for **today’s actions**. Reduce **duplicated mental models** through **copy, links, and light IA** before any large UI rewrite.

---

## 2. Product problem statement

Operators need to **trust numbers**, **know where to click next**, and **not re-learn two different “reports” products**. Today, **truth is in the DB and APIs**, but the **UI story** can feel like **many dashboards** (Dashboard tab, Reports sub-tab, Readiness, Schedules stats, Inbox).

---

## 3. What is wrong with the current Dashboard (as a product surface)

- **Role ambiguity** vs Marketing → Reports (different APIs — see `REPORTS_PRODUCTION_AUDIT`).
- **Length and density** — one scroll tries to serve **standup**, **deep diagnostics**, and **export** at once.
- **Limited action linkage** — “What matters now” does not **deep-link** into Sequences / Inbox / Schedules.
- **Nav prominence** — Dashboard is **first top tab**; execution may still **start in Marketing** for many operators.

---

## 4. What the Dashboard should do instead

| Should | Should not |
|--------|------------|
| Answer **“How are we performing** over a chosen period and scope?” | Replace **Marketing Reports** or **Readiness** |
| Show **trends, targets, risk, sourcing** from `/api/reporting/*` | Imply it is the **only** place for “outreach truth” |
| Support **agency all-clients** and **single-client** honestly | Hide **client mode** limits on aggregate |
| Offer **CSV exports** where already implemented | Duplicate **queue/workbench** detail that belongs in Sequences/Reports |

**One-sentence positioning (recommended):** *“Dashboard is executive KPI and trend truth; Marketing is where you run and fix outreach.”*

---

## 5. Relationship between Dashboard and Marketing tabs

| Surface | API family | Best for |
|---------|------------|----------|
| **Dashboard** | `/api/reporting/*` | Rolling / calendar periods, targets, funnel, compliance counts, cross-client aggregate (agency) |
| **Marketing → Reports** | `/api/reports/outreach`, send-worker reads | Send outcomes, queue/run-history **context**, operational follow-up |
| **Marketing → Readiness** | Sequences + send-worker snapshots | Launch guard, shortcuts |
| **Marketing → Schedules** | `/api/schedules*`, worker drill-down | **Active/paused** sequence-linked campaigns only |

**Rule:** If two numbers differ, **the difference is usually window or route** — product should **explain**, not silently merge.

---

## 6. Recommended information architecture (near-term)

- **Keep** five top tabs; **avoid** a disruptive nav restructure (`ODCRM_INFORMATION_ARCHITECTURE` alignment).
- **Clarify labels** in-app: e.g. subtitle under Dashboard hero — *“Executive metrics (`/api/reporting`). For send queue detail, use Marketing → Reports or Readiness.”*
- **Marketing remains “daily home”** in training and empty states; Dashboard remains **“performance home.”**

---

## 7. Recommended staged plan

### Stage 1 — Low-risk improvements (truth + trust)

- **Copy:** 2–3 sentences on Dashboard + Reports clarifying **API / use-case** split.
- **Cross-links:** From Dashboard “What matters now” to **Marketing** views with **query params** preserving tab/view (existing URL sync in `App.tsx`).
- **Empty states:** When metrics null, keep **backend-honest** messaging (already mostly true).
- **Docs:** Keep audits linked from `docs/product/` or `docs/audits/README` if a readme exists.

### Stage 2 — Medium changes (operator throughput)

- **“Action needed” strip** (non-redesign): small list fed by **existing** read-only APIs (e.g. high risk signals + link to Reports/Sequences) — **no new schema**.
- **Dashboard default period** — product choice (e.g. default 7d vs 30d) with **one-line** justification in UI.
- **Client health summary** row — only if spec’d as **aggregations already available** in reporting routes (validate before build).

### Stage 3 — Larger product direction (explicit approval)

- **Unified “operator home”** blending **KPI + next action** — may touch nav default, role-based layout, or split Dashboard into **tabs** (Overview vs Detail).
- **Convergence** of `/api/reporting` vs `/api/reports` — **architectural**; not started without cost/benefit.

---

## 8. What NOT to build yet

- Full **Dashboard visual redesign** without staged plan sign-off.
- **Schema surgery** for analytics convenience.
- **Merging** Marketing Reports into Dashboard **without** resolving API semantics.
- **Inbox / Sequences wholesale UX** — separate product charters (`INBOX_CLOSEOUT` / Sequences audit deferrals).

---

## 9. Exact recommended next implementation PRs / workstreams (ordered)

1. **Docs + copy PR** — In-app subtitles linking Dashboard ↔ Marketing Reports; optional `docs/audits` cross-links (tiny).
2. **Deep-link PR** — Attention panel items navigate to `marketing-home` + `view` with scoped customer preserved.
3. **Nav / default landing experiment PR** (optional) — **Settings flag** or **role** to open Marketing first vs Dashboard — **requires Greg’s call** on product default.
4. **“Action strip” spike PR** — Read-only aggregation from existing endpoints only; feature-flag if needed.
5. **Later:** IA review after telemetry or operator interviews (out of scope here).

---

## 10. Risks / dependencies / decisions Greg must make

| Decision | Options | Risk if unmade |
|----------|---------|------------------|
| **Default landing tab** | Dashboard-first vs Marketing-first | Operators **work around** wrong default forever |
| **KPI authority** | Which surface “wins” for a dispute | **Trust erosion** between teams |
| **All-clients** | Who may use it (already server-gated) | **Training** vs **permission** mismatch |
| **Investment in convergence** | Keep dual APIs vs long-term unify | **Duplicate maintenance** |

---

*Plan date: 2026-03-19. Repo: ODCRM only.*
