-- CreateEnum for ContactStatus
CREATE TYPE "ContactStatus" AS ENUM ('active', 'inactive', 'unsubscribed', 'bounced');

-- CreateEnum for ClientStatus
CREATE TYPE "ClientStatus" AS ENUM ('active', 'inactive', 'onboarding', 'win_back');

-- AlterTable contacts - add status field
ALTER TABLE "contacts" ADD COLUMN "status" "ContactStatus" NOT NULL DEFAULT 'active';
CREATE INDEX "contacts_status_idx" ON "contacts"("status");

-- AlterTable customers - add business fields from ClientAccount
ALTER TABLE "customers" ADD COLUMN "leadsReportingUrl" TEXT;
ALTER TABLE "customers" ADD COLUMN "sector" TEXT;
ALTER TABLE "customers" ADD COLUMN "clientStatus" "ClientStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "customers" ADD COLUMN "targetJobTitle" TEXT;
ALTER TABLE "customers" ADD COLUMN "prospectingLocation" TEXT;
ALTER TABLE "customers" ADD COLUMN "monthlyIntakeGBP" DECIMAL(10,2);
ALTER TABLE "customers" ADD COLUMN "defcon" INTEGER;
ALTER TABLE "customers" ADD COLUMN "weeklyLeadTarget" INTEGER;
ALTER TABLE "customers" ADD COLUMN "weeklyLeadActual" INTEGER;
ALTER TABLE "customers" ADD COLUMN "monthlyLeadTarget" INTEGER;
ALTER TABLE "customers" ADD COLUMN "monthlyLeadActual" INTEGER;

CREATE INDEX "customers_domain_idx" ON "customers"("domain");
CREATE INDEX "customers_name_idx" ON "customers"("name");
CREATE INDEX "customers_clientStatus_idx" ON "customers"("clientStatus");

-- CreateTable customer_contacts
CREATE TABLE "customer_contacts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_contacts_customerId_idx" ON "customer_contacts"("customerId");
CREATE INDEX "customer_contacts_email_idx" ON "customer_contacts"("email");

-- CreateTable contact_lists
CREATE TABLE "contact_lists" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_lists_customerId_idx" ON "contact_lists"("customerId");
CREATE INDEX "contact_lists_customerId_name_idx" ON "contact_lists"("customerId", "name");

-- CreateTable contact_list_members
CREATE TABLE "contact_list_members" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_list_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_list_members_listId_contactId_key" ON "contact_list_members"("listId", "contactId");
CREATE INDEX "contact_list_members_listId_idx" ON "contact_list_members"("listId");
CREATE INDEX "contact_list_members_contactId_idx" ON "contact_list_members"("contactId");

-- CreateTable email_sequences
CREATE TABLE "email_sequences" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_sequences_customerId_idx" ON "email_sequences"("customerId");
CREATE INDEX "email_sequences_customerId_name_idx" ON "email_sequences"("customerId", "name");

-- CreateTable email_sequence_steps
CREATE TABLE "email_sequence_steps" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayDaysFromPrevious" INTEGER NOT NULL DEFAULT 0,
    "subjectTemplate" TEXT NOT NULL,
    "bodyTemplateHtml" TEXT NOT NULL,
    "bodyTemplateText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sequence_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_sequence_steps_sequenceId_stepOrder_key" ON "email_sequence_steps"("sequenceId", "stepOrder");
CREATE INDEX "email_sequence_steps_sequenceId_idx" ON "email_sequence_steps"("sequenceId");

-- AlterTable email_identities - add SMTP fields
ALTER TABLE "email_identities" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "email_identities" ADD COLUMN "smtpPort" INTEGER;
ALTER TABLE "email_identities" ADD COLUMN "smtpUsername" TEXT;
ALTER TABLE "email_identities" ADD COLUMN "smtpPassword" TEXT;
ALTER TABLE "email_identities" ADD COLUMN "smtpSecure" BOOLEAN DEFAULT true;

CREATE INDEX "email_identities_provider_idx" ON "email_identities"("provider");

-- AlterTable email_campaigns - add list and sequence links
ALTER TABLE "email_campaigns" ADD COLUMN "listId" TEXT;
ALTER TABLE "email_campaigns" ADD COLUMN "sequenceId" TEXT;

CREATE INDEX "email_campaigns_listId_idx" ON "email_campaigns"("listId");
CREATE INDEX "email_campaigns_sequenceId_idx" ON "email_campaigns"("sequenceId");

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_listId_fkey" FOREIGN KEY ("listId") REFERENCES "contact_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_listId_fkey" FOREIGN KEY ("listId") REFERENCES "contact_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_sequences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
