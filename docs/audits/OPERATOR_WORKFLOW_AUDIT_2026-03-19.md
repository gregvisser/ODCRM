# Operator workflow audit — 2026-03-19

**Workflow:** Lead in → Sequence runs → Reply arrives → Operator acts with confidence.

Evidence from repo at `origin/main` (branch `codex/operator-workflow-truth-and-safe-fixes`). **DB is truth**; tenant via **`X-Customer-Id`** (and explicit `customerId` where routes allow query). **Agency mode:** no silent client default.

---

## 1. Executive summary

Mounted **Marketing** surfaces (order is user-reorderable; default below) implement the operator loop end-to-end:

| Default order | Tab | Role in workflow |
|---------------|-----|------------------|
| 0 | **Readiness** | Client/sequence health, shortcuts into Sequences/Inbox/Reports |
| 1 | **Reports** | Outreach rollups + queue/run-history context (see `REPORTS_PRODUCTION_AUDIT_2026-03-19.md`; **api unwrap fixed** there) |
| 2 | **Lead Sources** | Sheet-linked batches/contacts → materialization into lists/campaigns (via `leadSourcesApi` → `/api/lead-sources/*`) |
| 3 | **Compliance** | Suppression before/at send |
| 4 | **Email accounts** | Identities for send |
| 5 | **Templates** | Copy for steps |
| 6 | **Sequences** | Definition, enrollments, queue, worker tools, audits |
| 7 | **Schedules** | Campaign schedule pause/resume, stats, preflight/run-history drill-down |
| 8 | **Inbox** | Threads + replies, refresh, reply send |

