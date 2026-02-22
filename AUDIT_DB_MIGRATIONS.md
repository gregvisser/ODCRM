# AUDIT_DB_MIGRATIONS.md — Database & Migrations Audit
**Generated:** 2026-02-22

---

## Executive Summary

| Category | P0 | P1 | P2 |
|----------|----|----|-----|
| Migration Drift | 1 | 1 | 1 |
| Schema Risks | 0 | 1 | 2 |
| Stale Objects | 0 | 0 | 3 |

---

## 1. Migration Drift (CRITICAL)

Running `npx prisma migrate status` from local repo reveals:

```
39 migrations found in prisma/migrations
Your local migration history and the migrations table from your database are different:

The last common migration is: 20260219120000_add_lead_source_sheet_config_and_row_seen

The migration have not yet been applied:
  20260220140000_add_lead_source_applies_to    ← LOCAL BUT NOT IN PROD

The migrations from the database are not found locally in prisma/migrations:
  20260218120000_add_lead_record_occurred_source_owner_external_id   ← IN PROD DB, NOT LOCAL
  20260218180000_add_workspaces_table                                 ← IN PROD DB, NOT LOCAL
```

### Issue A (P0): `add_workspaces_table` exists in production DB but NOT in local repo

**Severity:** P0 — Schema drift

The production database has a `workspaces` table that does NOT exist in the local `schema.prisma` and is NOT modelled by Prisma. This means:

1. The `workspaces` table is completely invisible to the application — Prisma does not know it exists
2. No Prisma model, no routes, no queries use it
3. It was created by a migration that was applied to production but is missing from the local repo

**Risk:** Any future migration that creates a conflicting object or changes the database in a way that conflicts with `workspaces` will fail unexpectedly. Also raises the question: was this table created intentionally? Is there data in it that needs to be preserved?

**Required action:**
1. Check if the `workspaces` table has any data in production:
   ```sql
   SELECT COUNT(*) FROM workspaces;
   SELECT * FROM workspaces LIMIT 5;
   ```
2. Get the missing migration SQL from the production database migration history:
   ```sql
   SELECT migration_name, applied_steps_count, started_at 
   FROM _prisma_migrations 
   WHERE migration_name IN (
     '20260218120000_add_lead_record_occurred_source_owner_external_id',
     '20260218180000_add_workspaces_table'
   );
   ```
3. Create local copies of these migrations for repo alignment

**DO NOT DROP the workspaces table** until the above investigation is complete.

---

### Issue B (P1): `add_lead_record_occurred_source_owner_external_id` — different name locally

**Local migration (same timestamp, different name):** `20260218120000_leadrecord_source_owner_occurredAt_externalId`

The production DB has `20260218120000_add_lead_record_occurred_source_owner_external_id` but locally the migration folder is named `20260218120000_leadrecord_source_owner_occurredAt_externalId`.

**Assessment:** These are likely the same migration with a renamed folder. The SQL contents should be identical. The Prisma migrations table in the DB tracks migrations by name (folder name) — so this is treated as a different migration, causing the drift.

**Required action:** Run these in prod DB to check if they have the same SQL:
```sql
SELECT migration_name FROM _prisma_migrations 
WHERE migration_name LIKE '20260218120000%';
```

If identical SQL, the local folder was renamed after being applied. Create a local copy with the production migration name to align the history.

---

### Issue C (P1): `add_lead_source_applies_to` NOT applied to production

**Local file:** `server/prisma/migrations/20260220140000_add_lead_source_applies_to/migration.sql`

This migration adds:
```sql
CREATE TYPE "LeadSourceAppliesTo" AS ENUM ('CUSTOMER_ONLY', 'ALL_ACCOUNTS');
ALTER TABLE "lead_source_sheet_configs" ADD COLUMN "appliesTo" "LeadSourceAppliesTo" NOT NULL DEFAULT 'CUSTOMER_ONLY';
CREATE INDEX ...
```

The `schema.prisma` models `appliesTo LeadSourceAppliesTo @default(CUSTOMER_ONLY)` as a required field.

**Current state:** If this migration hasn't run in production, the `appliesTo` column doesn't exist. Any Prisma write to `LeadSourceSheetConfig` that includes `appliesTo` in its `data` object would fail with a P2022 column not found error.

**However:** The backend deploy workflow runs `prisma migrate deploy` which will apply unapplied migrations. This migration should be applied on the next backend deployment. If the backend has been deployed since `20260220140000` was created, it should already be applied.

