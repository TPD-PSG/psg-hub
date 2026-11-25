-- Client accounts belong to a client company (their builds and drawings to sign off)
ALTER TABLE "User" ADD COLUMN "clientId" INTEGER REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