**Cross-cutting bug (fixed this run):** `api.get` / `api.post` use `unwrapResponsePayload` (`src/utils/api.ts`) so JSON `{ success?, data: T }` or `{ data: T }` becomes **`ApiResponse.data === T`**. Several operator screens still read **`response.data?.data`**, which is **`undefined`** after unwrap — empty readiness drill-downs, empty schedule preflight/history, broken audit viewer, and misleading operator toasts (tick/dry-run/live/test-send). Same class of bug as Marketing Reports (PR #335).

**Strong:** Tenant-scoped APIs, deep Sequences tooling, Inbox reply path, Readiness as a hub.

**Weak / misleading:** Default tab order puts Readiness first but “lead in” often starts at Lead Sources; heavy cognitive load in Sequences monolith; reply detection is async (Inbox refresh copy already warns).

---

## 2. Workflow stages

1. **Intake** — Contacts enter via lead-source batches/sheets or other CRM paths; lists/campaign linkage for outreach.
2. **Targeting** — Sequences + enrollments + queue items; suppression compliance.
3. **Send** — Scheduled engine + worker/tick paths; schedules UI for campaign timing.
4. **Reply** — Inbox sync (`/api/inbox/refresh`), threads and reply list.
5. **Follow-up** — Reply from Inbox; return to Sequences for queue issues; Reports for aggregates.
6. **Observability** — Reports, Readiness snapshot, Sequences diagnostics.

---

## 3. Mounted surfaces involved

| Surface | File | Entry |
|---------|------|--------|
| Marketing shell | `MarketingHomePage.tsx` | Sub-nav `lists`, `sequences`, `schedules`, `inbox`, `reports`, `readiness`, … |
| Lead Sources | `LeadSourcesTabNew.tsx` | `utils/leadSourcesApi` |
| Sequences | `SequencesTab.tsx` | Primary operator console |
| Schedules | `SchedulesTab.tsx` | `/api/schedules*` + send-worker drill-down |
| Inbox | `InboxTab.tsx` | `/api/inbox/*` |
| Reports | `ReportsTab.tsx` | Audited separately (outreach + send-worker reads) |
| Readiness | `ReadinessTab.tsx` | Send-worker snapshot + deep-links |

---

## 4. Backend route/services involved (high level)

- **Lead sources:** `/api/lead-sources/*` (see `server` lead-sources routes), lists/sheets as used from Sequences for snapshots (documented in Sequences audit).
- **Sequences / send path:** `/api/sequences*`, `/api/enrollments*`, `/api/campaigns*`, `/api/send-queue*`, `/api/send-worker/*`, `/api/suppression/*`.
- **Schedules:** `/api/schedules`, `/api/schedules/:id/stats`, pause/resume actions.
- **Inbox:** `/api/inbox/threads`, `/api/inbox/replies`, `/api/inbox/refresh`, thread messages, reply POST.
- **Reports:** `/api/reports/outreach` + send-worker reads (capped `sinceHours`).

---

## 5. Current production-usability verdict

- **Fully working (after this run’s unwrap fixes):** Readiness data panels, Schedules detail send-worker panels, Sequences audit viewer and operator action toasts bind to real payloads.
- **Partial:** Lead → enrollment UX spans Lead Sources + Sequences (operators must know the handoff); Schedules vs Sequences mental model (campaign schedule vs sequence definition).
- **Misleading:** Any remaining double-unwrap would show “empty” while backend succeeds — **addressed** for files in scope.
- **Broken (pre-fix):** See §7.

---

## 6. What is fully working

- Tenant headers on Marketing API usage (`useScopedCustomerSelection` / `RequireActiveClient` patterns).
- Inbox reply POST and read-state updates.
- Backend send-worker and send-queue contracts (shape is consistent `{ success?, data: … }` or `{ data: … }`).

---

## 7. What is partial / misleading / broken

| Area | Issue |
|------|--------|
| **ReadinessTab** send-worker `Promise.all` | **Broken:** `results[n].data?.data` after unwrap → null panels. |
| **SchedulesTab** preflight / run-history / test-send toast | **Broken:** same pattern. |
| **SequencesTab** audits, audit summary, tick/dry-run/live/test-send | **Broken:** `res.data?.data` where payload is already `res.data`. |
| **Lead handoff** | **Partial:** No single “wizard”; operators stitch Lead Sources → Sequences. |
| **Inbox refresh** | **Partial:** Depends on background sync; copy acknowledges delay. |

---

## 8. Safe-fix candidates for this run

1. **Unify api response handling** on ReadinessTab, SchedulesTab, SequencesTab for all endpoints that go through `api.ts` unwrap — use **`response.data`** only; add one-line comments where helpful.
2. **Regression test** — static file test asserting absence of known double-unwrap patterns for these three files.

---

## 8b. Selected fixes for this run (implemented)

| Fix | Reason |
|-----|--------|
| ReadinessTab: `set*(results[i]?.data ?? null)` | Restores exception center, identity, run history, preflight, launch preview, preview-vs-outcome. |
| SchedulesTab: preflight/run-history/test-send use `*.data` | Restores schedule detail truth and accurate toasts. |
| SequencesTab: audits + operator POST handlers use `res.data` | Restores audit UI and operator feedback. |
| `server/tests/operator-workflow-api-unwrap.test.ts` | Static regression guard on Readiness, Schedules, Sequences. |

---

## 9. Deferred larger issues

- Tab order / onboarding tour for “lead → sequence” happy path.
- Reduce Sequences monolith or add guided “minimum path” doc in-product.
- Extend send-worker history windows (product + DB cost).
- Deeper Inbox ↔ enrollment linkage UX.

---

## Appendix — Contract by stage

### A. Lead intake / source truth

| | |
|--|--|
| **Mounted UI** | `LeadSourcesTabNew.tsx` via `leadSourcesApi` |
| **Backend** | `/api/lead-sources/*` |
| **Data truth** | Batches + contacts in DB per tenant; sheets as source |
| **Operator-visible** | Batch status, contacts table, poll/connect |
| **Biggest gap** | Handoff to “enrollable” lists is elsewhere (Sequences) |

### B. Sequence setup / launch truth

| | |
|--|--|
| **Mounted UI** | `SequencesTab.tsx`, `ReadinessTab.tsx` (snapshot) |
| **Backend** | `/api/sequences*`, `/api/enrollments*`, `/api/campaigns*`, send-worker preflight/launch-preview |
| **Data truth** | Sequences, steps, enrollments, queue |
| **Operator-visible** | CRUD, enrollments, readiness blockers |
| **Biggest gap** | Density of panels; archive vs campaign naming |

### C. Schedule / send truth

| | |
|--|--|
| **Mounted UI** | `SchedulesTab.tsx`, Sequences worker panels |
| **Backend** | `/api/schedules*`, `/api/send-worker/*`, `/api/send-queue/*` |
| **Data truth** | Queue items, audits, schedule status |
| **Operator-visible** | Pause/resume, stats, preflight/history (post-fix) |
| **Biggest gap** | 168h caps on many worker summaries (documented on Reports) |

### D. Reply detection / inbox truth

| | |
|--|--|
| **Mounted UI** | `InboxTab.tsx` |
| **Backend** | `/api/inbox/*` |
| **Data truth** | Synced threads/messages in DB |
| **Operator-visible** | Threads, replies list, refresh |
| **Biggest gap** | Async refresh; not instant |

### E. Operator follow-up truth

| | |
|--|--|
| **Mounted UI** | Inbox reply; Sequences queue workbench; Readiness links |
| **Backend** | Reply POST; queue patch routes as used in Sequences |
| **Data truth** | Outbound + inbound mail state |
| **Operator-visible** | Reply sent toast; queue updated after actions |
| **Biggest gap** | Cross-tab context (sequenceId in URL helps) |

### F. Reporting / observability truth

| | |
|--|--|
| **Mounted UI** | `ReportsTab.tsx`, Readiness, Sequences diagnostics |
| **Backend** | `/api/reports/outreach`, send-worker console/run-history, etc. |
| **Data truth** | Audits, events, queue |
| **Operator-visible** | Aggregates + drill-downs |
| **Biggest gap** | Different windows for outreach vs worker (7d cap) — documented on Reports |

---

*Audit: 2026-03-19 — ODCRM.*
