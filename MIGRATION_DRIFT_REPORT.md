# MIGRATION_DRIFT_REPORT.md — Safe Reconciliation Plan
**Generated:** 2026-02-22  
**Branch:** audit-remediation-p0

---

## 1. Drift Summary

Running `cd server && npx prisma migrate status` against the production database reveals:

```
39 migrations found in prisma/migrations (local)
Last common migration: 20260219120000_add_lead_source_sheet_config_and_row_seen

Local only (NOT applied to prod DB):
  20260220140000_add_lead_source_applies_to

Prod DB only (NOT found locally in prisma/migrations):
  20260218120000_add_lead_record_occurred_source_owner_external_id  ← name mismatch
  20260218180000_add_workspaces_table                                ← NO local file
```

---

## 2. Investigation Results

### Finding A — `20260218120000` Name Mismatch (LOW RISK)

**Local folder name:**
```
server/prisma/migrations/20260218120000_leadrecord_source_owner_occurredAt_externalId/
```

**Prod DB migration name (from `_prisma_migrations` table):**
```
20260218120000_add_lead_record_occurred_source_owner_external_id
```

**Git evidence:** The local migration was created in commit `b2cb26a` ("Real-time leads: store/display channel + owner from Google Sheets"). 

**SQL content (local):**
```sql
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "owner" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "lead_records_customerId_externalId_key" ...
CREATE INDEX IF NOT EXISTS "lead_records_customerId_occurredAt_idx" ...
-- etc.
```

**Assessment:** These are the same migration — the folder was renamed between when it was applied to production and when it was committed to the local repo. The **schema changes are identical** (confirmed by Prisma schema matching prod columns: `externalId`, `occurredAt`, `source`, `owner` all exist).

**Risk:** NONE for current production operation. Risk only materializes if a fresh database is set up from local migration history — both migration names would run, potentially causing duplicate-column errors. However, the SQL uses `IF NOT EXISTS` guards, so it would be safe.

---

### Finding B — `20260218180000_add_workspaces_table` (UNKNOWN RISK)

**Production DB:** This migration exists and has been applied.  
**Local repo:** NO migration file exists. NOT in git history (searched all commits).  
**Git search result:** `git log --all --oneline -- "server/prisma/migrations/*workspac*"` returned nothing.

**What we know:**
- The `workspaces` table was created by a migration applied directly to the production database
- This migration was NEVER committed to the repository
- The Prisma schema does NOT model a `workspaces` table
- No route, service, or worker file references `workspaces`
- The migration name `20260218180000` places it in the same date as the lead_records rename

**What we don't know:**
- How many rows are in the `workspaces` table
- What columns it has
- Why it was created (was it an experiment? a planned feature? applied by mistake?)

---

### Finding C — `20260220140000_add_lead_source_applies_to` (PENDING IN PROD)

**Local file:** `server/prisma/migrations/20260220140000_add_lead_source_applies_to/migration.sql`  
**SQL:**
```sql
CREATE TYPE "LeadSourceAppliesTo" AS ENUM ('CUSTOMER_ONLY', 'ALL_ACCOUNTS');
ALTER TABLE "lead_source_sheet_configs" ADD COLUMN "appliesTo" "LeadSourceAppliesTo" NOT NULL DEFAULT 'CUSTOMER_ONLY';
CREATE INDEX IF NOT EXISTS "lead_source_sheet_configs_sourceType_appliesTo_idx" ON "lead_source_sheet_configs"("sourceType", "appliesTo");
```

**Status:** This migration is in the local repo but has NOT yet been applied to production.

**Impact if not applied:** The `lead_source_sheet_configs` table in production does not have the `appliesTo` column. The Prisma schema declares `appliesTo LeadSourceAppliesTo @default(CUSTOMER_ONLY)` as required. Any Prisma `create` or `update` on `LeadSourceSheetConfig` that includes `appliesTo` would fail with P2022.

**Assessment:** `prisma migrate deploy` in the CI pipeline will apply this automatically on the next backend deploy. This is the SAFE and EXPECTED path — no manual intervention needed.

---

## 3. Recommended Safe Reconciliation

