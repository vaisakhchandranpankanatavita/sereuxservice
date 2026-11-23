ALTER TABLE "Service" ADD COLUMN "imageVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ServiceImage" (
    "serviceId" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "ServiceImage_pkey" PRIMARY KEY ("serviceId")
);

ALTER TABLE "ServiceImage" ADD CONSTRAINT "ServiceImage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
