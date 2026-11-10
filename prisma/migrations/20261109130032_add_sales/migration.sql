-- CreateTable
CREATE TABLE "SalesBrand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'lighting',
    "stage" TEXT NOT NULL DEFAULT 'prospect',
    "website" TEXT,
    "rep" TEXT,
    "repEmail" TEXT,
    "repPhone" TEXT,
    "notes" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalesTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "brandId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesTask_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "SalesBrand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
