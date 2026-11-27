-- CreateTable
CREATE TABLE "RentalProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "dayRate" REAL,
    "weekRate" REAL,
    "replacementCost" REAL,
    "weightKg" REAL,
    "powerW" REAL,
    "isCase" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalProduct_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalUnit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "serial" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "containerId" INTEGER,
    "location" TEXT,
    "purchasedAt" DATETIME,
    "purchaseCost" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RentalProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalUnit_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "RentalUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalPackage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalPackage_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalPackageItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "packageId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RentalPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RentalPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalPackageItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RentalProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalHire" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "clientEmail" TEXT,
    "productionId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'quote',
    "outDate" DATETIME NOT NULL,
    "returnDate" DATETIME NOT NULL,
    "notes" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalHire_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalHire_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RentalHire_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalHireLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hireId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "dayRate" REAL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RentalHireLine_hireId_fkey" FOREIGN KEY ("hireId") REFERENCES "RentalHire" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalHireLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RentalProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN "spaceKind" TEXT NOT NULL DEFAULT 'workshop';

-- CreateIndex
CREATE INDEX "RentalProduct_entityId_idx" ON "RentalProduct"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalUnit_barcode_key" ON "RentalUnit"("barcode");

-- CreateIndex
CREATE INDEX "RentalUnit_productId_idx" ON "RentalUnit"("productId");

-- CreateIndex
CREATE INDEX "RentalUnit_containerId_idx" ON "RentalUnit"("containerId");

-- CreateIndex
CREATE INDEX "RentalPackage_entityId_idx" ON "RentalPackage"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalPackageItem_packageId_productId_key" ON "RentalPackageItem"("packageId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalHire_number_key" ON "RentalHire"("number");

-- CreateIndex
CREATE INDEX "RentalHire_entityId_outDate_idx" ON "RentalHire"("entityId", "outDate");

-- CreateIndex
CREATE INDEX "RentalHire_productionId_idx" ON "RentalHire"("productionId");

-- CreateIndex
CREATE INDEX "RentalHireLine_hireId_idx" ON "RentalHireLine"("hireId");

-- CreateIndex
CREATE INDEX "RentalHireLine_productId_idx" ON "RentalHireLine"("productId");

