# Production DB verification guide — 2026-03-19

How to verify that a critical database column (or schema) exists in the **production** database, and how to avoid the “wrong DB” trap.

---

## Local env DB vs production DB

- **Local:** `server/.env` (and optionally `.env.local` for frontend). `DATABASE_URL` in `server/.env` points at whatever you use for development (e.g. same Azure DB with a different app name, or a local Postgres). This is **not** automatically the same as production.
- **Production:** The live app uses `DATABASE_URL` from **Azure App Service** (or GitHub Actions secrets for deploy). That value is the only source of truth for “production DB” in deploy. CI and deploy scripts that run with `secrets.DATABASE_URL` are using the production DB.

**Trap:** Running a verification script locally with your local `server/.env` only proves the column in the DB that `.env` points to. It does **not** prove the column in the production DB unless you have explicitly set `DATABASE_URL` to the production URL (and you should do that only in a controlled way, e.g. read-only or one-off verification).

---

## Why the CI/deploy secret path is trustworthy

- In the backend deploy workflow, the step that runs after migrations (e.g. “Verify isRead column”) uses `DATABASE_URL` from GitHub secrets (or Azure pipeline variables). That is the same connection string the deployed app uses. So if that step passes, the column is verified in the **same** DB the production backend uses.
- See: `docs/ops/INBOX_ISREAD_PROD_VERIFICATION_2026-03-19.md` for the isRead example.

---

## How to verify a critical column safely

### Option A: Rely on deploy verification (recommended)

- Add a small script (e.g. `server/scripts/verify-isread-column.cjs`) that:
  - Connects with `DATABASE_URL` from env (loaded from `server/.env` when run locally).
  - Checks that the column exists (e.g. via `information_schema` or a single Prisma query that would fail if the column were missing).
  - Prints a single line like `COLUMN_EXISTS=yes` and exits 0, or exits 1 otherwise.
  - Does **not** print connection strings or credentials.
- In the backend deploy workflow, run that script **after** migrations, with `DATABASE_URL` set from secrets. If the step fails, deploy fails. That proves the column in production.

### Option B: One-off manual check against production

- Get the production `DATABASE_URL` from Azure App Service configuration (or your secrets store). Use a read-only or restricted connection if possible.
- From your machine: set `DATABASE_URL` to that value (e.g. in a one-off shell), then run the same verification script from `server/`:  
  `cd server && node scripts/verify-isread-column.cjs`
- Interpret: exit 0 and `COLUMN_EXISTS=yes` means the column exists in that DB. Do not commit the production URL into the repo or leave it in your local `.env`.

---

## How to interpret results

- **COLUMN_EXISTS=yes, exit 0:** The database currently in use (by the script) has the column. If the script was run in CI with production secrets, that database is production.
- **COLUMN_EXISTS=no or exit 1:** The column is missing (or the script hit an error). If this happens in deploy, the deploy fails; fix migrations or schema and re-deploy.
- **VERIFY_ERROR=...:** The script could not complete (e.g. connection error, permission, or wrong schema). Fix the cause before trusting the result.

---

## Existing verification scripts

- **isRead column:** `server/scripts/verify-isread-column.cjs` — checks `email_message_metadata.is_read`. Used in backend deploy. See INBOX_ISREAD_PROD_VERIFICATION_2026-03-19.md.
- **Other columns/tables:** Add similar scripts under `server/scripts/` and run them in deploy if you need to assert production schema for other critical columns.

---

*Created: 2026-03-19. Repo: ODCRM.*
