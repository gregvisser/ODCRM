-- Hotfix: production DB missing column required by Prisma
ALTER TABLE "email_identities"
  ADD COLUMN IF NOT EXISTS "signatureHtml" TEXT;
