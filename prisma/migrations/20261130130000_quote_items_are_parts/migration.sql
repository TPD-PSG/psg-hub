-- A quote's items are the build's parts
ALTER TABLE "BuildPart" ADD COLUMN "quoteId" INTEGER REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuildPart" ADD COLUMN "quoteItem" TEXT;
CREATE INDEX "BuildPart_quoteId_idx" ON "BuildPart"("quoteId");
ALTER TABLE "BuildPartMaterial" ADD COLUMN "fromQuote" BOOLEAN NOT NULL DEFAULT false;
