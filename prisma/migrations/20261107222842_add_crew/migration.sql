-- CreateTable
CREATE TABLE "Crew" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "isFreelance" BOOLEAN NOT NULL DEFAULT true,
    "insuranceProvider" TEXT,
    "insurancePolicyNo" TEXT,
    "insuranceExpiry" DATETIME,
    "insuranceCoverType" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductionCrew" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "crewId" INTEGER NOT NULL,
    "productionId" INTEGER NOT NULL,
    "role" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "dayRate" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionCrew_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionCrew_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
