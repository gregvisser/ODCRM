# Workflow guardrails — 2026-03-19

Practical rules to reduce drift, duplicate PRs, and env confusion. Supplement (do not replace) TESTING-CHECKLIST.md, ARCHITECTURE.md, and DEPLOYMENT_GUARDRAILS.md.

---

## Branching and PRs

- **Always branch from `origin/main`.** Before creating a feature branch: `git fetch origin --prune`, `git checkout main`, `git reset --hard origin/main`, then `git checkout -B your-branch origin/main`.
- **One active PR per real unit of work.** Avoid multiple open PRs that touch the same module (e.g. Inbox, Marketing tab) unless one is clearly a follow-up and the first is merged.
- **Close superseded PRs immediately.** If you open a new PR that replaces an older one (same scope), close the old PR with a short comment pointing to the new PR. This avoids confusion about which branch is source of truth.

---

## Merge and deploy

- **Main is deployable.** Only merge when the branch passes lint, `npx tsc --noEmit`, and `npm run build` (frontend and server). See TESTING-CHECKLIST.md.
- **Prod-check expectations.** After merge, run prod parity with `EXPECT_SHA=<merge-sha>` (e.g. `npx --yes cross-env EXPECT_SHA=<sha> node scripts/prod-check.cjs`). Frontend and backend build SHAs must match the merge SHA. See DEPLOYMENT_GUARDRAILS.md and scripts/prod-check.cjs.
- **No pushing diverged local main.** If local `main` has diverged from `origin/main`, do not push. Reset to `origin/main` and re-apply work on a branch.

---

## Local vs production

- **Local env:** `.env.local` (frontend), `server/.env` (backend). Use localhost URLs and same DB as needed for dev.
- **Production:** Azure env vars; no reliance on `.env` in the deployed app. Avoid copying production secrets into local `.env`; use separate DB or read-only if necessary.
- **“Done” for a change:** Code merged to main, CI green, prod-check passed for the merge SHA, and (if user-facing) a quick smoke test on production URL.

---

## Recovery vs permanent fix

- **Fallback recovery:** Restore service (e.g. redeploy, rollback, one-off data fix). Document what was done and why.
- **Permanent fix:** Change code/config so the failure mode is prevented or detected; add tests or guardrails where appropriate; update docs. Prefer permanent fix in the same or next PR.

---

## When to update docs in the same PR

- Adding or changing API routes → update server README or API docs if they exist.
- Changing deployment or parity steps → update DEPLOYMENT_GUARDRAILS.md or TESTING-CHECKLIST.md.
- Closing out a module (e.g. Inbox) → add or update an audit/closeout doc (e.g. docs/audits/).
- Changing “source of truth” (e.g. which component is mounted for a tab) → update ARCHITECTURE.md or the relevant audit.

---

## Verifying production DB truth

- **DB is the source of truth.** Business data lives in the database, not in localStorage. See ARCHITECTURE.md and data-protection rules.
- **Safe verification:** Use Prisma Studio against the **correct** connection (local vs production). In CI/deploy, the production DB is used via secrets; do not assume local `.env` matches production. For a compact guide, see PROD_DB_VERIFICATION_GUIDE_2026-03-19.md.

---

*Created: 2026-03-19. Repo: ODCRM.*
