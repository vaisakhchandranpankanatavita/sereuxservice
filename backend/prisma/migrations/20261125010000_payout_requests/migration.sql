CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "providerId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayoutRequest_status_createdAt_idx" ON "PayoutRequest"("status", "createdAt");
CREATE INDEX "PayoutRequest_providerId_createdAt_idx" ON "PayoutRequest"("providerId", "createdAt");

ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
