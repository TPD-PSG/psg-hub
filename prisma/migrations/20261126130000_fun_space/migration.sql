-- Fun Corner stories posted from a company space (e.g. TWS) carry that company, for its badge.
-- Added in place (no table rebuild).
ALTER TABLE "FunSubmission" ADD COLUMN "entityId" INTEGER REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
