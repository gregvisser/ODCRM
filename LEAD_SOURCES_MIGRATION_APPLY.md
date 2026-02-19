# Lead Sources — How to Apply the Migration

**Migration name:** `20260219120000_add_lead_source_sheet_config_and_row_seen`  
**Path:** `server/prisma/migrations/20260219120000_add_lead_source_sheet_config_and_row_seen/migration.sql`

**Adds:** Enum `LeadSourceType`; tables `lead_source_sheet_configs` (with nullable `gid`), `lead_source_row_seen` (with `batchKey`). Additive only; no destructive changes.

### Final migration SQL structure (summary)

| Order | Statement |
|-------|-----------|
| 1 | `CREATE TYPE "LeadSourceType" AS ENUM ('COGNISM', 'APOLLO', 'SOCIAL', 'BLACKBOOK');` |
| 2 | `CREATE TABLE "lead_source_sheet_configs"` (id, customerId, sourceType, spreadsheetId, **gid** nullable, displayName, isLocked, lastFetchAt, lastError, createdAt, updatedAt, PK) |
| 3 | `CREATE TABLE "lead_source_row_seen"` (id, customerId, sourceType, spreadsheetId, fingerprint, **batchKey**, firstSeenAt, createdAt, updatedAt, PK) |
| 4 | `CREATE UNIQUE INDEX` on sheet_configs (customerId, sourceType) |
| 5 | `CREATE INDEX` on sheet_configs (customerId) |
| 6 | `CREATE UNIQUE INDEX` on row_seen (customerId, sourceType, spreadsheetId, fingerprint) |
| 7 | `CREATE INDEX` on row_seen (customerId) |
| 8 | `CREATE INDEX` on row_seen (customerId, sourceType) |
| 9 | `CREATE INDEX` on row_seen (customerId, sourceType, firstSeenAt) |
| 10 | `CREATE INDEX` on row_seen (customerId, sourceType, batchKey) |
| 11–12 | `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE` for both tables |

Each statement is on its own line and ends with `;`. No concatenated statements or duplicate index names.

---

## Situation

- **Existing migrations:** Yes, under `server/prisma/migrations/` (init and many follow-ups).
- **CI:** `.github/workflows/deploy-backend-azure.yml` runs `npx prisma migrate deploy` against the real DB (with baseline resolve steps for existing migrations).
- **Shadow DB:** `npx prisma migrate dev` uses a temporary shadow database and replays all migrations. If any past migration fails in that replay (e.g. missing table in shadow), `migrate dev` can fail with errors like “underlying table for model customer does not exist.” That is a **shadow-DB limitation**, not a problem with this migration’s SQL.
- **Strategy:** Apply this migration with **`migrate deploy`** against your real database (local or Azure). Do **not** rely on `migrate dev` for creating the migration if shadow DB is broken; the migration file already exists.

---

## Local dev DB

1. Ensure `server/.env` has a valid `DATABASE_URL` pointing at your local (or shared) PostgreSQL.

2. Apply pending migrations:
   ```bash
   cd server
   npx prisma migrate deploy
   ```

3. Regenerate the client (required after schema/migration changes):
   ```bash
   npx prisma generate
   ```

4. **Verify:**  
   - `npx prisma migrate status` → “Database schema is up to date.”  
   - Start the server and call `GET /api/lead-sources` with header `x-customer-id: <some-customer-id>`; you should get `{ sources: [...] }` and no Prisma errors.

---

## Azure production DB

1. **Option A — Let CI do it**  
   Push the branch that contains the new migration. The backend workflow runs `npx prisma migrate deploy` and then deploys the app. Ensure `DATABASE_URL` secret in GitHub points at the Azure PostgreSQL.

2. **Option B — Run deploy yourself**  
   From a machine that can reach Azure DB:
   ```bash
   cd server
   export DATABASE_URL="<your-azure-postgres-connection-string>"
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **Verify:**  
   - `npx prisma migrate status` (with same `DATABASE_URL`) shows migrations applied.  
   - After deploy, hit production `GET /api/lead-sources` with a valid `x-customer-id`; expect 200 and `{ sources: [...] }`.

---

## If `migrate dev --create-only` failed (shadow DB)

You do **not** need to fix the shadow DB to ship this migration. The migration SQL is already in the repo. Use **`migrate deploy`** to apply it. For future new migrations you can:

- Run `migrate deploy` against a real DB that’s up to date, then create the next migration with `migrate dev --name next_change --create-only` (if your shadow DB is fixed), or  
- Write the new migration SQL by hand in a new folder under `server/prisma/migrations/` and again apply with `migrate deploy`.

---

## If you applied this migration manually

If you ran the SQL by hand and need to tell Prisma it’s applied:

```bash
cd server
npx prisma migrate resolve --applied "20260219120000_add_lead_source_sheet_config_and_row_seen"
```

---

## Rollback (emergency only)

This migration only **adds** tables and an enum. There is no built-in “down” in Prisma. To undo you would have to run manual SQL (drop tables, drop enum) and then remove the migration folder from the repo. Prefer fixing forward unless you must revert.

---

---

## Prisma schema consistency

- **Validate:** Run `npx prisma validate` (must pass before deploy). Schema uses `@@map` to snake_case table names: `lead_source_sheet_configs`, `lead_source_row_seen` (aligned with existing conventions in the repo).
- **Generate:** After applying migrations, run `npx prisma generate` so the Node app uses the updated client (LeadSourceType enum and new models).

---

*End of How to Apply*
