-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Production" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "venue" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "announcementStatus" TEXT NOT NULL DEFAULT 'not_announced',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Production" ("createdAt", "endDate", "id", "name", "notes", "startDate", "status", "type", "updatedAt", "venue") SELECT "createdAt", "endDate", "id", "name", "notes", "startDate", "status", "type", "updatedAt", "venue" FROM "Production";
DROP TABLE "Production";
ALTER TABLE "new_Production" RENAME TO "Production";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
