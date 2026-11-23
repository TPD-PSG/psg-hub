-- AlterTable
ALTER TABLE "Client" ADD COLUMN "billingAddress" TEXT;
ALTER TABLE "Client" ADD COLUMN "billingEmail" TEXT;
ALTER TABLE "Client" ADD COLUMN "billingName" TEXT;

-- CreateTable
CREATE TABLE "BudgetVariation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "justification" TEXT,
    "clientRef" TEXT,
    "requestedById" INTEGER,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" INTEGER,
    "approvedAt" DATETIME,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetVariation_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetVariation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetVariation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetVariationItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "variationId" INTEGER NOT NULL,
    "budgetLineId" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    CONSTRAINT "BudgetVariationItem_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "BudgetVariation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetVariationItem_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionExpenseDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "expenseId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionExpenseDocument_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "ProductionExpense" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" DATETIME NOT NULL,
    "location" TEXT,
    "attendees" TEXT,
    "agenda" TEXT,
    "minutes" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "color" TEXT,
    "createdByUserId" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionNote_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserInvite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "permissions" TEXT,
    "productionIds" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "budgetLineId" INTEGER NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'pre-production',
    "description" TEXT NOT NULL,
    "estimated" REAL NOT NULL DEFAULT 0,
    "committed" REAL NOT NULL DEFAULT 0,
    "spent" REAL NOT NULL DEFAULT 0,
    "poNumber" TEXT,
    "paymentDue" DATETIME,
    "issuedForPayment" BOOLEAN NOT NULL DEFAULT false,
    "vatExempt" BOOLEAN NOT NULL DEFAULT false,
    "supplier" TEXT,
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedDate" DATETIME,
    "approvalMethod" TEXT,
    "isPSGExpense" BOOLEAN NOT NULL DEFAULT false,
    "invoicedToClient" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("approvalMethod", "approvedBy", "approvedDate", "budgetLineId", "committed", "createdAt", "description", "estimated", "id", "isPSGExpense", "issuedForPayment", "notes", "paymentDue", "paymentMethod", "phase", "poNumber", "spent", "supplier", "updatedAt", "vatExempt") SELECT "approvalMethod", "approvedBy", "approvedDate", "budgetLineId", "committed", "createdAt", "description", "estimated", "id", "isPSGExpense", "issuedForPayment", "notes", "paymentDue", "paymentMethod", "phase", "poNumber", "spent", "supplier", "updatedAt", "vatExempt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE TABLE "new_FunMedia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "submissionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" TEXT,
    "filePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FunMedia_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FunSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FunMedia" ("createdAt", "data", "id", "mime", "name", "submissionId") SELECT "createdAt", "data", "id", "mime", "name", "submissionId" FROM "FunMedia";
DROP TABLE "FunMedia";
ALTER TABLE "new_FunMedia" RENAME TO "FunMedia";
CREATE TABLE "new_HaulageMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "haulageCompany" TEXT NOT NULL,
    "driverName" TEXT,
    "vehicleInfo" TEXT,
    "fromLocation" TEXT NOT NULL,
    "toLocation" TEXT NOT NULL,
    "departureAt" DATETIME NOT NULL,
    "arrivalAt" DATETIME,
    "cargo" TEXT,
    "notes" TEXT,
    "estimatedCost" REAL,
    "actualCost" REAL,
    "rechargeable" BOOLEAN NOT NULL DEFAULT false,
    "invoicedToClient" BOOLEAN NOT NULL DEFAULT false,
    "budgetLineId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HaulageMovement_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HaulageMovement_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HaulageMovement" ("actualCost", "arrivalAt", "budgetLineId", "cargo", "createdAt", "departureAt", "driverName", "estimatedCost", "fromLocation", "haulageCompany", "id", "notes", "productionId", "rechargeable", "toLocation", "updatedAt", "vehicleInfo") SELECT "actualCost", "arrivalAt", "budgetLineId", "cargo", "createdAt", "departureAt", "driverName", "estimatedCost", "fromLocation", "haulageCompany", "id", "notes", "productionId", "rechargeable", "toLocation", "updatedAt", "vehicleInfo" FROM "HaulageMovement";
