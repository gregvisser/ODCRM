# ODCRM Drift Audit — 2026-03-19

**Scope:** Repo/workflow stabilization after Inbox PR triage. Identify root causes of drift and enforce operating rules so mismatch, stale PRs, and parity confusion stop recurring.

---

## 1. Executive summary

- **Root cause:** Multiple overlapping Inbox PRs opened in quick succession (unread, pagination, reply sender, date-range) without a single “source branch” or merge order. One PR (318) was branched from an older main; its feature had already landed via other work, so the branch became stale. Duplicate PRs (321/324 for unread, 320/322/323 for pagination) were not consolidated before opening.
- **Repo hygiene:** Branches were left open after being superseded; merge order was undefined; “branch from origin/main” was not enforced before opening new PRs.
- **Deploy/parity:** Frontend and backend both deploy on push to main; backend can lag (build/deploy time), so prod-check often shows FE_UPDATED_BE_STALE until backend workflow completes. prod-parity-after-merge retries and can trigger backend deploy; this is working as designed but should be clearly documented.
- **DB/migration:** isRead and critical columns are now verified in deploy (e.g. #327); no repeatable “prod schema vs code” single command exists beyond migration apply + optional column checks.
- **Docs/narrative:** INBOX_PRODUCTION_DEEPDIVE.md is the single source of truth for Inbox; it was updated by multiple PRs and caused merge conflicts (e.g. #320 rebase). Audit docs and “recommended next PRs” can go stale if not updated after merges.
- **Other modules:** Lead Sources, Sequences, Templates have had their own audit docs and PRs; the same pattern (multiple PRs touching same area, doc conflicts) can recur if branch-from-main and “one logical change per PR” are not enforced.

**Mandatory going forward:** Branch only from current origin/main; one logical feature per PR; close or consolidate duplicate PRs immediately; run prod-check after merges and document parity state; update audit docs in the same PR that changes behavior.

---

## 2. Root causes of recent drift

1. **Overlapping PRs without merge order**  
   Unread (321, 324), pagination (320, 322, 323), reply sender (318), date-range (325) were opened in parallel. No single “base” PR; later merges (324, 325) made 320’s branch unmergeable until rebase.

2. **Branching from stale main**  
   PR 318 was branched from a main that was several commits behind. Reply-sender behavior had already been added to main via other changes. Merging 318 would have reverted or conflicted with current main.

3. **Duplicate feature PRs**  
   321 and 324 implemented the same “explicit unread controls”; 320 covered both thread and reply pagination that 322 and 323 implemented separately. Keeping all open caused confusion and duplicate review.

4. **Single shared doc (INBOX_PRODUCTION_DEEPDIVE.md)**  
   Multiple PRs edited the same audit doc. Rebasing 320 onto main produced a conflict in that file; resolution is manual and easy to get wrong.

5. **No “PR triage before merge” rule**  
   There was no standing rule to list open PRs by area, decide merge order and supersession, then merge or close in one pass before starting new work.

---

## 3. PR/branch hygiene findings

- **Duplicate PRs:** Two “explicit unread” PRs (321, 324); three pagination-related (320, 322, 323). One should have been chosen (or one “pagination” PR), others closed or not opened.
- **Stale branch:** 318 was 6 commits behind main; feature already on main. No process to detect “branch is behind; is my change already there?” before merge.
- **Stacked PRs:** Not used in this set, but constitution already forbids stacked PRs; good to keep.
- **Branch-from-main:** Constitution says “Small sequential PRs off origin/main”. Not consistently followed: 318 was from an older main. No CI check that PR branch is rebased on current main.
- **Recommendation:** Before opening a PR, run `git fetch origin && git merge-base --is-ancestor origin/main HEAD` (or rebase onto origin/main). In triage, compare each PR’s diff to main and to other open PRs in the same area; close superseded/duplicate and define merge order.

---

## 4. Deploy/parity findings

- **Workflows:** Frontend and backend both trigger on push to main. prod-parity-after-merge runs on push, polls with retries (e.g. 90 attempts, 10s delay), and can dispatch backend deploy (AUTO_RECOVER_BACKEND) if backend is stale. prod-sha-drift-check runs after both deploy workflows complete and fails if FE/BE SHA mismatch.
- **Observed:** After merging 324 and 325, frontend served e7eb3a1 quickly; backend still served 1aacc12 (FE_UPDATED_BE_STALE). This is expected until backend workflow finishes; parity job will eventually pass or trigger backend deploy.
- **Weak spots:** (1) No single “parity gate” that blocks “done” until both FE and BE report same SHA in one run (prod-check exits non-zero until then). (2) Backend deploy can be slower than frontend; narrative “prod is at SHA X” should distinguish “FE at X, BE at Y” when Y &lt; X.
- **Recommendation:** Document in DEPLOYMENT_GUARDRAILS or ops doc: “After merge, expect temporary FE_UPDATED_BE_STALE; prod-check or parity workflow will pass once backend deploy completes.” Optionally add a “final parity” job that runs once after both deploys and writes status to an ops doc or badge.

---

## 5. DB/migration verification findings

- **Current state:** Migrations are applied in deploy; isRead column verification was added (e.g. #327) and runs in deploy. There is no single “prod DB schema vs repo schema” diff command run locally or in CI.
- **Confusion risk:** Local and prod both use Azure PostgreSQL; env (DATABASE_URL) distinguishes them. Docs state “DB is truth” and “no localStorage for business data”; that’s clear. Risk is assuming prod has a column or index that was added in a migration not yet applied in prod.
- **Recommendation:** Keep “verify critical columns exist” in deploy (as now). For audits, document “prod schema is defined by migrations applied to prod”; no extra tool mandated. If needed, add a small script that runs in CI against a prod-like DB (e.g. staging) to assert key columns exist.

---

## 6. Docs/narrative drift findings

- **INBOX_PRODUCTION_DEEPDIVE.md:** Single source of truth for Inbox behavior, routes, and “what’s incomplete”. Multiple PRs edit it; conflicts on rebase. “Recommended next PRs” and “What is incomplete” can become wrong after merges (e.g. “No pagination” was true, then 324/325 merged; 320 would add pagination and change the doc again).
- **Audit docs:** Many audit docs in docs/audits/ and docs/ops/; some are date-stamped (e.g. 2026-03-19). Risk: old audits still say “X is missing” when X has shipped.
- **Recommendation:** (1) When merging a PR that fulfills an item in an audit doc, update that doc in the same PR (e.g. “Pagination: done”). (2) In triage, if a PR is closed as superseded, ensure the winning PR’s description or the audit doc reflects the final state. (3) Consider a short “Last verified” or “As of SHA” in key audit docs.

---

## 7. Other module drift risks

- **Lead Sources / Sequences / Templates:** Each has had audits and multiple PRs. Same risks: several open PRs touching the same area, shared docs, and “already on main” vs “only on branch” confusion.
- **Mitigation:** Apply the same rules: branch from current main; one logical change per PR; before opening, check open PRs for same area and consolidate or sequence; after merge, update the relevant audit doc and close superseded PRs.
- **No need to re-audit every module line-by-line for this task;** the Inbox episode is the template for “what not to do” and “what to do” (triage, merge order, close duplicates, doc updates in same PR).

---

## 8. Mandatory operating rules going forward

1. **Branch only from current origin/main:** Before opening a PR, `git fetch origin && git rebase origin/main` (or merge origin/main). CI could optionally check that PR branch is not behind main (e.g. merge-base check).
2. **One logical feature per PR:** Avoid “unread + pagination + doc” in one PR unless it’s a single cohesive change. Prefer one concern per PR to reduce conflict surface and doc clashes.
3. **Triage before merging:** When multiple open PRs touch the same area (e.g. Inbox), list them, decide merge order and which are superseded/duplicate, close those, then merge in order. Document in an audit (e.g. ODCRM_PR_TRIAGE_YYYY-MM-DD.md).
4. **Update audit docs in the same PR:** If a PR “completes” an item in INBOX_PRODUCTION_DEEPDIVE or another audit, update that doc in the same PR so the narrative stays true after merge.
5. **No stacked PRs:** Constitution already forbids; keep it. Do not open PR B “on top of” open PR A; merge A first, then branch from main for B.
6. **Parity and deploy narrative:** After merge, treat “prod at SHA X” as “FE and BE both at X” once prod-check passes. Document temporary FE_UPDATED_BE_STALE as expected until backend deploy completes.

---

## 9. Recommended guardrails to implement

1. **Pre-PR checklist (in repo or agent rule):** Before opening a PR, (a) branch from current origin/main, (b) list open PRs in the same area and close or defer duplicates, (c) ensure no other open PR already implements the same feature.
2. **Post-merge parity note:** In deploy/parity status doc or workflow summary, record “FE SHA / BE SHA” and “PARITY_OK at &lt;timestamp&gt;” so there’s a single place to look.
3. **Audit doc ownership:** In key audit docs (e.g. INBOX_PRODUCTION_DEEPDIVE), add a line “Last updated: &lt;date&gt; (SHA &lt;short&gt;)” when the doc is updated in a PR; optionally a bot or checklist that asks “Did you update the audit doc?”
4. **Optional CI:** Job that on push to main checks that no open PR has a branch that is behind main by more than N commits (e.g. 3); could comment on PRs “Consider rebasing onto main.”
5. **Single triage pass per “wave”:** When starting a cleanup (like this task), do one triage: list open PRs, decide merge/close/keep, merge in order, close superseded, then run prod-check and document result.

---

## 10. Top 5 follow-up actions in priority order

1. **Rebase and merge #320** (pagination) onto current main; resolve INBOX_PRODUCTION_DEEPDIVE.md conflict; merge and run prod-check. Document in deploy/parity status.
2. **Document “expected FE_UPDATED_BE_STALE”** in DEPLOYMENT_GUARDRAILS or ops doc so operators know backend can lag and parity will pass after backend deploy.
3. **Add “Last updated (SHA)” to INBOX_PRODUCTION_DEEPDIVE.md** when next touching it (e.g. in #320 merge), and add a one-line “update audit doc” reminder to the PR template or quality checklist.
4. **Enforce “branch from origin/main” in agent/PR workflow:** Before opening a PR, require fetch + rebase and a quick check that no open PR is clearly superseded by this one.
5. **One-off triage for remaining open PRs (293, 288, 280):** Decide merge/close for docs and i18n PRs so the open-PR list stays minimal and intentional.
