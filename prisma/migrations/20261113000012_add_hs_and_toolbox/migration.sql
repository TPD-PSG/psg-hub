CREATE TABLE "HSDocument" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "productionId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "tourStopId" INTEGER,
  "folder" TEXT NOT NULL DEFAULT 'General',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HSDocument_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ToolboxTalkSignature" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "productionId" INTEGER NOT NULL,
  "tourStopId" INTEGER,
  "venueName" TEXT,
  "signeeName" TEXT NOT NULL,
  "signeeDate" TEXT NOT NULL,
  "employer" TEXT,
  "position" TEXT,
  "signature" TEXT NOT NULL,
  "agreedBriefing" BOOLEAN NOT NULL DEFAULT 0,
  "agreedSafety" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolboxTalkSignature_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
