# ODCRM Stale File Cleanup — 2026-03-19

**Scope:** Identify files that are proven stale, duplicate, superseded, generated, or no longer required. Delete only LOW-risk items with strong proof. Defer MEDIUM/HIGH.

---

## 1. Executive summary

- **Files reviewed:** Untracked files, docs under docs/ops and docs/audits, WIP/temp patterns.
- **Deletion decision:** One LOW-risk file deleted: `docs/ops/_WIP_diff_before_fix.patch` (scratch patch artifact, not referenced).
- **Deferred:** No other files met the bar for “proven stale” with LOW risk. Other candidates (e.g. older audit docs) left for later cleanup.

---

## 2. Files reviewed

| Path | Category | Notes |
|------|----------|--------|
| docs/ops/_WIP_diff_before_fix.patch | temp/scratch | Old git diff (package-lock, etc.) from a prior session; not referenced anywhere. |
| docs/ops/INBOX_ISREAD_PROD_VERIFICATION_2026-03-19.md | current doc | Describes verify-isread-column.cjs used in deploy workflow; **keep**. |
| server/scripts/verify-isread-column.cjs | active script | Referenced by deploy-backend-azure.yml; **keep**. |
| docs/audits/* (various) | audit docs | Many date-stamped or evergreen; none proven superseded by this task; **keep**. |
| New audit docs (ODCRM_PR_TRIAGE, ODCRM_DRIFT_AUDIT, ODCRM_DEPLOY_PARITY_STATUS, ODCRM_STALE_FILE_CLEANUP) | new | Created this session; **keep**. |

---

## 3. Deletion decision table

| File path | Category | Proof not needed | Risk | Action |
|-----------|----------|------------------|------|--------|
| docs/ops/_WIP_diff_before_fix.patch | temp/scratch | WIP prefix; content is old git diff; no references in repo. | LOW | DELETE NOW |
| docs/ops/INBOX_ISREAD_PROD_VERIFICATION_2026-03-19.md | current doc | Workflow and script still use verify-isread-column; doc describes them. | — | KEEP |
| Any migration files | — | Not reviewed for deletion; migrations never deleted without extraordinary proof. | HIGH | DEFER |
| .env / server/.env | — | Never delete. | HIGH | KEEP |

---

## 4. Files deleted now

- `docs/ops/_WIP_diff_before_fix.patch`

---

## 5. Files deferred

- No other files marked DEFER in this pass. Future cleanup could revisit: duplicate or superseded audit docs (e.g. older PR triage or drift docs), or other WIP/temp files if found and proven unused.

---

## 6. Risks / notes

- **Single deletion:** Only the WIP patch was removed; it had no references and was clearly a one-off diff capture.
- **Audit docs:** Older audits (e.g. pre–2026-03-19) were not deleted; “superseded” would require proof that every claim in the old doc is obsolete and that no process still relies on it.
- **Migrations / env / workflows:** Not considered for deletion in this task.
