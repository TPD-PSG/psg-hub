// Creates a Prisma client (Prisma 7 needs a driver adapter; this app uses SQLite via better-sqlite3).
// Plain CommonJS so the start-up, backup and test scripts can share it with the app.
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { databaseUrl } = require("./database-url");

function createPrismaClient(options = {}) {
  return new PrismaClient({ ...options, adapter: new PrismaBetterSqlite3({ url: databaseUrl() }) });
}

module.exports = { createPrismaClient, databaseUrl };
