-- Build parts can be pencilled in (tentative) while the build is being quoted
ALTER TABLE "BuildPart" ADD COLUMN "pencilled" BOOLEAN NOT NULL DEFAULT false;
