-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "cancelFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0;
