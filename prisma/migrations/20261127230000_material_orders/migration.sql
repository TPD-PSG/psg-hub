-- Estimated part materials remember the purchase order they were ordered on
ALTER TABLE "BuildPartMaterial" ADD COLUMN "poId" INTEGER REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