DROP TABLE "HaulageMovement";
ALTER TABLE "new_HaulageMovement" RENAME TO "HaulageMovement";
CREATE TABLE "new_HelpTicket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'bug',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdByUserId" INTEGER,
    "assignedToUserId" INTEGER,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HelpTicket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HelpTicket_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HelpTicket" ("assignedToUserId", "category", "createdAt", "createdByUserId", "description", "id", "priority", "resolvedAt", "status", "title", "updatedAt") SELECT "assignedToUserId", "category", "createdAt", "createdByUserId", "description", "id", "priority", "resolvedAt", "status", "title", "updatedAt" FROM "HelpTicket";
DROP TABLE "HelpTicket";
ALTER TABLE "new_HelpTicket" RENAME TO "HelpTicket";
CREATE TABLE "new_InvoiceTodo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "client" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "productionId" INTEGER,
    "amount" REAL,
    "dueDate" DATETIME,
    "notes" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceTodo_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceTodo" ("amount", "client", "createdAt", "description", "done", "dueDate", "id", "notes", "productionId", "updatedAt") SELECT "amount", "client", "createdAt", "description", "done", "dueDate", "id", "notes", "productionId", "updatedAt" FROM "InvoiceTodo";
DROP TABLE "InvoiceTodo";
ALTER TABLE "new_InvoiceTodo" RENAME TO "InvoiceTodo";
CREATE TABLE "new_MarketingPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "platforms" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" DATETIME,
    "publishedAt" DATETIME,
    "productionId" INTEGER,
    "imageUrl" TEXT,
    "link" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingPost_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MarketingPost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MarketingPost" ("caption", "createdAt", "createdByUserId", "id", "imageUrl", "link", "notes", "platforms", "productionId", "publishedAt", "scheduledAt", "status", "tags", "title", "updatedAt") SELECT "caption", "createdAt", "createdByUserId", "id", "imageUrl", "link", "notes", "platforms", "productionId", "publishedAt", "scheduledAt", "status", "tags", "title", "updatedAt" FROM "MarketingPost";
