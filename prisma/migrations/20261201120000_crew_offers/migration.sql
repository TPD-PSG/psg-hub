-- CreateTable
CREATE TABLE "CrewJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hireId" INTEGER,
    "productionId" INTEGER,
    "role" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "callTime" TEXT,
    "endTime" TEXT,
    "places" INTEGER NOT NULL DEFAULT 1,
    "payRate" REAL,
    "payUnit" TEXT NOT NULL DEFAULT 'day',
    "hours" REAL,
    "chargeRate" REAL,
    "location" TEXT,
    "notes" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewJob_hireId_fkey" FOREIGN KEY ("hireId") REFERENCES "RentalHire" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewJob_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewOffer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "crewId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',
    "reply" TEXT,
    "emailedTo" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    "bookedAt" DATETIME,
    "bookedById" INTEGER,
    "productionCrewId" INTEGER,
    CONSTRAINT "CrewOffer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CrewJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewOffer_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewOffer_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CrewOffer_productionCrewId_fkey" FOREIGN KEY ("productionCrewId") REFERENCES "ProductionCrew" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "RentalHireCharge" ADD COLUMN "crewJobId" INTEGER REFERENCES "CrewJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "RentalHireCharge_crewJobId_key" ON "RentalHireCharge"("crewJobId");

-- CreateIndex
CREATE INDEX "CrewJob_hireId_idx" ON "CrewJob"("hireId");

-- CreateIndex
CREATE INDEX "CrewJob_productionId_idx" ON "CrewJob"("productionId");

-- CreateIndex
CREATE INDEX "CrewJob_date_idx" ON "CrewJob"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CrewOffer_token_key" ON "CrewOffer"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CrewOffer_productionCrewId_key" ON "CrewOffer"("productionCrewId");

-- CreateIndex
CREATE INDEX "CrewOffer_crewId_idx" ON "CrewOffer"("crewId");

-- CreateIndex
CREATE UNIQUE INDEX "CrewOffer_jobId_crewId_key" ON "CrewOffer"("jobId", "crewId");

