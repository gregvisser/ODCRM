-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_recipients" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrollments_customerId_idx" ON "enrollments"("customerId");

-- CreateIndex
CREATE INDEX "enrollments_sequenceId_idx" ON "enrollments"("sequenceId");

-- CreateIndex
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_recipients_enrollmentId_email_key" ON "enrollment_recipients"("enrollmentId", "email");

-- CreateIndex
CREATE INDEX "enrollment_recipients_enrollmentId_idx" ON "enrollment_recipients"("enrollmentId");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_recipients" ADD CONSTRAINT "enrollment_recipients_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
