-- Roadmap items remember the company space they were raised from
ALTER TABLE "RoadmapItem" ADD COLUMN "entityId" INTEGER REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
