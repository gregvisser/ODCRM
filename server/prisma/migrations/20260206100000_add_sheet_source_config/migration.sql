-- CreateEnum
CREATE TYPE "SheetSource" AS ENUM ('cognism', 'apollo', 'blackbook');

-- CreateEnum
CREATE TYPE "SheetSyncStatus" AS ENUM ('pending', 'syncing', 'success', 'error');

-- CreateTable
CREATE TABLE "sheet_source_configs" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "source" "SheetSource" NOT NULL,
    "sheetUrl" TEXT,
    "sheetId" TEXT,
    "gid" TEXT,
    "sheetName" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "SheetSyncStatus" NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "rowsUpdated" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheet_source_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sheet_source_configs_customerId_idx" ON "sheet_source_configs"("customerId");

-- CreateIndex
CREATE INDEX "sheet_source_configs_source_idx" ON "sheet_source_configs"("source");

-- CreateIndex
CREATE UNIQUE INDEX "sheet_source_configs_customerId_source_key" ON "sheet_source_configs"("customerId", "source");

-- AddForeignKey
ALTER TABLE "sheet_source_configs" ADD CONSTRAINT "sheet_source_configs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
