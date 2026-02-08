-- Make EmailTemplate.customerId required (remove global templates)
-- Delete any templates with NULL customerId since global templates are no longer supported

DELETE FROM "email_templates" WHERE "customerId" IS NULL;

-- Make customerId column NOT NULL
ALTER TABLE "email_templates"
ALTER COLUMN "customerId" SET NOT NULL;