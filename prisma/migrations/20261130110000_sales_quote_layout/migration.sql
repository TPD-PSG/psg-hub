-- Sales-quote layout for company spaces: the boxes on the quote, and the company's letterhead
ALTER TABLE "Quote" ADD COLUMN "customerPo" TEXT;
ALTER TABLE "Quote" ADD COLUMN "paymentTerms" TEXT;
ALTER TABLE "Quote" ADD COLUMN "dueDate" DATETIME;
ALTER TABLE "Quote" ADD COLUMN "shippingMethod" TEXT;
ALTER TABLE "Quote" ADD COLUMN "shipTo" TEXT;
ALTER TABLE "Entity" ADD COLUMN "address" TEXT;
ALTER TABLE "Entity" ADD COLUMN "phone" TEXT;

-- The Workshop Stoke's letterhead, as on its current sales quotes (only if not already set)
UPDATE "Entity" SET "address" = 'Unit 2' || char(10) || 'Cockshute Industrial Estate' || char(10) || 'Stoke on Trent ST4 7AW' || char(10) || 'GB'
  WHERE "slug" = 'tws' AND "address" IS NULL;
UPDATE "Entity" SET "phone" = '020 7362 9000' WHERE "slug" = 'tws' AND "phone" IS NULL;
