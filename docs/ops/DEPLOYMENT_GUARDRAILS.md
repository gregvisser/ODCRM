# Deployment guardrails

Ops and deployment rules for ODCRM.

---

## Queue Debug Panel (Stage 1C)

The **Queue Debug Panel** is available in the Marketing → Sequences tab: per enrollment row, use **View queue** to open a drawer that lists send-queue items (GET `/api/enrollments/:enrollmentId/queue`), **Refresh queue** to rebuild (POST `.../queue/refresh`), and copyable curl snippets with `X-Customer-Id`. Tenant-safe; no sending.

---

## Cursor Constitution

Canonical rules for Cursor when working on this repo (do everything yourself, no user commands, gates, prod parity, file-lock Handle, bootstrap proof).  
→ **[docs/ops/CURSOR_CONSTITUTION.md](./CURSOR_CONSTITUTION.md)**
