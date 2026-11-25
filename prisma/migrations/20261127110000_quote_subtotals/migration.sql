-- Quotes can show a subtotal after each section on the PDF
ALTER TABLE "Quote" ADD COLUMN "showSubtotals" BOOLEAN NOT NULL DEFAULT false;
