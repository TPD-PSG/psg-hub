-- AlterTable
ALTER TABLE "Production" ADD COLUMN "reportEmail" TEXT;

-- CreateTable
CREATE TABLE "ShowReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "venue" TEXT,
    "performance" TEXT,
    "attendance" INTEGER,
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShowReport_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShowReport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
