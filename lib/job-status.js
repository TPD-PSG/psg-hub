// Background jobs (email import, daily notifications, backups) record each run here so the
// Hub Settings status panel can show when they last ran and whether it worked. Stored in the
// Setting table as `job:<name>` → JSON. Plain CommonJS so scripts/backup.js can use it too.

/** How often each job should run, and what counts as overdue (hours). */
const JOBS = {
  "report-import": { label: "Show-report email import", lateAfterH: 1 },
  "backup-hourly": { label: "Hourly database backup", lateAfterH: 3 },
  "notify-daily": { label: "Daily notifications", lateAfterH: 26 },
  "backup-daily": { label: "Daily database backup", lateAfterH: 26 },
};

/**
 * Record one run. Never throws: a status write must not break the job itself.
 * `lastOkAt` is kept from earlier runs so a failure still shows when it last worked.
 */
async function recordRun(db, job, ok, summary) {
  try {
    const key = `job:${job}`;
    const prev = await db.setting.findUnique({ where: { key } });
    let lastOkAt = null;
    try { lastOkAt = prev ? JSON.parse(prev.value).lastOkAt ?? null : null; } catch { /* ignore */ }
    const at = new Date().toISOString();
    const value = JSON.stringify({ at, ok: !!ok, summary: String(summary ?? "").slice(0, 300), lastOkAt: ok ? at : lastOkAt });
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  } catch (err) {
    console.error(`[job-status] couldn't record ${job}:`, err && err.message);
  }
}

/** Every known job with its last run and a state: ok, late, failing or never. */
async function readJobStatus(db, now = new Date()) {
  const rows = await db.setting.findMany({ where: { key: { startsWith: "job:" } } });
  const byKey = Object.fromEntries(rows.map(r => [r.key.slice(4), r.value]));
  return Object.entries(JOBS).map(([job, meta]) => {
    let run = null;
    try { run = byKey[job] ? JSON.parse(byKey[job]) : null; } catch { /* ignore */ }
    let state = "never";
    if (run) {
      const ageH = (now.getTime() - new Date(run.at).getTime()) / 3600e3;
      state = !run.ok ? "failing" : ageH > meta.lateAfterH ? "late" : "ok";
    }
    return { job, label: meta.label, lateAfterH: meta.lateAfterH, state, lastRunAt: run?.at ?? null, lastOkAt: run?.lastOkAt ?? null, summary: run?.summary ?? null };
  });
}

module.exports = { JOBS, recordRun, readJobStatus };
