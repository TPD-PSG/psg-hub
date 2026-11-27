-- AlterTable
ALTER TABLE "PartStage" ADD COLUMN "lateUntil" DATETIME;

-- CreateTable
CREATE TABLE "StageRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stageId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "newStart" DATETIME,
    "newDays" INTEGER,
    "newEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'open',
    "byId" INTEGER,
    "decidedById" INTEGER,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageRequest_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PartStage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StageRequest_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StageRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "workshopManager" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "StageRequest_stageId_idx" ON "StageRequest"("stageId");
CREATE INDEX "StageRequest_status_idx" ON "StageRequest"("status");
