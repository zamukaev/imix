-- CreateEnum
CREATE TYPE "TileSurface" AS ENUM ('LIGHT', 'WHITE', 'DARK');

-- CreateEnum
CREATE TYPE "TileWidth" AS ENUM ('FULL', 'HALF');

-- CreateTable
CREATE TABLE "HomeTile" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "width" "TileWidth" NOT NULL DEFAULT 'FULL',
    "surface" "TileSurface" NOT NULL DEFAULT 'LIGHT',
    "headlineRu" TEXT NOT NULL,
    "headlineEn" TEXT NOT NULL,
    "subheadRu" TEXT,
    "subheadEn" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageAltRu" TEXT,
    "imageAltEn" TEXT,
    "primaryLabelRu" TEXT,
    "primaryLabelEn" TEXT,
    "primaryHref" TEXT,
    "secondaryLabelRu" TEXT,
    "secondaryLabelEn" TEXT,
    "secondaryHref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeTile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeTile_published_position_idx" ON "HomeTile"("published", "position");
