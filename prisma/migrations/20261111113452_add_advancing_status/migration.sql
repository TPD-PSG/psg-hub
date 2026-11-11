-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TourStop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "venueId" INTEGER NOT NULL,
    "stopNumber" INTEGER NOT NULL DEFAULT 0,
    "advancingStatus" TEXT NOT NULL DEFAULT 'triage',
    "loadInDate" DATETIME,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "performanceStart" DATETIME,
    "performanceEnd" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TourStop_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TourStop_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TourStop" ("createdAt", "endDate", "id", "loadInDate", "notes", "performanceEnd", "performanceStart", "productionId", "startDate", "stopNumber", "updatedAt", "venueId") SELECT "createdAt", "endDate", "id", "loadInDate", "notes", "performanceEnd", "performanceStart", "productionId", "startDate", "stopNumber", "updatedAt", "venueId" FROM "TourStop";
DROP TABLE "TourStop";
ALTER TABLE "new_TourStop" RENAME TO "TourStop";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
