-- Add index on sequence_enrollments(status) for active sequences query
CREATE INDEX "sequence_enrollments_status_idx" ON "sequence_enrollments"("status");