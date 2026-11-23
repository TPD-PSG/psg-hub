-- AlterTable
ALTER TABLE "HSDocument" ADD COLUMN "fileKey" TEXT;

-- AlterTable
ALTER TABLE "KnowledgeDoc" ADD COLUMN "fileKey" TEXT;

-- AlterTable
ALTER TABLE "ProductionDocument" ADD COLUMN "fileKey" TEXT;

-- AlterTable
ALTER TABLE "ProductionExpenseDocument" ADD COLUMN "fileKey" TEXT;

-- AlterTable
ALTER TABLE "ShowReport" ADD COLUMN "pdfKey" TEXT;

-- AlterTable
ALTER TABLE "SpendDocument" ADD COLUMN "fileKey" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN "techSpecFileKey" TEXT;

-- AlterTable
ALTER TABLE "VenueDocument" ADD COLUMN "fileKey" TEXT;

