-- AlterTable: add approval fields to Expense
ALTER TABLE "Expense" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "Expense" ADD COLUMN "approvedDate" DATETIME;
ALTER TABLE "Expense" ADD COLUMN "approvalMethod" TEXT;

-- CreateTable: SpendDocument
CREATE TABLE "SpendDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "expenseId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "invoiceDate" DATETIME,
    "invoiceAmount" REAL,
    "issuedForPayment" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpendDocument_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
