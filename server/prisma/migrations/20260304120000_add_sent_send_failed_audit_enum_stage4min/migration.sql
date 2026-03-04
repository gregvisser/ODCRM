-- Stage 4-min: Add SENT and SEND_FAILED to OutboundSendAttemptDecision (additive enum extension)
ALTER TYPE "OutboundSendAttemptDecision" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "OutboundSendAttemptDecision" ADD VALUE IF NOT EXISTS 'SEND_FAILED';
