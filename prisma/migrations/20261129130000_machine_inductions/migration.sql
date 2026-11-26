-- CreateTable
CREATE TABLE "Machine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "refresherMonths" INTEGER NOT NULL DEFAULT 12,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Machine_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MachineTrainer" (
    "machineId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    PRIMARY KEY ("machineId", "userId"),
    CONSTRAINT "MachineTrainer_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MachineTrainer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MachineInduction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "machineId" INTEGER NOT NULL,
    "userId" INTEGER,
    "personName" TEXT NOT NULL,
    "personCompany" TEXT,
    "trainerId" INTEGER,
    "trainerName" TEXT NOT NULL,
    "inductedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "notes" TEXT,
    "traineeSignature" TEXT NOT NULL,
    "trainerSignature" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "revokeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MachineInduction_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MachineInduction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MachineInduction_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuildPartMachine" (
    "partId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,

    PRIMARY KEY ("partId", "machineId"),
    CONSTRAINT "BuildPartMachine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "BuildPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuildPartMachine_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Machine_entityId_idx" ON "Machine"("entityId");

-- CreateIndex
CREATE INDEX "MachineInduction_machineId_userId_idx" ON "MachineInduction"("machineId", "userId");

-- CreateIndex
CREATE INDEX "MachineInduction_expiresAt_idx" ON "MachineInduction"("expiresAt");

