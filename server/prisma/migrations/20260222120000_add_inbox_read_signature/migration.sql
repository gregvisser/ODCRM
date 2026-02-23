-- Migration: 20260222120000_add_inbox_read_signature
-- Additive only. No existing columns dropped.

-- Add isRead to email_message_metadata for inbox read/unread tracking
ALTER TABLE "email_message_metadata"
  ADD COLUMN IF NOT EXISTS "is_read" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "body_preview" TEXT;

-- Add signatureHtml to email_identities for per-identity email signatures
ALTER TABLE "email_identities"
  ADD COLUMN IF NOT EXISTS "signature_html" TEXT;
