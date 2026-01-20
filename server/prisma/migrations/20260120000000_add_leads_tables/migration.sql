-- CreateTable lead_records
CREATE TABLE IF NOT EXISTS "lead_records" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "sourceUrl" TEXT,
    "sheetGid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable lead_sync_states
CREATE TABLE IF NOT EXISTS "lead_sync_states" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "rowCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'lead_records_customerId_idx'
    ) THEN
        CREATE INDEX "lead_records_customerId_idx" ON "lead_records"("customerId");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'lead_records_accountName_idx'
    ) THEN
        CREATE INDEX "lead_records_accountName_idx" ON "lead_records"("accountName");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'lead_records_updatedAt_idx'
    ) THEN
        CREATE INDEX "lead_records_updatedAt_idx" ON "lead_records"("updatedAt");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'lead_sync_states_customerId_key'
    ) THEN
        CREATE UNIQUE INDEX "lead_sync_states_customerId_key" ON "lead_sync_states"("customerId");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'lead_sync_states_customerId_idx'
    ) THEN
        CREATE INDEX "lead_sync_states_customerId_idx" ON "lead_sync_states"("customerId");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'lead_sync_states_lastSyncAt_idx'
    ) THEN
        CREATE INDEX "lead_sync_states_lastSyncAt_idx" ON "lead_sync_states"("lastSyncAt");
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lead_records_customerId_fkey'
    ) THEN
        ALTER TABLE "lead_records"
        ADD CONSTRAINT "lead_records_customerId_fkey"
        FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lead_sync_states_customerId_fkey'
    ) THEN
        ALTER TABLE "lead_sync_states"
        ADD CONSTRAINT "lead_sync_states_customerId_fkey"
        FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;
