-- CreateTable
CREATE TABLE "troubleshooting_reports" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "createdByUserId" TEXT,
    "createdByEmail" TEXT NOT NULL,
    "createdByName" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "appArea" TEXT,
    "pagePath" TEXT,
    "userAgent" TEXT,
    "proofUrl" TEXT,
    "proofFileName" TEXT,
    "proofMimeType" TEXT,
    "proofUploadedAt" TIMESTAMP(3),
    "proofBlobName" TEXT,
    "proofContainerName" TEXT,
    "status" TEXT NOT NULL,
    "internalNotes" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "troubleshooting_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "troubleshooting_reports_customerId_idx" ON "troubleshooting_reports"("customerId");

-- CreateIndex
CREATE INDEX "troubleshooting_reports_createdByEmail_idx" ON "troubleshooting_reports"("createdByEmail");

-- CreateIndex
CREATE INDEX "troubleshooting_reports_status_idx" ON "troubleshooting_reports"("status");

-- CreateIndex
CREATE INDEX "troubleshooting_reports_priority_idx" ON "troubleshooting_reports"("priority");

-- CreateIndex
CREATE INDEX "troubleshooting_reports_createdAt_idx" ON "troubleshooting_reports"("createdAt" DESC);
