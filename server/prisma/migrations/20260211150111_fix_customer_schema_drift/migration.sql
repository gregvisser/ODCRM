-- Comprehensive Customer Schema Drift Fix
-- Adds ALL missing columns to customers table to resolve P2022 errors
-- Uses IF NOT EXISTS for idempotent re-runs
-- Column names match Prisma schema (camelCase, no @map directives)

-- ============================================================================
-- ABOUT SECTION FIELDS (AI-enriched company data) - NEVER MIGRATED
-- ============================================================================
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "whatTheyDo" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "accreditations" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "keyLeaders" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "companyProfile" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "recentNews" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "companySize" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "headquarters" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "foundingYear" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "socialPresence" JSONB;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "lastEnrichedAt" TIMESTAMP(3);

-- ============================================================================
-- BUSINESS DETAILS - ensure camelCase names match Prisma schema
-- ============================================================================
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "leadsReportingUrl" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "leadsGoogleSheetLabel" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "sector" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "targetJobTitle" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "prospectingLocation" TEXT;

-- ============================================================================
-- FINANCIAL & PERFORMANCE TRACKING
-- ============================================================================
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "monthlyIntakeGBP" DECIMAL(10, 2);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "monthlyRevenueFromCustomer" DECIMAL(10, 2);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "defcon" INTEGER;

-- ============================================================================
-- LEAD TARGETS & ACTUALS
-- ============================================================================
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "weeklyLeadTarget" INTEGER;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "weeklyLeadActual" INTEGER;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "monthlyLeadTarget" INTEGER;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "monthlyLeadActual" INTEGER;

-- ============================================================================
-- AGREEMENT UPLOAD FIELDS (Phase 2 Item 4)
-- ============================================================================
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementFileUrl" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementFileName" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementFileMimeType" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementUploadedAt" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementUploadedByEmail" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementBlobName" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "agreementContainerName" TEXT;

-- ============================================================================
-- ARCHIVE FIELDS (Soft-delete - NEVER delete customers, preserve history)
-- ============================================================================
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "archivedByEmail" TEXT;

-- ============================================================================
-- ACCOUNT DATA (JSON storage)
-- ============================================================================
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "accountData" JSONB;

-- ============================================================================
-- CLIENT STATUS ENUM - ensure it exists and column uses it
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientStatus') THEN
        CREATE TYPE "ClientStatus" AS ENUM ('active', 'inactive', 'onboarding', 'win_back');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add clientStatus column if missing (with default)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'clientStatus'
    ) THEN
        ALTER TABLE "customers" ADD COLUMN "clientStatus" "ClientStatus" NOT NULL DEFAULT 'active';
    END IF;
END $$;

-- ============================================================================
-- INDEXES for archive filtering (performance)
-- ============================================================================
CREATE INDEX IF NOT EXISTS "customers_isArchived_idx" ON "customers"("isArchived");
CREATE INDEX IF NOT EXISTS "customers_clientStatus_idx" ON "customers"("clientStatus");

-- ============================================================================
-- LEGACY TABLE SUPPORT - Also add to "customer" (singular) if exists
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer') THEN
        -- About section
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "website" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "whatTheyDo" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "accreditations" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "keyLeaders" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "companyProfile" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "recentNews" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "companySize" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "headquarters" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "foundingYear" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "socialPresence" JSONB;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "lastEnrichedAt" TIMESTAMP(3);
        -- Business details
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "leadsReportingUrl" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "leadsGoogleSheetLabel" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "sector" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "targetJobTitle" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "prospectingLocation" TEXT;
        -- Financial
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "monthlyIntakeGBP" DECIMAL(10, 2);
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "monthlyRevenueFromCustomer" DECIMAL(10, 2);
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "defcon" INTEGER;
        -- Lead targets
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "weeklyLeadTarget" INTEGER;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "weeklyLeadActual" INTEGER;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "monthlyLeadTarget" INTEGER;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "monthlyLeadActual" INTEGER;
        -- Agreement
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementFileUrl" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementFileName" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementFileMimeType" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementUploadedAt" TIMESTAMP(3);
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementUploadedByEmail" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementBlobName" TEXT;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "agreementContainerName" TEXT;
        -- Archive
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "archivedByEmail" TEXT;
        -- Account data
        ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "accountData" JSONB;
        
        RAISE NOTICE 'Added missing columns to legacy "customer" table';
    ELSE
        RAISE NOTICE 'Legacy "customer" table does not exist (expected)';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Legacy "customer" table does not exist (caught exception)';
END $$;

-- ============================================================================
-- VERIFICATION COMMENTS
-- ============================================================================
COMMENT ON COLUMN "customers"."isArchived" IS 'Soft-delete flag - archived customers are hidden but data preserved';
COMMENT ON COLUMN "customers"."archivedAt" IS 'Timestamp when customer was archived';
COMMENT ON COLUMN "customers"."archivedByEmail" IS 'Email of user who archived the customer';
