-- Add email normalization and source file name to SuppressionEntry
-- Populate emailNormalized for existing email-type entries

ALTER TABLE "suppression_entries"
ADD COLUMN "emailNormalized" TEXT,
ADD COLUMN "sourceFileName" TEXT;

-- Populate emailNormalized for existing email entries
UPDATE "suppression_entries"
SET "emailNormalized" = LOWER(TRIM("value"))
WHERE "type" = 'email';