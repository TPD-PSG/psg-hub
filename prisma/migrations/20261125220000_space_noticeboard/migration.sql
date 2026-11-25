-- CreateTable
CREATE TABLE "SpacePost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'notice',
    "title" TEXT,
    "body" TEXT,
    "jobId" INTEGER,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpacePost_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpacePost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SpacePost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpacePhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "jobId" INTEGER,
    "postId" INTEGER,
    "uploadedById" INTEGER,
    "fileKey" TEXT,
    "data" TEXT,
    "mime" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpacePhoto_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpacePhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SpacePhoto_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SpacePost" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SpacePhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuildVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityId" INTEGER NOT NULL,
    "monthYear" TEXT NOT NULL,
    "jobId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuildVote_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuildVote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuildVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SpacePost_entityId_createdAt_idx" ON "SpacePost"("entityId", "createdAt");

-- CreateIndex
CREATE INDEX "SpacePhoto_jobId_idx" ON "SpacePhoto"("jobId");

-- CreateIndex
CREATE INDEX "SpacePhoto_entityId_createdAt_idx" ON "SpacePhoto"("entityId", "createdAt");

-- CreateIndex
CREATE INDEX "BuildVote_entityId_monthYear_idx" ON "BuildVote"("entityId", "monthYear");

-- CreateIndex
CREATE UNIQUE INDEX "BuildVote_entityId_monthYear_userId_key" ON "BuildVote"("entityId", "monthYear", "userId");

