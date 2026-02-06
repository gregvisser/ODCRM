-- Add mappings column to sheet_source_configs
ALTER TABLE "sheet_source_configs" ADD COLUMN "mappings" JSONB;
