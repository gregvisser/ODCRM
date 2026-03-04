-- Stage 2A: Additive migration - append-only audit for dry-run attempt decisions
CREATE TYPE "OutboundSendAttemptDecision" AS ENUM (
  'WOULD_SEND',
  'SKIP_SUPPRESSED',
  'SKIP_INVALID',
  'SKIP_NO_IDENTITY',
  'SKIP_RATE_LIMIT',
  'ERROR'
);

CREATE TABLE "outbound_send_attempt_audits" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "queueItemId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" "OutboundSendAttemptDecision" NOT NULL,
    "reason" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_send_attempt_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbound_send_attempt_audits_customerId_idx" ON "outbound_send_attempt_audits"("customerId");
CREATE INDEX "outbound_send_attempt_audits_queueItemId_idx" ON "outbound_send_attempt_audits"("queueItemId");
