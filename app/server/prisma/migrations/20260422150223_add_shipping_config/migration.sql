-- CreateTable
CREATE TABLE "ShippingCountry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "baseCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freeThreshold" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'NZD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingCountry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingMethod" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingCountry_code_key" ON "ShippingCountry"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingMethod_countryId_methodId_key" ON "ShippingMethod"("countryId", "methodId");

-- AddForeignKey
ALTER TABLE "ShippingMethod" ADD CONSTRAINT "ShippingMethod_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "ShippingCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
