-- Run once on production if deploy failed with P3018/P3009 on 20260323130000_lead_source_imported_contacts.
-- Then redeploy backend so `prisma migrate deploy` can apply the fixed migration SQL.
BEGIN;
DROP TABLE IF EXISTS "lead_source_imported_contacts" CASCADE;
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260323130000_lead_source_imported_contacts'
  AND finished_at IS NULL;
COMMIT;
