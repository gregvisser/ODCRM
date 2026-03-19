# ODCRM stabilization handover — 2026-03-19

Handover from the independent 3–4 hour stabilization run. Use this to see what was completed, what was proven, what remains deferred, and what to do next.

---

## 1. What was completed in this run

- **Phase 1 — Inbox closeout:** Evidence-based closeout of the Marketing Inbox as a stabilized module. Created `docs/audits/INBOX_CLOSEOUT_2026-03-19.md` with mounted path, backend route map, shipped capabilities, known limitations, and “do not change without product direction” scope.
- **Phase 2 — Marketing tab sweep:** Functionality sweep of all nine Marketing subviews (readiness, reports, lists, compliance, email-accounts, templates, sequences, schedules, inbox). Created `docs/audits/MARKETING_TAB_FUNCTIONALITY_SWEEP_2026-03-19.md`. No code changes; mounted surfaces are wired and working; legacy unmounted `MarketingInboxTab` documented and deferred.
- **Phase 3 — Repo/doc/guardrail hardening:** Added `docs/ops/WORKFLOW_GUARDRAILS_2026-03-19.md` (branch from origin/main, one PR per unit of work, close superseded PRs, prod-check expectations, local vs prod, when to update docs) and `docs/ops/MODULE_COMPLETION_RULES_2026-03-19.md` (what “module complete” means, one canonical implementation, closeout doc, no speculative redesign).
- **Phase 4 — Prod DB verification:** Added `docs/ops/PROD_DB_VERIFICATION_GUIDE_2026-03-19.md` (local vs production DB, why CI secret path is trusted, how to verify a critical column, interpretation, reference to existing verify-isread-column.cjs).
- **Phase 5 — Low-risk cleanup:** Removed `docs/ops/_WIP_diff_before_fix.patch` (scratch patch, unreferenced). Created `docs/audits/LOW_RISK_REPO_CLEANUP_2026-03-19.md` with reviewed list, delete-now, and deferred items.
- **Phase 6 — This handover:** Created this doc and opened PR from branch `codex/odcrm-independent-stabilization`.

---

## 2. What was proven

- **Inbox:** Single mounted path `src/tabs/marketing/components/InboxTab.tsx`; backend `server/src/routes/inbox.ts` under `/api/inbox`; all documented routes (threads, replies, messages, read, optout, refresh, reply) are implemented and used by the UI. No open/superseded PR confusion on main.
- **Marketing tab:** All nine subviews are mounted in `MarketingHomePage.tsx` and use live backend routes; tenant scope (`X-Customer-Id`) is used where required. `MarketingInboxTab` in `src/components/` is not mounted and is legacy/dead code.
- **Workflow/parity:** Existing TESTING-CHECKLIST, DEPLOYMENT_GUARDRAILS, prod-check.cjs, and verify-isread-column.cjs are in place; new docs reference them and do not replace them.

---

## 3. What was cleaned up

- Deleted: `docs/ops/_WIP_diff_before_fix.patch` (scratch diff; no references).
- No other files deleted. `MarketingInboxTab.tsx` and `DEPLOY_MARKER.txt` are in the deferred list only.

---

## 4. What remains intentionally deferred

- **Remove or deprecate `src/components/MarketingInboxTab.tsx`:** Recommended as a single, focused PR to avoid drift; confirm no references first.
- **Outlook-style or major Inbox redesign:** Out of scope; requires explicit product direction (see INBOX_CLOSEOUT and MODULE_COMPLETION_RULES).
- **Broad Marketing changes:** Only small, self-contained fixes were in scope; larger work is documented in the Marketing sweep and deferred.

---

## 5. Current production/parity truth

- At run start: branch created from `origin/main` at SHA `766cd92` (post #328). Parity and production status were not re-checked during the run; after merge, run prod-check with `EXPECT_SHA=<merge-sha>` and verify at https://odcrm.bidlow.co.uk and backend `__build`/`_build` as per TESTING-CHECKLIST and DEPLOYMENT_GUARDRAILS.

---

## 6. Marketing tab current truth

- **Mounted:** Marketing Home → subviews: readiness, reports, lists (Lead Sources), compliance, email-accounts, templates, sequences, schedules, inbox. All use live APIs and tenant scope.
- **Inbox:** `InboxTab` only; `MarketingInboxTab` is not mounted. See MARKETING_TAB_FUNCTIONALITY_SWEEP_2026-03-19.md and INBOX_CLOSEOUT_2026-03-19.md.

---

## 7. Recommended next product area to work on

- Per mission, this run was stabilization only. Next product area should be chosen by Greg (e.g. operator workflows, reporting, or a small Marketing improvement from the deferred list).

---

## 8. Recommended next ops/repo hygiene action

- **Merge this PR** and run prod-check with `EXPECT_SHA=<merge-sha>`.
- **Optional:** In a separate PR, remove or deprecate `src/components/MarketingInboxTab.tsx` and add a one-line note in MarketingHomePage or a short deprecation comment in the file.

---

## 9. Exact follow-up PRs or work items (priority order)

1. **Merge** `codex/odcrm-independent-stabilization` → main; run prod-check; smoke-test production.
2. **Optional:** PR to remove or deprecate `MarketingInboxTab.tsx` (document in PR body that mounted Inbox is `InboxTab`; no product change).
3. **When product direction exists:** Any Inbox UX or Marketing feature changes per INBOX_CLOSEOUT and MODULE_COMPLETION_RULES.

---

*Handover date: 2026-03-19. Branch: codex/odcrm-independent-stabilization. Repo: ODCRM.*
