-- AlterTable
ALTER TABLE "customer" ADD COLUMN "agreementBlobName" TEXT;
ALTER TABLE "customer" ADD COLUMN "agreementContainerName" TEXT;

-- Add comment to indicate legacy field
COMMENT ON COLUMN "customer"."agreementFileUrl" IS 'LEGACY: Direct blob URL (deprecated, use SAS with blobName instead)';
