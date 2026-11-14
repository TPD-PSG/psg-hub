ALTER TABLE "Production" ADD COLUMN "advancingStatus" TEXT NOT NULL DEFAULT 'triage';
ALTER TABLE "Production" ADD COLUMN "contraEstimate" REAL;
ALTER TABLE "Production" ADD COLUMN "contraActual" REAL;
