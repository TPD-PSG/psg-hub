-- Call sheets can be emailed (27 Nov 2026): when each was sent and last changed, a log of sends,
-- and rows linked to the crew member or PSG user they're for. Added in place: no table rebuild.
ALTER TABLE "CallSheet" ADD COLUMN "changedAt" DATETIME;
ALTER TABLE "CallSheet" ADD COLUMN "sentAt" DATETIME;

ALTER TABLE "CallSheetEntry" ADD COLUMN "crewId" INTEGER REFERENCES "Crew" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallSheetEntry" ADD COLUMN "userId" INTEGER REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallSheetEntry" ADD COLUMN "email" TEXT;
CREATE INDEX "CallSheetEntry_callSheetId_idx" ON "CallSheetEntry"("callSheetId");

CREATE TABLE "CallSheetSend" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "callSheetId" INTEGER NOT NULL,
    "sentById" INTEGER,
    "isUpdate" BOOLEAN NOT NULL DEFAULT false,
    "recipients" TEXT NOT NULL,
    "failed" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallSheetSend_callSheetId_fkey" FOREIGN KEY ("callSheetId") REFERENCES "CallSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CallSheetSend_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "CallSheetSend_callSheetId_sentAt_idx" ON "CallSheetSend"("callSheetId", "sentAt");
