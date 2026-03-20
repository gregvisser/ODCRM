-- Idempotent recovery: production could have migration 20260318100000 marked "applied"
-- via `prisma migrate resolve --applied` (see deploy workflow history) without the SQL ever running.
-- This migration creates the table/indexes/FK only when missing — safe for fresh DBs too.

CREATE TABLE IF NOT EXISTS "lead_source_batch_metadata" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceType" "LeadSourceType" NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "operatorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_source_batch_metadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lead_source_batch_metadata_customerId_sourceType_spreadsheetId_batchKey_key"
ON "lead_source_batch_metadata"("customerId", "sourceType", "spreadsheetId", "batchKey");

CREATE INDEX IF NOT EXISTS "lead_source_batch_metadata_customerId_idx"
ON "lead_source_batch_metadata"("customerId");

CREATE INDEX IF NOT EXISTS "lead_source_batch_metadata_customerId_sourceType_idx"
ON "lead_source_batch_metadata"("customerId", "sourceType");

CREATE INDEX IF NOT EXISTS "lead_source_batch_metadata_customerId_sourceType_spreadsheetId_idx"
ON "lead_source_batch_metadata"("customerId", "sourceType", "spreadsheetId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_source_batch_metadata_customerId_fkey'
  ) THEN
    ALTER TABLE "lead_source_batch_metadata"
    ADD CONSTRAINT "lead_source_batch_metadata_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
