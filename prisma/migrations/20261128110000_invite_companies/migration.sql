-- Invites carry the company and, for client logins, the client company
ALTER TABLE "UserInvite" ADD COLUMN "homeEntityId" INTEGER;
ALTER TABLE "UserInvite" ADD COLUMN "clientId" INTEGER;
