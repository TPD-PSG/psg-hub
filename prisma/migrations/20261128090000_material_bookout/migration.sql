-- Estimated materials can be fulfilled by booking stock out to the build (instead of a PO)
ALTER TABLE "BuildPartMaterial" ADD COLUMN "stockMoveId" INTEGER REFERENCES "StockMove" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "BuildPartMaterial_stockMoveId_key" ON "BuildPartMaterial"("stockMoveId");
