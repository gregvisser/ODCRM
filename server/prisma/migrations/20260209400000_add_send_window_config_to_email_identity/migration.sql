-- Add send window configuration to EmailIdentity
ALTER TABLE "email_identities"
ADD COLUMN "sendWindowHoursStart" INTEGER DEFAULT 9,
ADD COLUMN "sendWindowHoursEnd" INTEGER DEFAULT 17,
ADD COLUMN "sendWindowTimeZone" TEXT DEFAULT 'UTC';