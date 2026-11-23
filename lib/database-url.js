// The SQLite file Prisma should use. Kept free of Prisma imports so prisma.config.ts can load it
// before `prisma generate` has run (e.g. in a fresh Docker build).
// Prisma 5 resolved a relative "file:./dev.db" from the prisma/ folder; keep that, so local .env
// files work unchanged. Production uses an absolute path (file:/data/prod.db).
const path = require("path");

function databaseUrl() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  const file = raw.replace(/^file:/, "");
  return "file:" + (path.isAbsolute(file) ? file : path.resolve(process.cwd(), "prisma", file));
}

module.exports = { databaseUrl };
