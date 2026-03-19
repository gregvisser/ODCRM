# ODCRM PR Triage — 2026-03-19

**Repo path:** `C:\CodeProjects\Clients\Opensdoors\ODCRM`  
**Triage branch:** `codex/odcrm-pr-triage-and-drift-audit` @ `origin/main`  
**Main SHA at triage:** `1aacc12`

---

## 1. Executive summary

- **Open PRs reviewed:** 10 (7 Inbox-related, 3 docs/i18n).
- **Decision:** Merge **3** Inbox PRs in a defined order; **close 4** Inbox PRs as superseded or stale; **keep 3** open (docs/i18n, out of scope for this stabilization).
- **Root cause of drift:** Multiple overlapping Inbox PRs (unread controls, pagination, reply sender) with duplicate or superseded work; one PR (318) branched from an older main and is now behind; reply-sender behavior already on main via other commits.

---

## 2. Current open PRs reviewed

| PR   | Title                                                    | Branch                              | Scope        |
|------|----------------------------------------------------------|-------------------------------------|--------------|
| 325  | fix(inbox): remove misleading thread date-range controls | codex/inbox-thread-date-range-truth | Inbox        |
| 324  | feat(inbox): add explicit unread controls                | codex/inbox-explicit-unread         | Inbox        |
| 323  | feat(inbox): add replies load-more controls              | codex/inbox-replies-pagination      | Inbox        |
| 322  | feat(inbox): add thread load-more controls                | codex/inbox-thread-pagination       | Inbox        |
| 321  | feat(inbox): add explicit unread controls                | codex/inbox-unread-management       | Inbox        |
| 320  | feat(inbox): add minimal pagination controls             | codex/inbox-pagination-operator-controls | Inbox   |
| 318  | fix(inbox): make reply sender selection explicit and safe| codex/inbox-reply-sender-safety     | Inbox        |
| 293  | Docs: add export-ready training manual variants          | codex/export-operator-training-manual | Docs       |
| 288  | Docs: add first training session feedback plan           | codex/post-merge-training-feedback-plan | Docs    |
| 280  | feat: add safe English/Arabic UI toggle with RTL          | codex/english-arabic-localization-rtl | i18n      |

---

## 3. PR-by-PR decision table

| PR  | Branch vs main | Already in main? | Superseded by? | Conflicts? | Decision |
|-----|----------------|------------------|----------------|------------|----------|
| 318 | 1 commit ahead, 6 behind | Yes (reply sender + inboxReplySender on main from #319 era) | — | Merge would revert main | **CLOSE AS STALE** |
| 320 | 1 commit ahead | No | — | No (merge test clean) | **MERGE** |
| 321 | 1 commit ahead | No | PR 324 (same feature, newer) | — | **CLOSE AS SUPERSEDED** |
| 322 | 1 commit ahead | No | PR 320 (320 adds both thread + reply pagination) | — | **CLOSE AS SUPERSEDED** |
| 323 | 1 commit ahead | No | PR 320 (same) | — | **CLOSE AS SUPERSEDED** |
| 324 | 1 commit ahead | No | — | No (merge test clean) | **MERGE** |
| 325 | 1 commit ahead | No | — | No (merge test clean) | **MERGE** |
| 293 | — | No | — | Out of scope | **KEEP OPEN** |
| 288 | — | No | — | Out of scope | **KEEP OPEN** |
| 280 | — | No | — | Out of scope | **KEEP OPEN** |

**Evidence for 318:**  
- `git rev-list --count origin/codex/inbox-reply-sender-safety..origin/main` = 6 (main has 6 commits not in 318).  
- `git branch -a --contains 2be2738` does not include `main`; commit 2be2738 is only on 318 and lead-sources branch.  
- Main already has `server/src/utils/inboxReplySender.ts`, `resolveReplySender` in `server/src/routes/inbox.ts`, and reply-sender UI in `InboxTab.tsx` (from later work). Merging 318 would require resolving conflicts and could revert other inbox changes; the *feature* is already on main.

**Evidence for 321 vs 324:**  
- Same title/feature: “explicit unread controls”. PR 324 is newer (2026-03-19), 321 (2026-03-18). Same files: InboxTab, self-test-inbox-read-route, INBOX_PRODUCTION_DEEPDIVE. Keep 324, close 321.

**Evidence for 322/323 vs 320:**  
- PR 320 adds “minimal pagination controls” for both threads and replies in one PR; 322 is thread load-more only, 323 is replies load-more only. 320 created first (09:29), 322/323 later (12:34, 12:42). Merging 320 delivers both; 322 and 323 are superseded by 320.

---

## 4. Which PRs should be merged

- **#324** — feat(inbox): add explicit unread controls — **MERGED**  
- **#325** — fix(inbox): remove misleading thread date-range controls — **MERGED**  
- **#320** — feat(inbox): add minimal pagination controls — **OPEN; merge blocked** (branch needs rebase onto main; conflict in `docs/audits/INBOX_PRODUCTION_DEEPDIVE.md`). After rebase and conflict resolve, merge #320.  

---

## 5. Which PRs should be closed as superseded

- **#321** — superseded by #324 (same feature, newer PR).  
- **#322** — superseded by #320 (thread pagination included in 320).  
- **#323** — superseded by #320 (replies pagination included in 320).  

---

## 6. Which PRs should be closed as stale / invalid

- **#318** — fix(inbox): make reply sender selection explicit and safe  
  - Branch is 6 commits behind main; reply-sender behavior and `inboxReplySender` already exist on main; merging would risk reverting other work. Close as **stale**, not as “superseded” (no other PR replaces it; main already has the behavior).  

---

## 7. Merge order

1. **#324** (explicit unread) — no dependency on others; merges clean.  
2. **#320** (pagination) — larger InboxTab change; merges clean after 324.  
3. **#325** (date-range truth) — UI-only; merges clean after 320.  

Merge in this order to minimize conflict surface and keep a single linear integration.

---

## 8. Risks / notes

- **318:** Closing as stale is correct; the feature is on main. If someone reopens “reply sender” work, it should be a new branch from current main.  
- **320 vs 322+323:** Merging 320 and closing 322/323 is the chosen consolidation; if product prefers separate thread/reply PRs, 322 then 323 could be merged instead and 320 closed — not recommended for this stabilization pass.  
- **293, 288, 280:** Left open; not part of Inbox/repo stabilization. Can be merged or closed in a separate pass.  
- After merging 324, 320, 325: run full build + prod parity check and update deploy/parity status.
