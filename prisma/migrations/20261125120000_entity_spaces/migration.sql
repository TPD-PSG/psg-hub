-- Company spaces (e.g. The Workshop Stoke) and each person's home company. Columns added in place.
ALTER TABLE "Entity" ADD COLUMN "hasSpace" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Entity" ADD COLUMN "slug" TEXT;
ALTER TABLE "Entity" ADD COLUMN "shortName" TEXT;
ALTER TABLE "Entity" ADD COLUMN "color" TEXT;
ALTER TABLE "Entity" ADD COLUMN "logoKey" TEXT;
ALTER TABLE "Entity" ADD COLUMN "logoData" TEXT;
ALTER TABLE "Entity" ADD COLUMN "logoMime" TEXT;
CREATE UNIQUE INDEX "Entity_slug_key" ON "Entity"("slug");
ALTER TABLE "User" ADD COLUMN "homeEntityId" INTEGER REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
