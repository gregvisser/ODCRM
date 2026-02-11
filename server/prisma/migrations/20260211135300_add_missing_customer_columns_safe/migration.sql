-- Safe migration to add potentially missing columns to customers table
-- This addresses P2022 errors where columns don't exist in production database
-- Uses IF NOT EXISTS to safely add columns that may already exist in some environments

-- Add missing columns to "customers" table (the canonical table used by Prisma)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "leads_google_sheet_label" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "monthly_revenue_from_customer" DECIMAL(10,2);

-- Also add to "customer" (singular) table IF it exists, for environments with legacy table name
-- Wrap in DO block so it doesn't fail if table doesn't exist
DO $$ 
BEGIN
    -- Try to add columns to "customer" table if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer') THEN
        -- Add columns if not already present
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "leads_google_sheet_label" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "monthly_revenue_from_customer" DECIMAL(10,2);
        
        RAISE NOTICE 'Added missing columns to legacy "customer" table';
    ELSE
        RAISE NOTICE 'Legacy "customer" table does not exist (expected for new environments)';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Legacy "customer" table does not exist (caught exception)';
END $$;

-- Add helpful comments
COMMENT ON COLUMN "customers"."leads_google_sheet_label" IS 'Custom display name for Google Sheet leads reporting link';
COMMENT ON COLUMN "customers"."monthly_revenue_from_customer" IS 'Monthly revenue ODCRM receives from this customer (in GBP)';
