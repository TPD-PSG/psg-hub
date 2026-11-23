-- CreateTable
CREATE TABLE "VenueDropOff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "venueId" INTEGER NOT NULL,
    "loadingAddress" TEXT,
    "loadingPostcode" TEXT,
    "what3words" TEXT,
    "accessTimes" TEXT,
    "maxVehicle" TEXT,
    "heightLimitMm" INTEGER,
    "widthLimitMm" INTEGER,
    "dockNotes" TEXT,
    "unloadingNotes" TEXT,
    "forkliftOnSite" BOOLEAN,
    "parkingNotes" TEXT,
    "emissionZone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VenueDropOff_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueDropOff_venueId_key" ON "VenueDropOff"("venueId");

-- CreateIndex
CREATE INDEX "VenueDropOff_updatedAt_idx" ON "VenueDropOff"("updatedAt");

-- CreateIndex
CREATE INDEX "Venue_updatedAt_idx" ON "Venue"("updatedAt");
