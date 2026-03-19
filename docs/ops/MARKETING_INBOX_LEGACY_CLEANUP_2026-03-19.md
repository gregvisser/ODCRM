# Marketing Inbox legacy cleanup — 2026-03-19

## 1. What PR #329 added and its merge SHA

- **PR:** [#329](https://github.com/gregvisser/ODCRM/pull/329) — *chore(ops): stabilize ODCRM guardrails, close out Inbox, and harden Marketing*
- **Scope:** Docs and guardrails only (Inbox closeout audit, Marketing functionality sweep, workflow guardrails, prod DB verification guide, low-risk patch cleanup, stabilization handover).
- **Merge commit SHA:** `aec714bc365d2382933267bf3c7252c160453d42`
- **Post-merge parity (verified after backend deploy caught up):** `EXPECT_SHA=aec714bc365d2382933267bf3c7252c160453d42` → **PARITY_OK** (frontend and backend `__build` / `/api/_build` both matched that SHA).

## 2. Whether `MarketingInboxTab.tsx` was deleted or retained

- **Deleted:** `src/components/MarketingInboxTab.tsx` removed in the follow-up cleanup PR (this change).

## 3. Proof for that decision

- **Imports:** `rg MarketingInboxTab` across `*.{tsx,ts,jsx,js,mjs,cjs}` matched only `src/components/MarketingInboxTab.tsx` (no other file imported it).
- **App shell:** `src/App.tsx` — no reference.
- **Marketing router:** `src/tabs/marketing/MarketingHomePage.tsx` — mounts `InboxTab` from `./components/InboxTab` only.
- **Mounted Inbox source of truth:** `src/tabs/marketing/components/InboxTab.tsx` (unchanged).
- **Docs:** `INBOX_PRODUCTION_DEEPDIVE.md` previously noted the legacy file as unmounted; updated to reflect removal.

## 4. Final parity result

- **After merge of the cleanup PR:** Run  
  `npx --yes cross-env EXPECT_SHA=<cleanup-merge-sha> node scripts/prod-check.cjs`  
  and confirm **PARITY_OK**. *(This section is updated in-repo after that merge with the exact SHA and snippet.)*

## 5. Why this reduces future drift

- One less duplicate “Inbox” implementation in the tree; search and code review no longer surface a misleading parallel component.
- Audit docs point to a single mounted Inbox path (`InboxTab`) and this closeout record.

---

*Last updated: 2026-03-19. Repo: ODCRM.*
