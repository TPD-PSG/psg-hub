-- AlterTable
ALTER TABLE "HSDocument" ADD COLUMN "reviewDate" DATETIME;

-- AlterTable
ALTER TABLE "Production" ADD COLUMN "hsReportToken" TEXT;

-- CreateTable
CREATE TABLE "Incident" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "location" TEXT,
    "venueName" TEXT,
    "description" TEXT NOT NULL,
    "immediateAction" TEXT,
    "injuredName" TEXT,
    "injuredRole" TEXT,
    "injuredEmployer" TEXT,
    "injuryDetails" TEXT,
    "bodyPart" TEXT,
    "treatment" TEXT,
    "offWork" BOOLEAN NOT NULL DEFAULT false,
    "witnesses" TEXT,
    "reporterName" TEXT NOT NULL,
    "reporterContact" TEXT,
    "reportedById" INTEGER,
    "viaQr" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "severity" TEXT,
    "investigation" TEXT,
    "rootCause" TEXT,
    "riddor" TEXT,
    "riddorDueDate" DATETIME,
    "riddorReportedAt" DATETIME,
    "riddorRef" TEXT,
    "closedAt" DATETIME,
    "closedById" INTEGER,
    "closeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Incident_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncidentAction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "incidentId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "ownerId" INTEGER,
    "dueDate" DATETIME,
    "doneAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IncidentAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Incident_productionId_occurredAt_idx" ON "Incident"("productionId", "occurredAt");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_year_number_key" ON "Incident"("year", "number");

-- CreateIndex
CREATE INDEX "IncidentAction_incidentId_idx" ON "IncidentAction"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentAction_ownerId_doneAt_idx" ON "IncidentAction"("ownerId", "doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "Production_hsReportToken_key" ON "Production"("hsReportToken");

