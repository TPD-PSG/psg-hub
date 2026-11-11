CREATE TABLE "MarketingPost" (
  "id"              INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title"           TEXT NOT NULL,
  "caption"         TEXT,
  "platforms"       TEXT NOT NULL DEFAULT '[]',
  "status"          TEXT NOT NULL DEFAULT 'draft',
  "scheduledAt"     DATETIME,
  "publishedAt"     DATETIME,
  "productionId"    INTEGER REFERENCES "Production"("id") ON DELETE SET NULL,
  "imageUrl"        TEXT,
  "link"            TEXT,
  "tags"            TEXT,
  "notes"           TEXT,
  "createdByUserId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
