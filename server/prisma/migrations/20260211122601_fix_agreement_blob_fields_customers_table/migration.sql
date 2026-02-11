-- Fix agreement columns: add missing agreementBlobName and agreementContainerName to "customers" table
-- This migration patches forward to fix inconsistency where some columns were added to "customer" (singular) instead of "customers" (plural)

-- Add missing columns to "customers" table (the correct table name used by the app)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementBlobName" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementContainerName" TEXT;

-- Ensure agreementFileUrl exists (should already exist, but IF NOT EXISTS is harmless)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementFileUrl" TEXT;

-- Also add to "customer" (singular) table IF it exists, for environments with legacy table name
-- Wrap in DO block so it doesn't fail if table doesn't exist
DO $$ 
BEGIN
    -- Try to add columns to "customer" table if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer') THEN
        -- Add columns if not already present
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementBlobName" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementContainerName" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementFileUrl" TEXT;
        
        RAISE NOTICE 'Added agreement columns to legacy "customer" table';
    ELSE
        RAISE NOTICE 'Legacy "customer" table does not exist (expected for new environments)';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Legacy "customer" table does not exist (caught exception)';
END $$;

-- Add helpful comment on customers.agreementFileUrl
COMMENT ON COLUMN "customers"."agreementFileUrl" IS 'LEGACY: Direct blob URL (deprecated, use SAS with agreementBlobName/agreementContainerName instead)';
