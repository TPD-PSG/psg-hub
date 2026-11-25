-- AlterTable
ALTER TABLE "StoredPiece" ADD COLUMN "heightMm" INTEGER;
ALTER TABLE "StoredPiece" ADD COLUMN "lengthMm" INTEGER;
ALTER TABLE "StoredPiece" ADD COLUMN "weightKg" REAL;
ALTER TABLE "StoredPiece" ADD COLUMN "widthMm" INTEGER;

-- CreateTable
CREATE TABLE "FrCertificate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "standard" TEXT,
    "supplier" TEXT,
    "issuedAt" DATETIME,
    "expiresAt" DATETIME,
    "fileId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FrCertificate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FrCertificate_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "JobFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Repair" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "pieceId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "whereAt" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'soon',
    "status" TEXT NOT NULL DEFAULT 'open',
    "scheduledFor" DATETIME,
    "resolution" TEXT,
    "reportedByName" TEXT,
    "reportedById" INTEGER,
    "fromClient" BOOLEAN NOT NULL DEFAULT false,
    "photoFileId" INTEGER,
    "doneAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Repair_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Repair_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "StoredPiece" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Repair_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "JobFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClockEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "startAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" DATETIME,
    "timeEntryId" INTEGER,
    "byName" TEXT,
    CONSTRAINT "ClockEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClockEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FrCertificate_fileId_key" ON "FrCertificate"("fileId");

-- CreateIndex
CREATE INDEX "FrCertificate_jobId_idx" ON "FrCertificate"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Repair_photoFileId_key" ON "Repair"("photoFileId");

-- CreateIndex
CREATE INDEX "Repair_jobId_status_idx" ON "Repair"("jobId", "status");

-- CreateIndex
CREATE INDEX "ClockEntry_userId_endAt_idx" ON "ClockEntry"("userId", "endAt");

-- CreateIndex
CREATE INDEX "ClockEntry_jobId_idx" ON "ClockEntry"("jobId");

