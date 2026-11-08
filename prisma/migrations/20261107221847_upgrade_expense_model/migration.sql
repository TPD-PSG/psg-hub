/*
  Warnings:

  - You are about to drop the column `amount` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `paid` on the `Expense` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "budgetLineId" INTEGER NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'pre-production',
    "description" TEXT NOT NULL,
    "estimated" REAL NOT NULL DEFAULT 0,
    "committed" REAL NOT NULL DEFAULT 0,
    "spent" REAL NOT NULL DEFAULT 0,
    "poNumber" TEXT,
    "paymentDue" DATETIME,
    "issuedForPayment" BOOLEAN NOT NULL DEFAULT false,
    "vatExempt" BOOLEAN NOT NULL DEFAULT false,
    "supplier" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("budgetLineId", "createdAt", "description", "id", "notes", "supplier", "updatedAt") SELECT "budgetLineId", "createdAt", "description", "id", "notes", "supplier", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
