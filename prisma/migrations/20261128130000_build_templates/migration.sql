-- CreateTable
CREATE TABLE "BuildTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unitName" TEXT NOT NULL DEFAULT 'each',
    "notes" TEXT,
    "parts" TEXT NOT NULL,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuildTemplate_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BuildTemplate_entityId_name_key" ON "BuildTemplate"("entityId", "name");

