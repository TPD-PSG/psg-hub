-- AlterTable
ALTER TABLE "Production" ADD COLUMN "toolboxToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Production_toolboxToken_key" ON "Production"("toolboxToken");

