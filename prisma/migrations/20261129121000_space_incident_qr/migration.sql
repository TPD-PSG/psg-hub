-- AlterTable
ALTER TABLE "Entity" ADD COLUMN "hsReportToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Entity_hsReportToken_key" ON "Entity"("hsReportToken");

