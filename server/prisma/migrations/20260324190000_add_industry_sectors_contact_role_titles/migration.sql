-- CreateTable
CREATE TABLE "industry_sectors" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_role_titles" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_role_titles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "industry_sectors_label_key" ON "industry_sectors"("label");

-- CreateIndex
CREATE INDEX "industry_sectors_label_idx" ON "industry_sectors"("label");

-- CreateIndex
CREATE UNIQUE INDEX "contact_role_titles_label_key" ON "contact_role_titles"("label");

-- CreateIndex
CREATE INDEX "contact_role_titles_label_idx" ON "contact_role_titles"("label");
