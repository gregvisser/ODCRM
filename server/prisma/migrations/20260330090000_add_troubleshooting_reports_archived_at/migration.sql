-- Add archive marker for troubleshooting reports (soft archive, no deletes)
ALTER TABLE "troubleshooting_reports"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "troubleshooting_reports_archivedAt_idx"
  ON "troubleshooting_reports"("archivedAt");

