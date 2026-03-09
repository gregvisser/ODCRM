-- Stage 1 normalized lead sync foundation (non-destructive)

ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "normalizedData" JSONB;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "externalSourceType" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "externalRowFingerprint" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "lastInboundSyncAt" TIMESTAMP(3);
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "lastOutboundSyncAt" TIMESTAMP(3);
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "syncStatus" TEXT;
ALTER TABLE "lead_records" ADD COLUMN IF NOT EXISTS "syncError" TEXT;

CREATE INDEX IF NOT EXISTS "lead_records_customerId_externalSourceType_idx" ON "lead_records"("customerId", "externalSourceType");
CREATE INDEX IF NOT EXISTS "lead_records_customerId_email_idx" ON "lead_records"("customerId", "email");
CREATE INDEX IF NOT EXISTS "lead_records_customerId_syncStatus_idx" ON "lead_records"("customerId", "syncStatus");
CREATE INDEX IF NOT EXISTS "lead_records_customerId_externalRowFingerprint_idx" ON "lead_records"("customerId", "externalRowFingerprint");

ALTER TABLE "lead_sync_states" ADD COLUMN IF NOT EXISTS "lastInboundSyncAt" TIMESTAMP(3);
ALTER TABLE "lead_sync_states" ADD COLUMN IF NOT EXISTS "lastOutboundSyncAt" TIMESTAMP(3);
ALTER TABLE "lead_sync_states" ADD COLUMN IF NOT EXISTS "syncStatus" TEXT;
ALTER TABLE "lead_sync_states" ADD COLUMN IF NOT EXISTS "lastOutboundError" TEXT;

CREATE INDEX IF NOT EXISTS "lead_sync_states_syncStatus_idx" ON "lead_sync_states"("syncStatus");
CREATE INDEX IF NOT EXISTS "lead_sync_states_lastInboundSyncAt_idx" ON "lead_sync_states"("lastInboundSyncAt");
