-- Extend EmailEvent model with customerId and additional event types
-- Add customerId column (derived from campaign.customerId)
-- Add senderIdentityId and recipientEmail columns for better reporting

-- First, add the new columns as nullable
ALTER TABLE "email_events"
ADD COLUMN "customerId" TEXT,
ADD COLUMN "senderIdentityId" TEXT,
ADD COLUMN "recipientEmail" TEXT;

-- Populate customerId from campaign relationship
UPDATE "email_events"
SET "customerId" = ec."customerId"
FROM "email_campaigns" ec
WHERE "email_events"."campaignId" = ec."id";

-- Populate senderIdentityId from campaign relationship
UPDATE "email_events"
SET "senderIdentityId" = ec."senderIdentityId"
FROM "email_campaigns" ec
WHERE "email_events"."campaignId" = ec."id";

-- Populate recipientEmail from campaign prospect relationship (if available)
UPDATE "email_events"
SET "recipientEmail" = c."email"
FROM "email_campaign_prospects" cp
JOIN "contacts" c ON cp."contactId" = c."id"
WHERE "email_events"."campaignProspectId" = cp."id";

-- Make customerId NOT NULL (should be populated for all existing records)
ALTER TABLE "email_events"
ALTER COLUMN "customerId" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE "email_events"
ADD CONSTRAINT "email_events_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_events"
ADD CONSTRAINT "email_events_senderIdentityId_fkey"
FOREIGN KEY ("senderIdentityId") REFERENCES "email_identities"("id")
ON DELETE CASCADE ON UPDATE CASCADE;