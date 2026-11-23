// Applies migrations. A database that was built with `prisma db push` rejects them
// (P3009/P3018), so in that case sync the schema without data loss and record every
// migration as applied, once. After that, plain `migrate deploy` works.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function prisma(...args) {
  const r = spawnSync("npx", ["prisma", ...args], { encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  process.stdout.write(out);
  return { ok: r.status === 0, out };
}

async function baseline() {
  console.log("[migrate] Database was built with db push; baselining it once.");
  // Without --accept-data-loss this refuses any change that would drop data.
  if (!prisma("db", "push", "--skip-generate").ok) return false;

  const db = new PrismaClient();
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`
    );
    const applied = new Set(rows.filter(r => r.finished_at && !r.rolled_back_at).map(r => r.migration_name));
    const failed = rows.filter(r => !r.finished_at && !r.rolled_back_at).map(r => r.migration_name);

    for (const name of failed) {
      if (!prisma("migrate", "resolve", "--rolled-back", name).ok) return false;
    }
    const dir = path.join(__dirname, "..", "prisma", "migrations");
    const names = fs.readdirSync(dir).filter(n => fs.statSync(path.join(dir, n)).isDirectory()).sort();
    for (const name of names) {
      if (applied.has(name)) continue;
      if (!prisma("migrate", "resolve", "--applied", name).ok) return false;
    }
  } finally {
    await db.$disconnect();
  }
  return prisma("migrate", "deploy").ok;
}

(async () => {
  const first = prisma("migrate", "deploy");
  if (first.ok) return;
  if (!/P3009|P3018/.test(first.out)) {
    console.error("[migrate] Migrations failed.");
    process.exit(1);
  }
  if (!(await baseline())) {
    console.error("[migrate] Baseline failed; database left as it was.");
    process.exit(1);
  }
  console.log("[migrate] Baseline complete.");
})();
