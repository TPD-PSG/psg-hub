-- CreateTable
CREATE TABLE "ProductionExpense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "production" TEXT,
    "category" TEXT NOT NULL DEFAULT 'misc',
    "description" TEXT NOT NULL,
    "supplier" TEXT,
    "netAmount" REAL NOT NULL DEFAULT 0,
    "vatAmount" REAL NOT NULL DEFAULT 0,
    "date" DATETIME,
    "paymentMethod" TEXT DEFAULT 'to_pay',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