**Action:** Verify by running `prisma migrate status` from CI or checking the production database.

---

## 2. Duplicate Migration Timestamps (P2)

Two migrations share the timestamp `20260209120000`:

| Migration | Content |
|-----------|---------|
| `20260209120000_add_monthly_revenue_from_customer` | Adds `monthly_revenue_from_customer` column |
| `20260209120000_extend_email_event_model` | Extends `email_events` model |

**Risk:** Prisma uses migration folder names (which include timestamps) to order and track migrations. Duplicate timestamps can cause ordering issues on fresh database installations or when running `prisma migrate deploy` from scratch.

**Current state:** Both are already applied, so no immediate risk. Risk only materializes on a fresh DB setup.

**Fix (P2, non-urgent):** On next major migration sprint, rename one to `20260209121000_extend_email_event_model` (increment minutes by 1) and update the baseline list in the deploy workflow.

---

## 3. Schema Risks

### Soft-Delete Pattern for Customers (P1 — Important)

The `Customer` model has:
```prisma
isArchived    Boolean   @default(false)
archivedAt    DateTime?
archivedByEmail String?
```

Schema comment: `// Archive/soft-delete (NEVER hard-delete customers - preserve historical data)`

**Risk:** Application code must consistently filter `isArchived: false` in all customer queries. If any route does a `findMany` on customers without this filter, archived customers appear in results.

**Check:** Review `customers.ts` route to confirm all `findMany` include `{ isArchived: false }` or explicit opt-in.

---

### `agreementFileUrl` Legacy Column (P2)

```prisma
agreementFileUrl      String?  // LEGACY: Direct blob URL (deprecated, use SAS instead)
```

The schema comment marks this as deprecated. The column still exists and may contain old data. The new pattern uses `agreementBlobName` + `agreementContainerName` for SAS URL generation.

**Action (P2, no urgency):** 
1. Do NOT drop the column — it may contain live URLs
2. Document migration path: when all customers have `agreementBlobName` set, `agreementFileUrl` can be nulled
3. Add a database migration comment or a follow-up task

---

### `SheetSourceConfig` vs `LeadSourceSheetConfig` — Two Similar Models (P2)

```prisma
model SheetSourceConfig {
  // older model: cognism/apollo/blackbook only
  source SheetSource  // enum: cognism, apollo, blackbook
}

model LeadSourceSheetConfig {
  // newer model: COGNISM/APOLLO/SOCIAL/BLACKBOOK
  sourceType LeadSourceType  // enum: COGNISM, APOLLO, SOCIAL, BLACKBOOK
}
```

Both models serve similar purposes (Google Sheet configurations per customer). The older `SheetSourceConfig` uses lowercase enum values; the newer `LeadSourceSheetConfig` uses UPPERCASE enum values and supports `SOCIAL`.

**Assessment:** `SheetSourceConfig` appears to be the older implementation, `LeadSourceSheetConfig` is the current one (used by `leadSources.ts` and `LeadSourcesTabNew.tsx`). The two models may have overlapping data.

**Action (P2):** 
1. Verify which model the active UI (`LeadSourcesTabNew.tsx`) uses → confirm it's `LeadSourceSheetConfig`
2. Check if `SheetSourceConfig` has any data in production: `SELECT COUNT(*) FROM sheet_source_configs`
3. If data exists in `sheet_source_configs`, document migration plan (not delete yet)
4. If empty, mark for cleanup in next migration sprint

---

## 4. Stale Objects List (No Deletion)

| Object | Table/Column | Assessment | Action |
|--------|-------------|------------|--------|
| `workspaces` table | Production DB only | Unknown — needs investigation | Check contents, add local migration |
| `agreementFileUrl` column | `customers.agreementFileUrl` | Deprecated (schema comment) | Keep for now; nullify when all records migrated to blob |
| `SheetSourceConfig` model | `sheet_source_configs` | Superseded by `LeadSourceSheetConfig` | Check if empty; if so, plan safe drop |
| `aboutEnrichment` worker | `workers/aboutEnrichment.ts` | Never started in index.ts | Confirm dead; delete file |

---

## 5. Migration Health Summary

