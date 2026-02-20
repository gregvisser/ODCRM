-- Add appliesTo to lead_source_sheet_configs (additive only)
CREATE TYPE "LeadSourceAppliesTo" AS ENUM ('CUSTOMER_ONLY', 'ALL_ACCOUNTS');

ALTER TABLE "lead_source_sheet_configs" ADD COLUMN "appliesTo" "LeadSourceAppliesTo" NOT NULL DEFAULT 'CUSTOMER_ONLY';

CREATE INDEX IF NOT EXISTS "lead_source_sheet_configs_sourceType_appliesTo_idx" ON "lead_source_sheet_configs"("sourceType", "appliesTo");
