// Creates a Prisma client (Prisma 7 needs a driver adapter; this app uses SQLite via better-sqlite3).
// Plain CommonJS so the start-up, backup and test scripts can share it with the app.
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

// Prisma 5 resolved a relative SQLite path ("file:./dev.db") from the prisma/ folder; keep that,
// so local .env files work unchanged. Production uses an absolute path (file:/data/prod.db).
function databaseUrl() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  const file = raw.replace(/^file:/, "");
  return "file:" + (path.isAbsolute(file) ? file : path.resolve(process.cwd(), "prisma", file));
}

function createPrismaClient(options = {}) {
  return new PrismaClient({ ...options, adapter: new PrismaBetterSqlite3({ url: databaseUrl() }) });
}

module.exports = { createPrismaClient, databaseUrl };
