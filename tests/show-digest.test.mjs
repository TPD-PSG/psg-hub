import { run, BASE } from "./lib.mjs";

// The weekly show-report digest: counts, repeat faults by cue or kit, incidents and absences as
// counts only; the API for a week; and the Monday notice to the show's PSG team (needs
// NOTIFY_SECRET, like CI; skipped without it).
export default () => run("show-digest", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email);
  const json = r => r.json();
  const made = { prod: null };
  const since = new Date();
  try {
    const { cuesIn, kitIn, mondayOf } = await import("../lib/showDigestCore.ts");
    ok(cuesIn("LX 45 late; SQ12 missing; sound q 3; Q45.5").join(",") === "LX 45,SQ 12,SQ 3,Q 45.5", "cues are recognised however they're written");
    ok(kitIn("Radio mic dropped; revolve stuck").join(",") === "radio mic,revolve", "kit is recognised");
    ok(mondayOf("2026-11-26").toISOString().startsWith("2026-11-23"), "weeks start on Monday");

    made.prod = await db.production.create({ data: { name: "Digest test show", type: "Other" } });
    await db.productionTeam.create({ data: { productionId: made.prod.id, userId: member.id } });
    await db.productionTeam.create({ data: { productionId: made.prod.id, userId: free.id } });
    const n = t => `**General**\nAll good\n\n**Technical – Lighting**\n${t}\n\n**Health & Safety / Incidents**\nActor twisted ankle, iced, carried on\n\n**Covers & Absences**\nJo (Ensemble) off sick, covered by Ann`;
    const mk = (day, num, att, notes, flags) => db.showReport.create({ data: { productionId: made.prod.id, reportDate: new Date(`${day}T00:00:00Z`), performanceNumber: num, performance: "Evening", attendance: att, houseCapacity: 1000, runningTime: "2:2" + (num % 10), notes, flags } });
    await mk("2026-11-23", 10, 800, n("LX 45 fired late. Radio mic dropped out on Sam."), '["Technical – Lighting"]');
    await mk("2026-11-24", 11, 900, n("LX45 late again"), '["Technical – Lighting"]');
    await mk("2026-11-25", 12, 700, "**Maintenance**\nRadio mic pack replaced", null);
    await mk("2026-11-30", 13, 950, "**General**\nNext week", null);

    const d = await json(await a(`/api/productions/${made.prod.id}/digest?week=2026-11-25`));
    ok(d.week === "2026-11-23" && d.performances === 3 && d.avgHousePct === 80, "the week of 23 Nov: 3 performances, 80% average house");
    ok(d.repeats.map(r => `${r.key}×${r.count}`).join(",") === "LX 45×2,radio mic×2", "repeat faults: LX 45 at two shows, radio mic at two");
    ok(d.incidents === 2 && d.absences === 2 && JSON.stringify(d).indexOf("twisted ankle") === -1 && JSON.stringify(d).indexOf("off sick") === -1, "incidents and absences are counts only: no medical detail");
    ok(d.flagged[0]?.section === "Technical – Lighting" && d.flagged[0].count === 2 && d.reports.length === 3, "flagged departments, and links to each report");
    const c = await login(users[1].email);
    ok((await c(`/api/productions/${made.prod.id}/digest`)).status === 403, "only people who can see the show's reports");

    const secret = process.env.NOTIFY_SECRET;
    if (!secret) { results.push("PASS  Monday notice skipped: NOTIFY_SECRET isn't set here (it is in CI)"); return; }
    const r = await fetch(`${BASE}/api/notify/daily?digestFor=2026-11-23`, { method: "POST", headers: { "x-notify-secret": secret } });
    ok(r.status === 200, "the daily job runs the digest for that week");
    const link = `/productions/${made.prod.id}?section=reports&digest=2026-11-23`;
    const got = await db.notification.findMany({ where: { link, createdAt: { gte: since } } });
    ok(got.length === 1 && got[0].userId === member.id && got[0].title === "Digest test show: week of 23 Nov" && got[0].body.includes("3 performances") && got[0].body.includes("LX 45"), "the show's PSG team member gets it (not the freelancer)");
  } finally {
    if (made.prod) {
      await db.notification.deleteMany({ where: { createdAt: { gte: since }, link: { contains: `/productions/${made.prod.id}` } } }).catch(() => {});
      await db.production.delete({ where: { id: made.prod.id } }).catch(() => {});
    }
  }
});
