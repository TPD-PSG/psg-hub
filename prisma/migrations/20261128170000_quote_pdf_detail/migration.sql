-- A quote PDF can show one price per item (section) instead of every line
ALTER TABLE "Quote" ADD COLUMN "pdfDetail" TEXT NOT NULL DEFAULT 'lines';
