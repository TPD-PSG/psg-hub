-- CreateTable
CREATE TABLE "Entity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RevenueTarget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    CONSTRAINT "RevenueTarget_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BDActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opportunityId" INTEGER NOT NULL,
    "userId" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "text" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BDActivity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BDActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeStage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME,
    "invoicedAt" DATETIME,
    "paidAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FeeStage_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- New columns on existing tables are added in place (no table rebuild), all nullable or defaulted.
-- Opportunity
ALTER TABLE "Opportunity" ADD COLUMN "entityId" INTEGER REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD COLUMN "ownerUserId" INTEGER REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD COLUMN "probability" INTEGER;
ALTER TABLE "Opportunity" ADD COLUMN "followUpDate" DATETIME;
ALTER TABLE "Opportunity" ADD COLUMN "leadSource" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "competitor" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "stageChangedAt" DATETIME;
ALTER TABLE "Opportunity" ADD COLUMN "productionId" INTEGER REFERENCES "Production" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Opportunity_productionId_key" ON "Opportunity"("productionId");
CREATE INDEX "Opportunity_entityId_idx" ON "Opportunity"("entityId");
CREATE INDEX "Opportunity_ownerUserId_idx" ON "Opportunity"("ownerUserId");

-- Client: target accounts
ALTER TABLE "Client" ADD COLUMN "targetAccount" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN "targetOwnerId" INTEGER REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD COLUMN "targetSource" TEXT;

-- Production: entity and PM fee
ALTER TABLE "Production" ADD COLUMN "entityId" INTEGER REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Production" ADD COLUMN "pmFee" REAL;

-- CreateIndex
CREATE UNIQUE INDEX "Entity_name_key" ON "Entity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueTarget_entityId_year_key" ON "RevenueTarget"("entityId", "year");

-- CreateIndex
CREATE INDEX "BDActivity_opportunityId_at_idx" ON "BDActivity"("opportunityId", "at");

-- CreateIndex
CREATE INDEX "FeeStage_productionId_idx" ON "FeeStage"("productionId");

