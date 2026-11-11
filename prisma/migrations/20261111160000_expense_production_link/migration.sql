-- Add productionId and submittedByUserId to ProductionExpense
ALTER TABLE "ProductionExpense" ADD COLUMN "productionId" INTEGER REFERENCES "Production"("id") ON DELETE SET NULL;
ALTER TABLE "ProductionExpense" ADD COLUMN "submittedByUserId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL;
