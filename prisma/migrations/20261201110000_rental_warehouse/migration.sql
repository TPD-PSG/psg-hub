-- CreateTable
CREATE TABLE "RentalHireUnit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hireId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "outAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outById" INTEGER,
    "backAt" DATETIME,
    "backById" INTEGER,
    "condition" TEXT,
    "note" TEXT,
    CONSTRAINT "RentalHireUnit_hireId_fkey" FOREIGN KEY ("hireId") REFERENCES "RentalHire" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalHireUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RentalUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RentalHireUnit_outById_fkey" FOREIGN KEY ("outById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RentalHireUnit_backById_fkey" FOREIGN KEY ("backById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalSubHire" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hireId" INTEGER NOT NULL,
    "productId" INTEGER,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "supplierId" INTEGER,
    "supplierName" TEXT,
    "cost" REAL,
    "status" TEXT NOT NULL DEFAULT 'needed',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalSubHire_hireId_fkey" FOREIGN KEY ("hireId") REFERENCES "RentalHire" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalSubHire_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RentalProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RentalSubHire_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RentalHireUnit_unitId_backAt_idx" ON "RentalHireUnit"("unitId", "backAt");

-- CreateIndex
CREATE UNIQUE INDEX "RentalHireUnit_hireId_unitId_key" ON "RentalHireUnit"("hireId", "unitId");

-- CreateIndex
CREATE INDEX "RentalSubHire_hireId_idx" ON "RentalSubHire"("hireId");

