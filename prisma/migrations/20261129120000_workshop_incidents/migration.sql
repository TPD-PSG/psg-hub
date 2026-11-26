-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Incident" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER,
    "entityId" INTEGER,
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
    CONSTRAINT "Incident_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Incident" ("bodyPart", "closeNote", "closedAt", "closedById", "createdAt", "description", "id", "immediateAction", "injuredEmployer", "injuredName", "injuredRole", "injuryDetails", "investigation", "kind", "location", "number", "occurredAt", "offWork", "productionId", "reportedById", "reporterContact", "reporterName", "riddor", "riddorDueDate", "riddorRef", "riddorReportedAt", "rootCause", "severity", "status", "treatment", "updatedAt", "venueName", "viaQr", "witnesses", "year") SELECT "bodyPart", "closeNote", "closedAt", "closedById", "createdAt", "description", "id", "immediateAction", "injuredEmployer", "injuredName", "injuredRole", "injuryDetails", "investigation", "kind", "location", "number", "occurredAt", "offWork", "productionId", "reportedById", "reporterContact", "reporterName", "riddor", "riddorDueDate", "riddorRef", "riddorReportedAt", "rootCause", "severity", "status", "treatment", "updatedAt", "venueName", "viaQr", "witnesses", "year" FROM "Incident";
DROP TABLE "Incident";
ALTER TABLE "new_Incident" RENAME TO "Incident";
CREATE INDEX "Incident_productionId_occurredAt_idx" ON "Incident"("productionId", "occurredAt");
CREATE INDEX "Incident_entityId_occurredAt_idx" ON "Incident"("entityId", "occurredAt");
CREATE INDEX "Incident_status_idx" ON "Incident"("status");
CREATE UNIQUE INDEX "Incident_year_number_key" ON "Incident"("year", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

