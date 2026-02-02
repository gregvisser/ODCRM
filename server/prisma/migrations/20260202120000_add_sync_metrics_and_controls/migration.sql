-- Add sync status and control fields to lead_sync_states
ALTER TABLE "lead_sync_states" 
ADD COLUMN IF NOT EXISTS "isPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isRunning" BOOLEAN NOT NULL DEFAULT false;

-- Add performance metrics fields
ALTER TABLE "lead_sync_states"
ADD COLUMN IF NOT EXISTS "syncDuration" INTEGER,
ADD COLUMN IF NOT EXISTS "rowsProcessed" INTEGER,
ADD COLUMN IF NOT EXISTS "rowsInserted" INTEGER,
ADD COLUMN IF NOT EXISTS "rowsUpdated" INTEGER,
ADD COLUMN IF NOT EXISTS "rowsDeleted" INTEGER,
ADD COLUMN IF NOT EXISTS "errorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;

-- Add progress tracking fields
ALTER TABLE "lead_sync_states"
ADD COLUMN IF NOT EXISTS "progressPercent" INTEGER,
ADD COLUMN IF NOT EXISTS "progressMessage" TEXT;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS "lead_sync_states_isPaused_idx" ON "lead_sync_states"("isPaused");
CREATE INDEX IF NOT EXISTS "lead_sync_states_isRunning_idx" ON "lead_sync_states"("isRunning");
