-- Additive: mailbox warm-up / ramp fields (operator-controlled volume ramp for new senders)
ALTER TABLE "email_identities" ADD COLUMN IF NOT EXISTS "warmupEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "email_identities" ADD COLUMN IF NOT EXISTS "warmupStartedAt" TIMESTAMP(3);
