// Applies migrations. A database that was built with `prisma db push` rejects them
// (P3009/P3018), so in that case sync the schema without data loss and record every
// migration as applied, once. After that, plain `migrate deploy` works, and any failure is
// reported (log + admin notification) and left unapplied, never baselined over.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createPrismaClient } = require("../lib/prisma-client");

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

  const db = createPrismaClient();
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

// Has this database been migrating normally since the one-off baseline (23 Nov 2026)? Then a
// failure is a real one and must never be papered over by a baseline (audit round 2).
const BASELINE_ERA = "20261124";
async function migratedSinceBaseline() {
  const db = createPrismaClient();
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT COUNT(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL AND migration_name >= ?`, BASELINE_ERA
    );
    return Number(rows[0]?.n ?? 0) > 0;
  } catch {
    return false; // no migrations table yet: a db-push database
  } finally {
    await db.$disconnect();
  }
}

/** Tell the admins in the Hub (best effort: the database may be the thing that's broken). */
async function alertAdmins(text) {
  const db = createPrismaClient();
  try {
    const admins = await db.user.findMany({ where: { role: "admin" }, select: { id: true } });
    await db.notification.createMany({ data: admins.map(a => ({ userId: a.id, title: "Database update failed on deploy", body: text.slice(0, 1000), link: "/admin/settings" })) });
  } catch (e) {
    console.error("[migrate] couldn't notify admins:", e && e.message);
  } finally {
    await db.$disconnect();
  }
}

(async () => {
  const first = prisma("migrate", "deploy");
  if (first.ok) return;
  const failing = (first.out.match(/Migration name: (\S+)/) || first.out.match(/`(\d{14}_[\w-]+)`/) || [])[1] ?? "unknown";
  if (!/P3009|P3018/.test(first.out) || (await migratedSinceBaseline())) {
    console.error(`[migrate] Migrations FAILED (migration: ${failing}). Nothing was marked as applied; fix the migration and redeploy.`);
    await alertAdmins(`Migration ${failing} failed. The site is running on the previous database layout until it's fixed. See the deploy log.`);
    process.exit(1);
  }
  if (!(await baseline())) {
    console.error("[migrate] Baseline failed; database left as it was.");
    process.exit(1);
  }
  console.log("[migrate] Baseline complete.");
})();
