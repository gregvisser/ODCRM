-- Add archive/soft-delete fields to email_sequences
ALTER TABLE "email_sequences"
  ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "email_sequences"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "email_sequences_isArchived_idx" ON "email_sequences"("isArchived");
