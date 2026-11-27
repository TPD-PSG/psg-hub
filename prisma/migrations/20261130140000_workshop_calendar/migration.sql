-- CreateTable
CREATE TABLE "WorkshopDiscipline" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkshopDiscipline_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartStage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partId" INTEGER NOT NULL,
    "disciplineId" INTEGER NOT NULL,
    "startDate" DATETIME,
    "days" INTEGER NOT NULL DEFAULT 1,
    "hours" REAL,
    "userId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "fromQuote" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartStage_partId_fkey" FOREIGN KEY ("partId") REFERENCES "BuildPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartStage_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "WorkshopDiscipline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartStage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkshopDiscipline_entityId_idx" ON "WorkshopDiscipline"("entityId");

-- CreateIndex
CREATE INDEX "PartStage_partId_idx" ON "PartStage"("partId");

-- CreateIndex
CREATE INDEX "PartStage_disciplineId_startDate_idx" ON "PartStage"("disciplineId", "startDate");

