-- AlterTable lead_sync_states
ALTER TABLE "lead_sync_states" ADD COLUMN "lastChecksum" TEXT;

-- CreateIndex (optional, for performance if we query by checksum)
CREATE INDEX IF NOT EXISTS "lead_sync_states_lastChecksum_idx" ON "lead_sync_states"("lastChecksum");