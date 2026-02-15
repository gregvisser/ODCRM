-- Add label field for SheetSourceConfig (label-only display across UI)
-- Backwards compatible: nullable column + safe backfill.

ALTER TABLE "sheet_source_configs"
ADD COLUMN IF NOT EXISTS "label" TEXT;

UPDATE "sheet_source_configs"
SET "label" = CASE "source"
  WHEN 'cognism' THEN 'Cognism'
  WHEN 'apollo' THEN 'Apollo'
  WHEN 'blackbook' THEN 'Social'
  ELSE COALESCE("sheetName", 'Google Sheet')
END
WHERE "label" IS NULL;

