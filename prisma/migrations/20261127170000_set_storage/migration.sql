-- CreateTable
CREATE TABLE "StorageLocation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageLocation_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoredPiece" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "jobId" INTEGER,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "locationId" INTEGER,
    "notes" TEXT,
    "storedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outAt" DATETIME,
    "outNote" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoredPiece_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoredPiece_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StoredPiece_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StorageLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoredPieceMove" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pieceId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "location" TEXT,
    "note" TEXT,
    "byName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredPieceMove_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "StoredPiece" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_entityId_name_key" ON "StorageLocation"("entityId", "name");

-- CreateIndex
CREATE INDEX "StoredPiece_entityId_outAt_idx" ON "StoredPiece"("entityId", "outAt");

-- CreateIndex
CREATE INDEX "StoredPiece_jobId_idx" ON "StoredPiece"("jobId");

-- CreateIndex
CREATE INDEX "StoredPieceMove_pieceId_idx" ON "StoredPieceMove"("pieceId");

