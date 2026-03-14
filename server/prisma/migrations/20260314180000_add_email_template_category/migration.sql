-- Add persistent template category for Marketing templates
ALTER TABLE "email_templates"
ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'General';
