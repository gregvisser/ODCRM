-- Add label field for Google Sheet links
-- Allows custom display names instead of showing raw URLs
ALTER TABLE "customers" ADD COLUMN "leads_google_sheet_label" TEXT;