### Step 1 (IMMEDIATE): Investigate `workspaces` table via production DB query

Run this node script against the production database to understand the table:

```javascript
// Save as: server/scripts/inspect-workspaces-table.cjs
// Run: cd server && node scripts/inspect-workspaces-table.cjs
const { PrismaClient } = require('./node_modules/@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Check if table exists
  const tableExists = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspaces'
  `
  console.log('workspaces table exists:', tableExists)

  // If table exists, get column info and row count
  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspaces'
    ORDER BY ordinal_position
  `
  console.log('columns:', JSON.stringify(columns, null, 2))

  const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM workspaces`
  console.log('row count:', count)

  await prisma.$disconnect()
}

main().catch(console.error)
```

**Expected outcomes:**
- **Table exists, 0 rows, simple columns:** → Create a `migration.sql` placeholder that documents it (no-op since already applied)
- **Table exists, has rows:** → Understand the data, then decide whether to model it in schema or keep it as unmanaged
- **Table does not exist:** → Prisma migrate status output may be stale; re-check

---

### Step 2 (AFTER INVESTIGATION): Add placeholder migration locally

Once the `workspaces` table is understood, add a local migration folder so the git history matches the production DB. This is a documentation-only step — the SQL file records what was applied, not what needs to be applied.

```
server/prisma/migrations/20260218180000_add_workspaces_table/migration.sql
```

Content example (after investigation reveals the schema):
```sql
-- Migration applied to production on 2026-02-18 outside of local repo.
-- Added here for history alignment only. This SQL is already applied in prod.
-- DO NOT run prisma migrate deploy for this specific migration; use:
--   npx prisma migrate resolve --applied "20260218180000_add_workspaces_table"

-- CREATE TABLE "workspaces" (
--   ... columns from investigation ...
-- );
```

After creating the file, run in CI:
```bash
npx prisma migrate resolve --applied "20260218180000_add_workspaces_table"
```
This marks the migration as applied without re-running the SQL.

---

### Step 3: Fix the 20260218120000 name mismatch

After the `workspaces` investigation, add a `resolve` step for the local migration name in the CI baseline list:

In `deploy-backend-azure.yml`, this line is now present (added in this branch):
```bash
npx prisma migrate resolve --applied "20260218120000_leadrecord_source_owner_occurredAt_externalId" || true
```

This ensures CI can resolve the local-name version. The prod-name version
(`20260218120000_add_lead_record_occurred_source_owner_external_id`) was already applied
and won't be re-run because of the same timestamp and the `IF NOT EXISTS` guards.

---

### Step 4: Allow `add_lead_source_applies_to` to deploy normally

**DO NOT manually apply this migration.** The CI pipeline's `prisma migrate deploy` step will apply it automatically on the next backend deployment.

**Safe to deploy:** The migration is additive only (new column with DEFAULT value). No data loss, no row mutations. Existing rows will get `appliesTo = 'CUSTOMER_ONLY'` (the default), which matches the existing singleton-customer behavior.

**Verification after deploy:**
```bash
cd server && npx prisma migrate status
# Expected: all migrations applied, 0 pending
```

---

## 4. What NOT to Do

- ❌ DO NOT run `prisma migrate reset` — destroys all production data
- ❌ DO NOT run `prisma migrate dev` against production database
- ❌ DO NOT manually DROP the `workspaces` table until investigation confirms it is safe
- ❌ DO NOT apply `20260220140000_add_lead_source_applies_to` manually — let CI handle it
- ❌ DO NOT create a new migration to "fix" the name mismatch — use `migrate resolve` instead

---

## 5. Status After This Branch

| Migration | Local | Prod DB | Resolution |
|-----------|-------|---------|------------|
| `20260218120000_leadrecord_source_owner_occurredAt_externalId` | ✅ | Name mismatch | CI baseline updated with local name → `resolve --applied` |
| `20260218180000_add_workspaces_table` | ❌ Missing | ✅ Applied | **Investigate first**, then add placeholder |
| `20260220140000_add_lead_source_applies_to` | ✅ | ❌ Pending | Will apply on next `prisma migrate deploy` in CI |
