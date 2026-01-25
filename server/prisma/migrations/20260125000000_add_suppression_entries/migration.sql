-- Add suppression entries for deliverability/compliance
CREATE TABLE "suppression_entries" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "reason" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "suppression_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "suppression_entries_customerId_type_value_key"
  ON "suppression_entries"("customerId", "type", "value");

CREATE INDEX "suppression_entries_customerId_idx" ON "suppression_entries"("customerId");
CREATE INDEX "suppression_entries_type_idx" ON "suppression_entries"("type");
CREATE INDEX "suppression_entries_value_idx" ON "suppression_entries"("value");

ALTER TABLE "suppression_entries"
  ADD CONSTRAINT "suppression_entries_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
