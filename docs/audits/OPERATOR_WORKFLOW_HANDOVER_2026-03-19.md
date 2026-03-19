# Operator workflow handover — 2026-03-19

## 1. What was audited

End-to-end operator path: **lead → sequence/send → reply → follow-up**, across mounted Marketing tabs (Lead Sources, Sequences, Schedules, Inbox, Reports, Readiness) and matching backend routes.

## 2. What was proven

- **Mount:** `MarketingHomePage.tsx` wires all tabs; deep-links use `?tab=marketing-home&view=…`.
- **Shared API client:** `unwrapResponsePayload` in `src/utils/api.ts` means **`response.data` is the inner payload** for `{ data: T }` / `{ success, data: T }` JSON.
- **Bug class:** Readiness, Schedules (detail + test-send toast), and Sequences (audits + operator POST handlers) used **`response.data?.data`**, yielding empty UI / misleading toasts despite successful HTTP responses.
- **Reports** had the same class fixed in PR #335; this run extends the fix to the rest of the core operator loop.

## 3. What safe fixes were completed

- **ReadinessTab.tsx:** send-worker parallel fetches → `set*(results[i]?.data ?? null)`.
- **SchedulesTab.tsx:** preflight, run-history, `sequence-test-send` toast → single-level `.data`.
- **SequencesTab.tsx:** send-worker audits list/summary; queue tick; dry-run worker; live tick; sequence test-send → `res.data` only.
- **Test:** `server/tests/operator-workflow-api-unwrap.test.ts` (run with `npx tsx`).

## 4. What remains deferred

- Guided “happy path” UX (Lead Sources → Sequences) without redesign commitment.
- Sequences monolith decomposition / onboarding copy.
- Longer send-worker history windows (product + cost).
- Stronger Inbox ↔ enrollment cross-links.

## 5. Current operator-workflow production truth

- **Intake:** Lead Sources → `/api/lead-sources/*` (via `leadSourcesApi`).
- **Send:** Sequences + schedules + send-queue/send-worker; tenant required.
- **Replies:** Inbox `/api/inbox/*`, refresh async.
- **Observability:** Reports + Readiness + Sequences diagnostics — all depend on correct **single unwrap** from `api`.

## 6. Recommended next product step

- Smoke-test Readiness panels, Schedules row detail (preflight + history), Sequences audit viewer and “test send” toasts on a real tenant after deploy.

## 7. Recommended next ops/repo step

- `npx tsx server/tests/operator-workflow-api-unwrap.test.ts`
- `npx tsx server/tests/dashboard-scope-and-period.test.ts` (Reports unwrap guard)
- After merge: `prod-check` with merge SHA

---

*Handover: 2026-03-19.*
