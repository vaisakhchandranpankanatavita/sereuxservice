-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN "kycNote" TEXT;

-- CreateTable
CREATE TABLE "ProviderKyc" (
    "providerId" INTEGER NOT NULL,
    "docType" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "docImage" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderKyc_pkey" PRIMARY KEY ("providerId")
);

-- AddForeignKey
ALTER TABLE "ProviderKyc" ADD CONSTRAINT "ProviderKyc_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pros that already exist were vetted by hand: grandfather them in.
UPDATE "Provider" SET "kycStatus" = 'APPROVED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "otp" TEXT;

-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPhoto_bookingId_idx" ON "JobPhoto"("bookingId");

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
