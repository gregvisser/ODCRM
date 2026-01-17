-- Update ProspectStatus enum to include step3_sent through step10_sent
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'step3_sent';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'step4_sent';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'step5_sent';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'step6_sent';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'step7_sent';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'step8_sent';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'step9_sent';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'step10_sent';

-- CreateTable email_campaign_prospect_steps (if not exists)
CREATE TABLE IF NOT EXISTS "email_campaign_prospect_steps" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignProspectId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaign_prospect_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if table was just created)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'email_campaign_prospect_steps_campaignProspectId_stepNumb'
    ) THEN
        CREATE UNIQUE INDEX "email_campaign_prospect_steps_campaignProspectId_stepNumb" 
        ON "email_campaign_prospect_steps"("campaignProspectId", "stepNumber");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'email_campaign_prospect_steps_campaignId_stepNumber_idx'
    ) THEN
        CREATE INDEX "email_campaign_prospect_steps_campaignId_stepNumber_idx" 
        ON "email_campaign_prospect_steps"("campaignId", "stepNumber");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'email_campaign_prospect_steps_campaignId_scheduledAt_idx'
    ) THEN
        CREATE INDEX "email_campaign_prospect_steps_campaignId_scheduledAt_idx" 
        ON "email_campaign_prospect_steps"("campaignId", "scheduledAt");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'email_campaign_prospect_steps_campaignProspectId_idx'
    ) THEN
        CREATE INDEX "email_campaign_prospect_steps_campaignProspectId_idx" 
        ON "email_campaign_prospect_steps"("campaignProspectId");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'email_campaign_prospect_steps_scheduledAt_idx'
    ) THEN
        CREATE INDEX "email_campaign_prospect_steps_scheduledAt_idx" 
        ON "email_campaign_prospect_steps"("scheduledAt");
    END IF;
END$$;

-- AddForeignKey (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'email_campaign_prospect_steps_campaignId_fkey'
    ) THEN
        ALTER TABLE "email_campaign_prospect_steps" 
        ADD CONSTRAINT "email_campaign_prospect_steps_campaignId_fkey" 
        FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'email_campaign_prospect_steps_campaignProspectId_fkey'
    ) THEN
        ALTER TABLE "email_campaign_prospect_steps" 
        ADD CONSTRAINT "email_campaign_prospect_steps_campaignProspectId_fkey" 
        FOREIGN KEY ("campaignProspectId") REFERENCES "email_campaign_prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;
