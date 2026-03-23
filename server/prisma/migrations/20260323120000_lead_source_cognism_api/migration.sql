-- Additive: Cognism API-backed lead source (token + search defaults) alongside existing sheet mode.
CREATE TYPE "LeadSourceProviderMode" AS ENUM ('SHEET', 'COGNISM_API');

ALTER TABLE "lead_source_sheet_configs"
  ADD COLUMN "providerMode" "LeadSourceProviderMode" NOT NULL DEFAULT 'SHEET',
  ADD COLUMN "cognismApiTokenEncrypted" TEXT,
  ADD COLUMN "cognismApiTokenLast4" TEXT,
  ADD COLUMN "cognismSearchDefaults" JSONB;
