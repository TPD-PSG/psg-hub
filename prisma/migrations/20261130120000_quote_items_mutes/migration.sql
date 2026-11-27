-- Workshop quoting: line type and mutes, and leaving a whole item out
ALTER TABLE "QuoteLine" ADD COLUMN "kind" TEXT;
ALTER TABLE "QuoteLine" ADD COLUMN "hideLine" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QuoteLine" ADD COLUMN "hidePrice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QuoteLine" ADD COLUMN "leaveOut" BOOLEAN NOT NULL DEFAULT false;
