// Consistent copy of the live SQLite database. Reading the .db file directly while the app is
// writing can capture a half-written page; VACUUM INTO produces a clean, complete copy.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createPrismaClient } = require("./prisma-client");

async function snapshotDatabase(prisma) {
  const own = !prisma;
  const db = prisma || createPrismaClient();
  const file = path.join(os.tmpdir(), `psg-hub-snapshot-${Date.now()}.db`);
  try {
    await db.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    return fs.readFileSync(file);
  } finally {
    fs.rmSync(file, { force: true });
    if (own) await db.$disconnect();
  }
}

module.exports = { snapshotDatabase };
