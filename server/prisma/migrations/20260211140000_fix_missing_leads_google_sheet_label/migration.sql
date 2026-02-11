-- Fix missing leadsGoogleSheetLabel column
-- Prisma field: leadsGoogleSheetLabel (no @map directive)
-- Database column: leadsGoogleSheetLabel (exact match - camelCase)

-- Add column to canonical "customers" table
ALTER TABLE "customers"
ADD COLUMN IF NOT EXISTS "leadsGoogleSheetLabel" TEXT;

-- Also add to legacy "customer" table if it exists
DO $$
BEGIN
    ALTER TABLE "customer"
    ADD COLUMN IF NOT EXISTS "leadsGoogleSheetLabel" TEXT;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;
