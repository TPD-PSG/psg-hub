-- CreateTable
CREATE TABLE "CallSheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "title" TEXT,
    "venue" TEXT,
    "generalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CallSheet_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CallSheetEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "callSheetId" INTEGER NOT NULL,
    "discipline" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "callTime" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CallSheetEntry_callSheetId_fkey" FOREIGN KEY ("callSheetId") REFERENCES "CallSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
