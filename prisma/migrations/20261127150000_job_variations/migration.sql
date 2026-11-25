-- CreateTable
CREATE TABLE "JobVariation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "vatRate" REAL NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" DATETIME,
    "decidedAt" DATETIME,
    "decidedByName" TEXT,
    "decidedOnBehalf" BOOLEAN NOT NULL DEFAULT false,
    "decisionComment" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobVariation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VariationLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "variationId" INTEGER NOT NULL,
    "section" TEXT,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "VariationLine_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "JobVariation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "JobVariation_jobId_number_key" ON "JobVariation"("jobId", "number");

-- CreateIndex
CREATE INDEX "VariationLine_variationId_idx" ON "VariationLine"("variationId");

