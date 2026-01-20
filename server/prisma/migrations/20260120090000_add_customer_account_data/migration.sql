-- Add account_data JSONB column for storing full account payloads
ALTER TABLE "customers" ADD COLUMN "accountData" JSONB;
