-- Persisted imported lead/contact rows for provider-backed Lead Sources (Cognism first).
CREATE TABLE "lead_source_imported_contacts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceType" "LeadSourceType" NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "website" TEXT,
    "domain" TEXT,
    "jobTitle" TEXT,
    "region" TEXT,
    "country" TEXT,
    "flatFields" JSONB NOT NULL DEFAULT '{}',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_source_imported_contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_source_imported_contacts_customerId_sourceType_spreadsheetId_fingerprint_key"
ON "lead_source_imported_contacts"("customerId", "sourceType", "spreadsheetId", "fingerprint");

CREATE INDEX "lead_source_imported_contacts_customerId_sourceType_spreadsheetId_idx"
ON "lead_source_imported_contacts"("customerId", "sourceType", "spreadsheetId");

CREATE INDEX "lead_source_imported_contacts_customerId_sourceType_idx"
ON "lead_source_imported_contacts"("customerId", "sourceType");

ALTER TABLE "lead_source_imported_contacts"
ADD CONSTRAINT "lead_source_imported_contacts_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
