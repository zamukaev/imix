-- AlterTable: HomeTile is empty at this point, so the column can land NOT NULL
-- straight away without a backfill step.
ALTER TABLE "HomeTile" ADD COLUMN     "key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "HomeTile_key_key" ON "HomeTile"("key");
