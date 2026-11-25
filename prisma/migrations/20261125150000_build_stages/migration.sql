-- Build stages, due-out details and file links for jobs (columns added in place, no rebuild)
CREATE TABLE "JobLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'vectorworks',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobLink_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JobLink_jobId_idx" ON "JobLink"("jobId");

ALTER TABLE "Job" ADD COLUMN "stage" TEXT;
ALTER TABLE "Job" ADD COLUMN "stageChangedAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "deliveryMethod" TEXT;
ALTER TABLE "Job" ADD COLUMN "deliveryNotes" TEXT;
ALTER TABLE "Job" ADD COLUMN "forProductionId" INTEGER REFERENCES "Production" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
