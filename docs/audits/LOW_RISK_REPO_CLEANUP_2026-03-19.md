# Low-risk repo cleanup audit — 2026-03-19

## 1. Files reviewed

- **docs/ops/_WIP_diff_before_fix.patch** — Scratch git-diff capture (contains PowerShell stderr and old package-lock/TemplatesTab diff). Not referenced anywhere in code or docs.
- **docs/ops/send-queue-metrics-customers.txt** — Referenced by `.github/workflows/send-queue-metrics-monitor.yml` and `scripts/self-test-send-queue-metrics-workflow-stage2d.mjs`. **Keep.**
- **docs/ops/DEPLOY_MARKER.txt** — One-line deploy SHA/timestamp marker. No references found; could be used by external tooling. **Deferred** (do not delete without confirmation).
- **src/components/MarketingInboxTab.tsx** — **Removed 2026-03-19** in dedicated cleanup (see `docs/ops/MARKETING_INBOX_LEGACY_CLEANUP_2026-03-19.md`). Proof: no imports outside the file before deletion.
- **docs/audits/** — Multiple audit docs; no duplicate “verification notes” that clearly supersede another. INBOX_CLOSEOUT and MARKETING sweep added this run; INBOX_PRODUCTION_DEEPDIVE remains as historical detail. **No deletion.**
- **docs/ops/** — ODCRM_DEPLOY_PARITY_STATUS, INBOX_ISREAD_PROD_VERIFICATION, etc. are status/verification records. **No deletion.**

## 2. Delete-now list

| File | Reason |
|------|--------|
| `docs/ops/_WIP_diff_before_fix.patch` | Scratch patch; not referenced; safe to remove to reduce clutter. |

## 3. Deferred list

| Item | Reason |
|------|--------|
| `docs/ops/DEPLOY_MARKER.txt` | Possible external use; no in-repo references; low value to delete. |
| *(none additional)* | `MarketingInboxTab.tsx` removal completed 2026-03-19. |

## 4. Why each deleted file was safe to remove

- **docs/ops/_WIP_diff_before_fix.patch:** One-off diff capture; filename indicates WIP; no references in repo; content is stale (old package-lock and file diffs). Deleting it cannot affect builds, tests, or workflows.

---

*Audit date: 2026-03-19. Repo: ODCRM.*
