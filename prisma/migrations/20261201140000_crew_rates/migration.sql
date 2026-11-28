-- CreateTable
CREATE TABLE "CrewRate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'day',
    "hours" REAL,
    "payRate" REAL,
    "chargeRate" REAL,
    "notes" TEXT,
    "onRateCard" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewRate_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CrewRate_entityId_role_key" ON "CrewRate"("entityId", "role");
