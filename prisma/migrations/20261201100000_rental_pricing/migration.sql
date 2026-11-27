-- AlterTable
ALTER TABLE "RentalHireLine" ADD COLUMN "discountPct" REAL;
ALTER TABLE "RentalHireLine" ADD COLUMN "unitPrice" REAL;
ALTER TABLE "RentalHireLine" ADD COLUMN "weekRate" REAL;

-- CreateTable
CREATE TABLE "RentalHireCharge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hireId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RentalHireCharge_hireId_fkey" FOREIGN KEY ("hireId") REFERENCES "RentalHire" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "RentalHire" ADD COLUMN "chargeDays" REAL;
ALTER TABLE "RentalHire" ADD COLUMN "discountPct" REAL;
ALTER TABLE "RentalHire" ADD COLUMN "vatRate" REAL NOT NULL DEFAULT 20;
ALTER TABLE "RentalHire" ADD COLUMN "paymentTerms" TEXT;
ALTER TABLE "RentalHire" ADD COLUMN "customerPo" TEXT;
ALTER TABLE "RentalHire" ADD COLUMN "delivery" TEXT;
ALTER TABLE "RentalHire" ADD COLUMN "deliveryTo" TEXT;
ALTER TABLE "RentalHire" ADD COLUMN "validUntil" DATETIME;
ALTER TABLE "RentalHire" ADD COLUMN "terms" TEXT;
ALTER TABLE "RentalHire" ADD COLUMN "quoteSentAt" DATETIME;
ALTER TABLE "RentalHire" ADD COLUMN "invoiceId" INTEGER REFERENCES "CompanyInvoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- CreateIndex
CREATE UNIQUE INDEX "RentalHire_invoiceId_key" ON "RentalHire"("invoiceId");

-- CreateIndex
CREATE INDEX "RentalHireCharge_hireId_idx" ON "RentalHireCharge"("hireId");

