/*
  Warnings:

  - You are about to drop the column `name` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `basePrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `ProductVariant` table. All the data in the column will be lost.
  - Added the required column `nameEn` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameRu` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `basePriceRub` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `basePriceUsd` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `descriptionEn` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `descriptionRu` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameEn` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameRu` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `labelEn` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `labelRu` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceRub` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceUsd` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('RUB', 'USD');

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "name",
ADD COLUMN     "nameEn" TEXT NOT NULL,
ADD COLUMN     "nameRu" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'RUB';

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "basePrice",
DROP COLUMN "description",
DROP COLUMN "name",
ADD COLUMN     "basePriceRub" INTEGER NOT NULL,
ADD COLUMN     "basePriceUsd" INTEGER NOT NULL,
ADD COLUMN     "descriptionEn" TEXT NOT NULL,
ADD COLUMN     "descriptionRu" TEXT NOT NULL,
ADD COLUMN     "nameEn" TEXT NOT NULL,
ADD COLUMN     "nameRu" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "label",
DROP COLUMN "price",
ADD COLUMN     "labelEn" TEXT NOT NULL,
ADD COLUMN     "labelRu" TEXT NOT NULL,
ADD COLUMN     "priceRub" INTEGER NOT NULL,
ADD COLUMN     "priceUsd" INTEGER NOT NULL;
