CREATE TABLE "InvoiceTodo" (
  "id"           INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "client"       TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "productionId" INTEGER REFERENCES "Production"("id") ON DELETE SET NULL,
  "amount"       REAL,
  "dueDate"      DATETIME,
  "notes"        TEXT,
  "done"         BOOLEAN NOT NULL DEFAULT 0,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
