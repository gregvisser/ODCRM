-- CreateTable
CREATE TABLE "customer_audit_events" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "fromStatus" "ClientStatus",
    "toStatus" "ClientStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_audit_events_customerId_idx" ON "customer_audit_events"("customerId");

-- CreateIndex
CREATE INDEX "customer_audit_events_customerId_action_idx" ON "customer_audit_events"("customerId", "action");

-- CreateIndex
CREATE INDEX "customer_audit_events_customerId_createdAt_idx" ON "customer_audit_events"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_audit_events_action_idx" ON "customer_audit_events"("action");
