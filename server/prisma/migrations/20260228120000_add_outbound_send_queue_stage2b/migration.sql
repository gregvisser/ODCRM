-- CreateEnum
CREATE TYPE "OutboundSendQueueStatus" AS ENUM ('QUEUED', 'LOCKED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "outbound_send_queue_items" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "status" "OutboundSendQueueStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledFor" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_send_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_send_queue_items_customerId_status_scheduledFor_idx" ON "outbound_send_queue_items"("customerId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "outbound_send_queue_items_customerId_enrollmentId_createdAt_idx" ON "outbound_send_queue_items"("customerId", "enrollmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_send_queue_items_customerId_enrollmentId_recipient_key" ON "outbound_send_queue_items"("customerId", "enrollmentId", "recipientEmail", "stepIndex");
