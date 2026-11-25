-- Build photos can be shown to the build's client (progress photos)
ALTER TABLE "SpacePhoto" ADD COLUMN "clientVisible" BOOLEAN NOT NULL DEFAULT false;
