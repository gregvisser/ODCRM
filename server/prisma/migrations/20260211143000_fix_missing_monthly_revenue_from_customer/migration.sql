-- Fix missing monthlyRevenueFromCustomer column
-- Prisma field: monthlyRevenueFromCustomer Decimal? @db.Decimal(10, 2)
-- Database column: monthlyRevenueFromCustomer (exact match - camelCase, no @map)

-- Add column to canonical "customers" table
ALTER TABLE "customers"
ADD COLUMN IF NOT EXISTS "monthlyRevenueFromCustomer" DECIMAL(10, 2);

-- Also add to legacy "customer" table if it exists
DO $$
BEGIN
    ALTER TABLE "customer"
    ADD COLUMN IF NOT EXISTS "monthlyRevenueFromCustomer" DECIMAL(10, 2);
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;
