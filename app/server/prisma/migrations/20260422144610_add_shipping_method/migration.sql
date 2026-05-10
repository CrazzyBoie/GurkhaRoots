/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Wishlist` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Wishlist` table. All the data in the column will be lost.
  - You are about to drop the `CountryMethod` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShippingCountry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShippingMethod` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CountryMethod" DROP CONSTRAINT "CountryMethod_countryId_fkey";

-- DropForeignKey
ALTER TABLE "CountryMethod" DROP CONSTRAINT "CountryMethod_methodId_fkey";

-- AlterTable
ALTER TABLE "Address" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingMethod" TEXT NOT NULL DEFAULT 'standard';

-- AlterTable
ALTER TABLE "Wishlist" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- DropTable
DROP TABLE "CountryMethod";

-- DropTable
DROP TABLE "ShippingCountry";

-- DropTable
DROP TABLE "ShippingMethod";
