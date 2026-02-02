-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "role" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "accountStatus" TEXT NOT NULL DEFAULT 'Active',
    "lastLoginDate" TIMESTAMP(3),
    "profilePhoto" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_userId_key" ON "users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_userId_idx" ON "users"("userId");

-- CreateIndex
CREATE INDEX "users_accountStatus_idx" ON "users"("accountStatus");
