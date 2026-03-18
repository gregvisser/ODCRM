-- Add persisted operator-facing batch names for lead source batches.
CREATE TABLE "lead_source_batch_metadata" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceType" "LeadSourceType" NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "operatorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_source_batch_metadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_source_batch_metadata_customerId_sourceType_spreadsheetId_batchKey_key"
ON "lead_source_batch_metadata"("customerId", "sourceType", "spreadsheetId", "batchKey");

CREATE INDEX "lead_source_batch_metadata_customerId_idx"
ON "lead_source_batch_metadata"("customerId");

CREATE INDEX "lead_source_batch_metadata_customerId_sourceType_idx"
ON "lead_source_batch_metadata"("customerId", "sourceType");

CREATE INDEX "lead_source_batch_metadata_customerId_sourceType_spreadsheetId_idx"
ON "lead_source_batch_metadata"("customerId", "sourceType", "spreadsheetId");

ALTER TABLE "lead_source_batch_metadata"
ADD CONSTRAINT "lead_source_batch_metadata_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
