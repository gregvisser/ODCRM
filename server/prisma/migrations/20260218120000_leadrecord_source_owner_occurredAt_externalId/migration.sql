-- AlterTable lead_records: add sheet-derived fields and indexes for channel/owner/occurredAt
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "owner" TEXT;

-- Unique constraint for idempotent upsert (customerId + externalId). PostgreSQL allows multiple NULLs in unique.
CREATE UNIQUE INDEX IF NOT EXISTS "lead_records_customerId_externalId_key" ON "lead_records"("customerId", "externalId");

-- Indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS "lead_records_customerId_occurredAt_idx" ON "lead_records"("customerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "lead_records_customerId_source_idx" ON "lead_records"("customerId", "source");
CREATE INDEX IF NOT EXISTS "lead_records_customerId_owner_idx" ON "lead_records"("customerId", "owner");
