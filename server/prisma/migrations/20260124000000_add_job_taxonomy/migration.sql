-- Create job taxonomy tables
CREATE TABLE "job_sectors" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "job_sectors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_sectors_label_key" ON "job_sectors"("label");

CREATE TABLE "job_roles" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_roles_label_key" ON "job_roles"("label");
