-- CreateTable
CREATE TABLE "BuildPart" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "userId" INTEGER,
    "startDate" DATETIME,
    "days" INTEGER NOT NULL DEFAULT 1,
    "hours" REAL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuildPart_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuildPart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BuildPart_jobId_idx" ON "BuildPart"("jobId");

-- CreateIndex
CREATE INDEX "BuildPart_userId_startDate_idx" ON "BuildPart"("userId", "startDate");

