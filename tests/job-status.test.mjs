import { createRequire } from "module";
import { run } from "./lib.mjs";
const { recordRun, readJobStatus } = createRequire(import.meta.url)("../lib/job-status.js");

// Hub Settings status panel: jobs record their runs; only admins can see them; rejected
// callers (no secret / not signed in) don't count as runs. Never calls the real email import.
export default () => run("job-status", async ({ db, users, login, anon, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const saved = await db.setting.findMany({ where: { key: { startsWith: "job:" } } });
  try {
    await db.setting.deleteMany({ where: { key: { startsWith: "job:" } } });
    const states = async () => Object.fromEntries((await readJobStatus(db)).map(j => [j.job, j]));

    ok((await states())["report-import"].state === "never", "no runs recorded → never");
    await recordRun(db, "report-import", true, "3 emails: 1 imported");
    let s = (await states())["report-import"];
    ok(s.state === "ok" && s.summary === "3 emails: 1 imported" && s.lastOkAt, "successful run → ok, with summary");
    await recordRun(db, "report-import", false, "Mailbox error");
    s = (await states())["report-import"];
    ok(s.state === "failing" && s.lastOkAt, "failed run → failing, still knows when it last worked");
    ok((await readJobStatus(db, new Date(Date.now() + 2 * 3600e3))).find(j => j.job === "notify-daily").state === "never", "other jobs untouched");
    await recordRun(db, "backup-hourly", true, "x");
    ok((await readJobStatus(db, new Date(Date.now() + 4 * 3600e3))).find(j => j.job === "backup-hourly").state === "late", "hourly backup 4 h old → overdue");

    const before = (await states())["report-import"].lastRunAt;
    const r1 = await anon("/api/show-reports/ingest", { method: "POST" });
    const r2 = await anon("/api/notify/daily", { method: "POST" });
    ok(r1.status === 401 && r2.status === 401, "import/notify without sign-in or secret → 401");
    ok((await states())["report-import"].lastRunAt === before && (await states())["notify-daily"].state === "never", "rejected calls aren't recorded as runs");

    const admin = await login(users[3].email), member = await login(users[2].email);
    const a = await admin("/api/admin/status");
    const body = await a.json();
    ok(a.status === 200 && body.jobs?.length === 4 && body.jobs.some(j => j.job === "report-import" && j.state === "failing"), "admin sees all four jobs");
    ok((await member("/api/admin/status")).status === 403, "member can't see status");
    ok((await anon("/api/admin/status")).status !== 200, "signed-out can't see status");
  } finally {
    await db.setting.deleteMany({ where: { key: { startsWith: "job:" } } });
    for (const r of saved) await db.setting.create({ data: { key: r.key, value: r.value } });
  }
});
