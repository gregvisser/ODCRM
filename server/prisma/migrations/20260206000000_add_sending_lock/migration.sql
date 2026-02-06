-- Add 'sending' status to ProspectStatus enum for atomic locking
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'sending' AFTER 'pending';

-- Add claim fields to EmailCampaignProspectStep for multi-step idempotency
ALTER TABLE "email_campaign_prospect_steps" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
ALTER TABLE "email_campaign_prospect_steps" ADD COLUMN IF NOT EXISTS "claimedBy" TEXT;
