-- Add lead status, scoring, and conversion tracking fields
ALTER TABLE "lead_records" 
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'new',
ADD COLUMN IF NOT EXISTS "score" INTEGER,
ADD COLUMN IF NOT EXISTS "convertedToContactId" TEXT,
ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "qualifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "enrolledInSequenceId" TEXT;

-- Create LeadStatus enum type
DO $$ BEGIN
  CREATE TYPE "LeadStatus" AS ENUM ('new', 'qualified', 'nurturing', 'closed', 'converted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update status column to use enum (if it was created as TEXT, we'll keep it as TEXT for compatibility)
-- Note: Prisma will handle enum conversion in schema, but we keep TEXT for now

-- Add indexes
CREATE INDEX IF NOT EXISTS "lead_records_status_idx" ON "lead_records"("status");
CREATE INDEX IF NOT EXISTS "lead_records_score_idx" ON "lead_records"("score");
CREATE INDEX IF NOT EXISTS "lead_records_convertedToContactId_idx" ON "lead_records"("convertedToContactId");

-- Add foreign key for converted contact
ALTER TABLE "lead_records" 
ADD CONSTRAINT "lead_records_convertedToContactId_fkey" 
FOREIGN KEY ("convertedToContactId") 
REFERENCES "contacts"("id") 
ON DELETE SET NULL;

-- Create sequence_enrollments table
CREATE TABLE IF NOT EXISTS "sequence_enrollments" (
  "id" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enrolledBy" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastStepCompletedAt" TIMESTAMP(3),
  "nextStepScheduledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "totalEmailsSent" INTEGER NOT NULL DEFAULT 0,
  "totalOpens" INTEGER NOT NULL DEFAULT 0,
  "totalClicks" INTEGER NOT NULL DEFAULT 0,
  "totalReplies" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys for sequence_enrollments
ALTER TABLE "sequence_enrollments" 
ADD CONSTRAINT "sequence_enrollments_sequenceId_fkey" 
FOREIGN KEY ("sequenceId") 
REFERENCES "email_sequences"("id") 
ON DELETE CASCADE;

ALTER TABLE "sequence_enrollments" 
ADD CONSTRAINT "sequence_enrollments_contactId_fkey" 
FOREIGN KEY ("contactId") 
REFERENCES "contacts"("id") 
ON DELETE CASCADE;

-- Create indexes for sequence_enrollments
CREATE UNIQUE INDEX IF NOT EXISTS "sequence_enrollments_sequenceId_contactId_key" ON "sequence_enrollments"("sequenceId", "contactId");
CREATE INDEX IF NOT EXISTS "sequence_enrollments_sequenceId_idx" ON "sequence_enrollments"("sequenceId");
CREATE INDEX IF NOT EXISTS "sequence_enrollments_contactId_idx" ON "sequence_enrollments"("contactId");
CREATE INDEX IF NOT EXISTS "sequence_enrollments_nextStepScheduledAt_idx" ON "sequence_enrollments"("nextStepScheduledAt");
