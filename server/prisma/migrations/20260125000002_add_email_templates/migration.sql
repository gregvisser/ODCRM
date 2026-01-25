-- Add email templates table for server-side storage
CREATE TABLE "email_templates" (
  "id" TEXT NOT NULL,
  "customerId" TEXT,
  "name" TEXT NOT NULL,
  "subjectTemplate" TEXT NOT NULL,
  "bodyTemplateHtml" TEXT NOT NULL,
  "bodyTemplateText" TEXT,
  "stepNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_templates_customerId_idx" ON "email_templates"("customerId");
CREATE INDEX "email_templates_stepNumber_idx" ON "email_templates"("stepNumber");

ALTER TABLE "email_templates"
  ADD CONSTRAINT "email_templates_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
