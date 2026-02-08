-- Add senderIdentityId to EmailSequence model
-- This field is required for sequences to specify which email account to use for sending

ALTER TABLE "email_sequences"
ADD COLUMN "senderIdentityId" TEXT NOT NULL DEFAULT '';

-- Set a default senderIdentityId for existing sequences
-- We'll use the first active identity for each customer
UPDATE "email_sequences"
SET "senderIdentityId" = (
  SELECT "id"
  FROM "email_identities"
  WHERE "email_identities"."customerId" = "email_sequences"."customerId"
    AND "email_identities"."isActive" = true
  ORDER BY "email_identities"."createdAt" ASC
  LIMIT 1
);

-- Add foreign key constraint
ALTER TABLE "email_sequences"
ADD CONSTRAINT "email_sequences_senderIdentityId_fkey"
FOREIGN KEY ("senderIdentityId") REFERENCES "email_identities"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove the default (not needed after data is populated)
ALTER TABLE "email_sequences"
ALTER COLUMN "senderIdentityId" DROP DEFAULT;