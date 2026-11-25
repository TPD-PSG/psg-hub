-- Deals can have a tender deadline (reminders before it)
ALTER TABLE "Opportunity" ADD COLUMN "tenderDeadline" DATETIME;
