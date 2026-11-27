-- Freelancer logins: who raised a snag (freelancers raise them from My work)
ALTER TABLE "BuildCheck" ADD COLUMN "createdById" INTEGER REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