DROP TABLE "MarketingPost";
ALTER TABLE "new_MarketingPost" RENAME TO "MarketingPost";
CREATE TABLE "new_Production" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "type" TEXT NOT NULL,
    "venue" TEXT,
    "venueId" INTEGER,
    "isTour" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "announcementStatus" TEXT NOT NULL DEFAULT 'not_announced',
    "internalStatus" TEXT NOT NULL DEFAULT 'pencil',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "productionManager" TEXT,
    "color" TEXT,
    "notes" TEXT,
    "reportEmail" TEXT,
    "sharepointUrl" TEXT,
    "haulageBudgetLineId" INTEGER,
    "advancingStatus" TEXT NOT NULL DEFAULT 'triage',
    "contraEstimate" REAL,
    "contraActual" REAL,
    "bdClientId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Production_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Production_bdClientId_fkey" FOREIGN KEY ("bdClientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Production" ("advancingStatus", "announcementStatus", "archived", "archivedAt", "color", "contraActual", "contraEstimate", "createdAt", "endDate", "haulageBudgetLineId", "id", "internalStatus", "isTour", "logoUrl", "name", "notes", "productionManager", "reportEmail", "sharepointUrl", "startDate", "status", "type", "updatedAt", "venue", "venueId") SELECT "advancingStatus", "announcementStatus", "archived", "archivedAt", "color", "contraActual", "contraEstimate", "createdAt", "endDate", "haulageBudgetLineId", "id", "internalStatus", "isTour", "logoUrl", "name", "notes", "productionManager", "reportEmail", "sharepointUrl", "startDate", "status", "type", "updatedAt", "venue", "venueId" FROM "Production";
DROP TABLE "Production";
ALTER TABLE "new_Production" RENAME TO "Production";
CREATE TABLE "new_ProductionContact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'General',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionContact_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductionContact" ("company", "createdAt", "email", "id", "name", "notes", "phone", "productionId", "role", "section", "sortOrder", "updatedAt") SELECT "company", "createdAt", "email", "id", "name", "notes", "phone", "productionId", "role", "section", "sortOrder", "updatedAt" FROM "ProductionContact";
DROP TABLE "ProductionContact";
ALTER TABLE "new_ProductionContact" RENAME TO "ProductionContact";
CREATE INDEX "ProductionContact_productionId_idx" ON "ProductionContact"("productionId");
CREATE TABLE "new_ProductionDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'General',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionDocument_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductionDocument" ("createdAt", "data", "folder", "id", "mime", "name", "productionId", "updatedAt") SELECT "createdAt", "data", "folder", "id", "mime", "name", "productionId", "updatedAt" FROM "ProductionDocument";
DROP TABLE "ProductionDocument";
ALTER TABLE "new_ProductionDocument" RENAME TO "ProductionDocument";
CREATE TABLE "new_ProductionExpense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "production" TEXT,
    "productionId" INTEGER,
    "submittedByUserId" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'misc',
    "description" TEXT NOT NULL,
    "supplier" TEXT,
    "netAmount" REAL NOT NULL DEFAULT 0,
    "vatAmount" REAL NOT NULL DEFAULT 0,
    "date" DATETIME,
    "paymentMethod" TEXT DEFAULT 'to_pay',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "notes" TEXT,
    "invoicedToClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionExpense_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionExpense_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionExpense" ("category", "createdAt", "date", "description", "id", "netAmount", "notes", "paymentMethod", "production", "productionId", "reference", "status", "submittedByUserId", "supplier", "updatedAt", "vatAmount") SELECT "category", "createdAt", "date", "description", "id", "netAmount", "notes", "paymentMethod", "production", "productionId", "reference", "status", "submittedByUserId", "supplier", "updatedAt", "vatAmount" FROM "ProductionExpense";
DROP TABLE "ProductionExpense";
ALTER TABLE "new_ProductionExpense" RENAME TO "ProductionExpense";
CREATE TABLE "new_ProductionLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionLink_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductionLink" ("createdAt", "description", "id", "productionId", "title", "updatedAt", "url") SELECT "createdAt", "description", "id", "productionId", "title", "updatedAt", "url" FROM "ProductionLink";
DROP TABLE "ProductionLink";
ALTER TABLE "new_ProductionLink" RENAME TO "ProductionLink";
CREATE TABLE "new_ShowReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionId" INTEGER NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "venue" TEXT,
    "performance" TEXT,
    "performanceNumber" INTEGER,
    "attendance" INTEGER,
    "houseCapacity" INTEGER,
    "runningTime" TEXT,
    "playingTime" TEXT,
    "notes" TEXT,
    "flags" TEXT,
    "emailSubject" TEXT,
    "emailFrom" TEXT,
    "productionMatched" BOOLEAN NOT NULL DEFAULT true,
    "rawPdf" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShowReport_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShowReport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShowReport" ("attendance", "createdAt", "createdByUserId", "flags", "id", "notes", "performance", "productionId", "reportDate", "updatedAt", "venue") SELECT "attendance", "createdAt", "createdByUserId", "flags", "id", "notes", "performance", "productionId", "reportDate", "updatedAt", "venue" FROM "ShowReport";
DROP TABLE "ShowReport";
ALTER TABLE "new_ShowReport" RENAME TO "ShowReport";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Meeting_productionId_idx" ON "Meeting"("productionId");

-- CreateIndex
CREATE INDEX "ProductionNote_productionId_idx" ON "ProductionNote"("productionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvite_token_key" ON "UserInvite"("token");

