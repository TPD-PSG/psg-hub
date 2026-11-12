CREATE TABLE "ProductionContact" (
  "id"           INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "productionId" INTEGER NOT NULL,
  "name"         TEXT NOT NULL,
  "company"      TEXT,
  "role"         TEXT,
  "phone"        TEXT,
  "email"        TEXT,
  "notes"        TEXT,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionContact_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
