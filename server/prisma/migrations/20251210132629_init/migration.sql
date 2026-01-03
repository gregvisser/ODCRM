-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'running', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('pending', 'step1_sent', 'step2_sent', 'bounced', 'unsubscribed', 'replied', 'completed');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('sent', 'bounced', 'delivered', 'opened', 'unsubscribed', 'replied');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('outbound', 'inbound');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "companyName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'cognism',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_identities" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'outlook',
    "outlookTenantId" TEXT,
    "outlookUserId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "dailySendLimit" INTEGER NOT NULL DEFAULT 150,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "senderIdentityId" TEXT NOT NULL,
    "sendWindowHoursStart" INTEGER NOT NULL DEFAULT 9,
    "sendWindowHoursEnd" INTEGER NOT NULL DEFAULT 17,
    "randomizeWithinHours" INTEGER NOT NULL DEFAULT 24,
    "followUpDelayDaysMin" INTEGER NOT NULL DEFAULT 3,
    "followUpDelayDaysMax" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaign_templates" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "subjectTemplate" TEXT NOT NULL,
    "bodyTemplateHtml" TEXT NOT NULL,
    "bodyTemplateText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaign_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaign_prospects" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "senderIdentityId" TEXT NOT NULL,
    "step1ScheduledAt" TIMESTAMP(3),
    "step1SentAt" TIMESTAMP(3),
    "step2ScheduledAt" TIMESTAMP(3),
    "step2SentAt" TIMESTAMP(3),
    "lastStatus" "ProspectStatus" NOT NULL DEFAULT 'pending',
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "lastOpenedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "replyDetectedAt" TIMESTAMP(3),
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastReplySnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaign_prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignProspectId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_message_metadata" (
    "id" TEXT NOT NULL,
    "campaignProspectId" TEXT,
    "senderIdentityId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "threadId" TEXT,
    "direction" "MessageDirection" NOT NULL DEFAULT 'outbound',
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "rawHeaders" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_message_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_id_idx" ON "customers"("id");

-- CreateIndex
CREATE INDEX "contacts_customerId_idx" ON "contacts"("customerId");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_customerId_email_idx" ON "contacts"("customerId", "email");

-- CreateIndex
CREATE INDEX "email_identities_customerId_idx" ON "email_identities"("customerId");

-- CreateIndex
CREATE INDEX "email_identities_emailAddress_idx" ON "email_identities"("emailAddress");

-- CreateIndex
CREATE INDEX "email_identities_isActive_idx" ON "email_identities"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "email_identities_customerId_emailAddress_key" ON "email_identities"("customerId", "emailAddress");

-- CreateIndex
CREATE INDEX "email_campaigns_customerId_idx" ON "email_campaigns"("customerId");

-- CreateIndex
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns"("status");

-- CreateIndex
CREATE INDEX "email_campaigns_customerId_status_idx" ON "email_campaigns"("customerId", "status");

-- CreateIndex
CREATE INDEX "email_campaigns_senderIdentityId_idx" ON "email_campaigns"("senderIdentityId");

-- CreateIndex
CREATE INDEX "email_campaign_templates_campaignId_idx" ON "email_campaign_templates"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "email_campaign_templates_campaignId_stepNumber_key" ON "email_campaign_templates"("campaignId", "stepNumber");

-- CreateIndex
CREATE INDEX "email_campaign_prospects_campaignId_idx" ON "email_campaign_prospects"("campaignId");

-- CreateIndex
CREATE INDEX "email_campaign_prospects_contactId_idx" ON "email_campaign_prospects"("contactId");

-- CreateIndex
CREATE INDEX "email_campaign_prospects_senderIdentityId_idx" ON "email_campaign_prospects"("senderIdentityId");

-- CreateIndex
CREATE INDEX "email_campaign_prospects_lastStatus_idx" ON "email_campaign_prospects"("lastStatus");

-- CreateIndex
CREATE INDEX "email_campaign_prospects_campaignId_lastStatus_idx" ON "email_campaign_prospects"("campaignId", "lastStatus");

-- CreateIndex
CREATE INDEX "email_campaign_prospects_step1ScheduledAt_idx" ON "email_campaign_prospects"("step1ScheduledAt");

-- CreateIndex
CREATE INDEX "email_campaign_prospects_step2ScheduledAt_idx" ON "email_campaign_prospects"("step2ScheduledAt");

-- CreateIndex
CREATE INDEX "email_events_campaignId_idx" ON "email_events"("campaignId");

-- CreateIndex
CREATE INDEX "email_events_campaignProspectId_idx" ON "email_events"("campaignProspectId");

-- CreateIndex
CREATE INDEX "email_events_type_idx" ON "email_events"("type");

-- CreateIndex
CREATE INDEX "email_events_occurredAt_idx" ON "email_events"("occurredAt");

-- CreateIndex
CREATE INDEX "email_events_campaignId_type_idx" ON "email_events"("campaignId", "type");

-- CreateIndex
CREATE INDEX "email_message_metadata_senderIdentityId_idx" ON "email_message_metadata"("senderIdentityId");

-- CreateIndex
CREATE INDEX "email_message_metadata_campaignProspectId_idx" ON "email_message_metadata"("campaignProspectId");

-- CreateIndex
CREATE INDEX "email_message_metadata_threadId_idx" ON "email_message_metadata"("threadId");

-- CreateIndex
CREATE INDEX "email_message_metadata_toAddress_idx" ON "email_message_metadata"("toAddress");

-- CreateIndex
CREATE INDEX "email_message_metadata_providerMessageId_threadId_idx" ON "email_message_metadata"("providerMessageId", "threadId");

-- CreateIndex
CREATE UNIQUE INDEX "email_message_metadata_providerMessageId_key" ON "email_message_metadata"("providerMessageId");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_identities" ADD CONSTRAINT "email_identities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "email_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_templates" ADD CONSTRAINT "email_campaign_templates_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_prospects" ADD CONSTRAINT "email_campaign_prospects_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_prospects" ADD CONSTRAINT "email_campaign_prospects_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_prospects" ADD CONSTRAINT "email_campaign_prospects_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "email_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_campaignProspectId_fkey" FOREIGN KEY ("campaignProspectId") REFERENCES "email_campaign_prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message_metadata" ADD CONSTRAINT "email_message_metadata_campaignProspectId_fkey" FOREIGN KEY ("campaignProspectId") REFERENCES "email_campaign_prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message_metadata" ADD CONSTRAINT "email_message_metadata_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "email_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
