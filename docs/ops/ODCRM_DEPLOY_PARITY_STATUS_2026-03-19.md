# ODCRM Deploy & Parity Status — 2026-03-19

**Date:** 2026-03-19  
**Stabilization task:** PR triage, merge valid PRs, close superseded/stale, then drift audit.

---

## 1. Starting main SHA

`1aacc12` (docs(ops): add post-merge run ID to isRead verification note)

---

## 2. PRs merged

| PR   | Title                                              | Merged (squash) |
|------|----------------------------------------------------|-----------------|
| **#324** | feat(inbox): add explicit unread controls           | Yes             |
| **#325** | fix(inbox): remove misleading thread date-range controls | Yes        |

**#320** (feat(inbox): add minimal pagination controls) was **not** merged: GitHub reported "Pull Request is not mergeable". Branch `codex/inbox-pagination-operator-controls` needs rebase onto current main; conflict in `docs/audits/INBOX_PRODUCTION_DEEPDIVE.md`. After rebase and conflict resolution, #320 can be merged in a follow-up.

---

## 3. PRs closed

| PR   | Title | Closure reason |
|------|-------|----------------|
| **#318** | fix(inbox): make reply sender selection explicit and safe | Stale: branch 6 commits behind main; reply-sender behavior already on main |
| **#321** | feat(inbox): add explicit unread controls | Superseded by #324 (same feature, newer) |
| **#322** | feat(inbox): add thread load-more controls | Superseded by #320 (thread pagination in #320) |
| **#323** | feat(inbox): add replies load-more controls | Superseded by #320 (replies pagination in #320) |

---

## 4. Final main SHA

`e7eb3a1` (fix(inbox): remove misleading thread date-range controls #325)

---

## 5. Frontend live SHA

`e7eb3a1` — matches main.  
Source: `https://odcrm.bidlow.co.uk/__build.json`

---

## 6. Backend live SHA

`1aacc12` — one commit behind main.  
Source: `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build`

---

## 7. prod-check result

Run: `npx --yes cross-env EXPECT_SHA=e7eb3a1c359db5295d667524b6d1fe58a9f5c575 node scripts/prod-check.cjs`

- **Result:** FAIL (exit code 1)  
- **State:** `FE_UPDATED_BE_STALE` — frontend at expected SHA; backend still at 1aacc12.  
- **Note:** Merges #324 and #325 did not change backend runtime code (only added `server/scripts/self-test-inbox-read-route.ts`). Backend at 1aacc12 is still functionally correct; parity will pass once backend deploy runs and reports e7eb3a1.

---

## 8. Deploy / workflow issues

- **#320** not mergeable: merge conflict with main; PR branch needs rebase and conflict resolution in `INBOX_PRODUCTION_DEEPDIVE.md` before merge.  
- **Backend deploy lag:** Frontend deploy (Azure Static Web Apps) updated to e7eb3a1; backend (Azure App Service) still on 1aacc12. Either backend pipeline has not run post-merge or runs on a different trigger. No runtime impact for #324/#325; prod-check will pass once backend deploys to e7eb3a1.

---

## 9. Final deployment/parity verdict

- **Merges:** 2 of 3 intended PRs merged (#324, #325). #320 deferred until rebase.  
- **Closures:** 4 PRs closed (318, 321, 322, 323) per triage.  
- **Frontend:** Deployed and at main SHA.  
- **Backend:** Stale by one commit; no functional gap for current changes.  
- **prod-check:** Fails until backend deploy reports e7eb3a1; then expect PARITY_OK.
