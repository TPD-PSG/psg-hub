-- CreateTable
CREATE TABLE "ProductionNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "color" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionNote_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProductionNote_productionId_idx" ON "ProductionNote"("productionId");
