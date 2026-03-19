# Inbox isRead production verification — 2026-03-19

## Summary

- **Merge SHA (fix):** 948eb2d (PR #326). Prod FE/BE on that SHA; prod-check PARITY_OK; GET /api/inbox/threads returns 200.
- **Production DB column verification:** The backend deploy workflow (`.github/workflows/deploy-backend-azure.yml`) now runs `server/scripts/verify-isread-column.cjs` **after** migrations, using the same `DATABASE_URL` secret as the rest of the deploy. That step uses the **production** database. If the step succeeds, `email_message_metadata.is_read` is proven present in production.

## CI verification step

- **Step name:** "Verify isRead column (production)"
- **Runs:** `cd server && node scripts/verify-isread-column.cjs`
- **Env:** `DATABASE_URL: ${{ secrets.DATABASE_URL }}` (production DB)
- **Output:** `COLUMN_EXISTS=yes` and exit 0 if column exists; otherwise exit 1 (workflow fails).
- **No secrets printed.**

## Post-merge workflow run

- **Run:** Backend deploy triggered by merge of PR #327 (chore(ops): verify isRead column against prod db in deploy). Run ID: 23288166048. URL: https://github.com/gregvisser/ODCRM/actions/runs/23288166048
- **To confirm permanent fix:** When that run (or any subsequent deploy run) completes, open the run log and find the step **"Verify isRead column (production)"**. If the step succeeded and the log shows `COLUMN_EXISTS=yes`, then the production database has `email_message_metadata.is_read` and classification is **A. PERMANENT FIX CONFIRMED**.

## Final classification

- **After the first successful backend deploy run that includes this step:** If "Verify isRead column (production)" passes and logs `COLUMN_EXISTS=yes`, then **A. PERMANENT FIX CONFIRMED** — the column exists in the same DB the deployed backend uses.
- **Until that run is confirmed:** Classification remains **B. STILL NOT FULLY PROVEN** (column verified only on local/env DB previously).

## Manual check (if needed)

To confirm production column without waiting for a deploy: run locally with production `DATABASE_URL` (from Azure App Service config or secrets):  
`cd server && node scripts/verify-isread-column.cjs`  
with `DATABASE_URL` set to the production value. Expect `COLUMN_EXISTS=yes` and exit 0.
