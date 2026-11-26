-- CreateTable
CREATE TABLE "ComplianceItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "reference" TEXT,
    "cover" TEXT,
    "validFrom" DATETIME,
    "expiresAt" DATETIME,
    "reviewAt" DATETIME,
    "version" TEXT,
    "ownerId" INTEGER,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ComplianceItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ComplianceItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "fileKey" TEXT,
    "data" TEXT NOT NULL DEFAULT '',
    "validFrom" DATETIME,
    "expiresAt" DATETIME,
    "version" TEXT,
    "uploadedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceDocument_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ComplianceItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComplianceDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ComplianceItem_entityId_idx" ON "ComplianceItem"("entityId");

-- CreateIndex
CREATE INDEX "ComplianceItem_expiresAt_idx" ON "ComplianceItem"("expiresAt");

-- CreateIndex
CREATE INDEX "ComplianceDocument_itemId_createdAt_idx" ON "ComplianceDocument"("itemId", "createdAt");