| Migration | Status |
|-----------|--------|
| `20251210132629_init` | ✅ Applied |
| `20260115000000_add_lists_sequences_and_enhanced_customers` | ✅ Applied |
| `20260117000000_add_prospect_steps_and_update_status` | ✅ Applied |
| `20260120000000_add_leads_tables` | ✅ Applied |
| `20260120090000_add_customer_account_data` | ✅ Applied |
| `20260124000000_add_job_taxonomy` | ✅ Applied |
| `20260125000000_add_suppression_entries` | ✅ Applied |
| `20260125000001_add_prospect_status_suppressed` | ✅ Applied |
| `20260125000002_add_email_templates` | ✅ Applied |
| `20260130000000_add_checksum_to_lead_sync` | ✅ Applied |
| `20260202000000_add_lead_status_scoring_conversion` | ✅ Applied |
| `20260202120000_add_sync_metrics_and_controls` | ✅ Applied |
| `20260202160000_add_user_model` | ✅ Applied |
| `20260203180000_add_user_preferences` | ✅ Applied |
| `20260206000000_add_sending_lock` | ✅ Applied |
| `20260206100000_add_sheet_source_config` | ✅ Applied |
| `20260206123000_add_sheet_source_mappings` | ✅ Applied |
| `20260206233000_add_contact_source_rows_and_nullable_sender_identity` | ✅ Applied |
| `20260209000000_make_email_template_customer_id_required` | ✅ Applied |
| `20260209100000_add_sequence_enrollment_status_index` | ✅ Applied |
| `20260209120000_add_monthly_revenue_from_customer` | ✅ Applied (⚠️ duplicate timestamp) |
| `20260209120000_extend_email_event_model` | ✅ Applied (⚠️ duplicate timestamp) |
| `20260209130000_add_leads_sheet_label` | ✅ Applied |
| `20260209132434_add_customer_agreement_fields` | ✅ Applied |
| `20260209200000_add_email_normalization_to_suppression` | ✅ Applied |
| `20260209300000_add_sender_identity_to_sequences` | ✅ Applied |
| `20260209400000_add_send_window_config_to_email_identity` | ✅ Applied |
| `20260209500000_add_id_defaults_to_models` | ✅ Applied |
| `20260209600000_add_customer_audit_events` | ✅ Applied |
| `20260210183204_add_agreement_blob_fields` | ✅ Applied (targeted wrong table "customer", fixed by 20260211) |
| `20260211122601_fix_agreement_blob_fields_customers_table` | ✅ Applied |
| `20260211135300_add_missing_customer_columns_safe` | ✅ Applied |
| `20260211140000_fix_missing_leads_google_sheet_label` | ✅ Applied |
| `20260211143000_fix_missing_monthly_revenue_from_customer` | ✅ Applied |
| `20260211150111_fix_customer_schema_drift` | ✅ Applied |
| `20260215130000_add_sheet_source_label` | ✅ Applied |
| `20260218120000_leadrecord_source_owner_occurredAt_externalId` | ✅ Applied locally (⚠️ name mismatch with prod DB) |
| `20260219120000_add_lead_source_sheet_config_and_row_seen` | ✅ Applied |
| `20260220140000_add_lead_source_applies_to` | ⚠️ Local only — NOT in prod DB |
| `20260218120000_add_lead_record_occurred_source_owner_external_id` | ⚠️ Prod DB only — NOT local |
| `20260218180000_add_workspaces_table` | ⚠️ Prod DB only — NOT local |

---

## 6. Safe Migration Policy

**DO NOT:**
- Drop any table without first confirming it is empty in production AND backed up
- Use `--force` or `--skip-generate` in any production migration
- Run `prisma migrate reset` in production (destroys all data)
- Apply migrations out of order

**DO:**
- Always use `prisma migrate deploy` (not `dev`) in CI
- Add each new migration to the baseline list in `deploy-backend-azure.yml`
- Verify with `prisma migrate status` after each deploy
- Use `IF NOT EXISTS` and `IF EXISTS` guards in all SQL (avoids partial-apply failures)
- For enum additions: use `ALTER TYPE ... ADD VALUE IF NOT EXISTS`

---

## 7. Verification Commands

```bash
# Check current migration status
cd server && npx prisma migrate status

# Validate schema
cd server && npx prisma validate

# Check specific table exists in production
# (run in Prisma Studio or via node script)
cd server && node -e "
const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'workspaces'\`
  .then(r => { console.log('workspaces table count:', r); p.\$disconnect(); });
"
```
