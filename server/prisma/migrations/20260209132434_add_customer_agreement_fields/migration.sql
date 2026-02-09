-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "agreementFileUrl" TEXT,
ADD COLUMN     "agreementFileName" TEXT,
ADD COLUMN     "agreementFileMimeType" TEXT,
ADD COLUMN     "agreementUploadedAt" TIMESTAMP(3),
ADD COLUMN     "agreementUploadedByEmail" TEXT;
