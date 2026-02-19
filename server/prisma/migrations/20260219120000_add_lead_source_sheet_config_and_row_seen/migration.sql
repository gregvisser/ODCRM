-- Lead Sources migration — final structure (each statement on its own line, ends with ;):
--   1. CREATE TYPE "LeadSourceType"
--   2. CREATE TABLE "lead_source_sheet_configs" (gid nullable)
--   3. CREATE TABLE "lead_source_row_seen" (batchKey present)
--   4-5. CREATE UNIQUE INDEX for both tables' unique constraints
--   6-10. CREATE INDEX (customerId, customerId+sourceType, firstSeenAt, batchKey)
--   11-12. AddForeignKey for both tables

-- CreateEnum
CREATE TYPE "LeadSourceType" AS ENUM ('COGNISM', 'APOLLO', 'SOCIAL', 'BLACKBOOK');

-- CreateTable
CREATE TABLE "lead_source_sheet_configs" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceType" "LeadSourceType" NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "gid" TEXT,
    "displayName" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_source_sheet_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_source_row_seen" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceType" "LeadSourceType" NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_source_row_seen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_source_sheet_configs_customerId_sourceType_key" ON "lead_source_sheet_configs"("customerId", "sourceType");

-- CreateIndex
CREATE INDEX "lead_source_sheet_configs_customerId_idx" ON "lead_source_sheet_configs"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_source_row_seen_customerId_sourceType_spreadsheetId_fingerprint_key" ON "lead_source_row_seen"("customerId", "sourceType", "spreadsheetId", "fingerprint");

-- CreateIndex
CREATE INDEX "lead_source_row_seen_customerId_idx" ON "lead_source_row_seen"("customerId");

-- CreateIndex
CREATE INDEX "lead_source_row_seen_customerId_sourceType_idx" ON "lead_source_row_seen"("customerId", "sourceType");

-- CreateIndex
CREATE INDEX "lead_source_row_seen_customerId_sourceType_firstSeenAt_idx" ON "lead_source_row_seen"("customerId", "sourceType", "firstSeenAt");

-- CreateIndex
CREATE INDEX "lead_source_row_seen_customerId_sourceType_batchKey_idx" ON "lead_source_row_seen"("customerId", "sourceType", "batchKey");

-- AddForeignKey
ALTER TABLE "lead_source_sheet_configs" ADD CONSTRAINT "lead_source_sheet_configs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_source_row_seen" ADD CONSTRAINT "lead_source_row_seen_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

