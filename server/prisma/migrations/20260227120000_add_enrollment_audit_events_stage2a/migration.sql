-- CreateTable (Stage 2A: enrollment audit log - additive only)
CREATE TABLE "enrollment_audit_events" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "eventType" TEXT NOT NULL,
    "message" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrollment_audit_events_customerId_enrollmentId_createdAt_idx" ON "enrollment_audit_events"("customerId", "enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "enrollment_audit_events_customerId_recipientEmail_idx" ON "enrollment_audit_events"("customerId", "recipientEmail");
