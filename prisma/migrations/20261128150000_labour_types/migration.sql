-- CreateTable
CREATE TABLE "LabourType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "dayRate" REAL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabourType_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LabourType_entityId_name_key" ON "LabourType"("entityId", "name");

-- Parts can be a labour type (added in place)
ALTER TABLE "BuildPart" ADD COLUMN "labourTypeId" INTEGER REFERENCES "LabourType" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
