# Deployment guardrails

Ops and deployment rules for ODCRM.

---

## Queue Debug Panel (Stage 1C)

The **Queue Debug Panel** is available in the Marketing → Sequences tab: per enrollment row, use **View queue** to open a drawer that lists send-queue items (GET `/api/enrollments/:enrollmentId/queue`), **Refresh queue** to rebuild (POST `.../queue/refresh`), and copyable curl snippets with `X-Customer-Id`. Tenant-safe; no sending.

---

## Send-queue tick: ignoreWindow (Stage 1G)

The tick endpoint accepts `ignoreWindow=true` (with `dryRun=false`) to bypass the identity send-window check for one controlled canary send. This requires **`ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW === "true"`** in App Service settings. **Do not enable this in production by default.** It is an ops-only switch for controlled testing (e.g. proving SENT + sentAt outside window). Turn it off after verification.

---

## Cursor Constitution

Canonical rules for Cursor when working on this repo (do everything yourself, no user commands, gates, prod parity, file-lock Handle, bootstrap proof).  
→ **[docs/ops/CURSOR_CONSTITUTION.md](./CURSOR_CONSTITUTION.md)**

---

## Prod parity + backend auto-recovery

- `prod-parity-after-merge` now runs `scripts/prod-check.cjs` with bounded retries and strict `EXPECT_SHA`.
- If FE reaches expected SHA but BE remains stale past the configured threshold, parity flow auto-dispatches `deploy-backend-azure.yml` once for bounded recovery.
- Parity still fails if FE/BE do not both reach the expected SHA within the retry window.
- Human intervention is still required when:
  - backend deploy workflow dispatch fails (token/permissions),
  - backend deploy workflow fails repeatedly,
  - FE and BE remain stale after recovery window.
