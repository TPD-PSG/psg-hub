-- CreateTable
CREATE TABLE "EquipmentCheck" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "machineId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "intervalMonths" INTEGER NOT NULL DEFAULT 12,
    "firstDue" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentCheck_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentCheckRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "checkId" INTEGER NOT NULL,
    "doneAt" DATETIME NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "doneBy" TEXT NOT NULL,
    "notes" TEXT,
    "nextDue" DATETIME,
    "fileName" TEXT,
    "fileMime" TEXT,
    "fileKey" TEXT,
    "fileData" TEXT,
    "recordedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentCheckRecord_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "EquipmentCheck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable (in place: the new columns all have defaults or allow null)
ALTER TABLE "Machine" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'machine';
ALTER TABLE "Machine" ADD COLUMN "needsInduction" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Machine" ADD COLUMN "assetTag" TEXT;
ALTER TABLE "Machine" ADD COLUMN "outOfUseAt" DATETIME;
ALTER TABLE "Machine" ADD COLUMN "outOfUseNote" TEXT;

-- CreateIndex
CREATE INDEX "EquipmentCheck_machineId_idx" ON "EquipmentCheck"("machineId");

-- CreateIndex
CREATE INDEX "EquipmentCheckRecord_checkId_doneAt_idx" ON "EquipmentCheckRecord"("checkId", "doneAt");
