-- CreateTable
CREATE TABLE "BuildPartMaterial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partId" INTEGER NOT NULL,
    "section" TEXT,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "stockItemId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BuildPartMaterial_partId_fkey" FOREIGN KEY ("partId") REFERENCES "BuildPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BuildPartMaterial_partId_idx" ON "BuildPartMaterial"("partId");

