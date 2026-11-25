import { run, BASE } from "./lib.mjs";

// BD extras: tender deadlines (saved; reminders 7/3/1/0 days before), results (win rate, average
// won deal, days to close) and a nudge to follow up the day after a won deal's show closes.
// The reminders need NOTIFY_SECRET (as CI has); skipped without it.
export default () => run("bd-extras", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , member, admin] = users;
  const a = await login(admin.email);
  const json = r => r.json();
  const made = { opps: [], prod: null, client: null };
  const since = new Date();
  try {
    const { bdStats } = await import("../lib/bdStats.ts");
    const d = (days, stage, value, extra = {}) => ({ stage, value, createdAt: new Date(Date.now() - days * 86400e3), stageChangedAt: new Date(), updatedAt: new Date(), ...extra });
    const s = bdStats([d(10, "won", 1000, { owner: { name: "Ann" } }), d(30, "won", 3000, { owner: { name: "Ann" } }), d(20, "won", null, { owner: { name: "Bob" } }), d(5, "lost", 500, { owner: { name: "Bob" } }), d(5, "lead", 9000)]);
    ok(s.overall.won === 3 && s.overall.lost === 1 && s.overall.winRate === 75, "win rate: 3 won, 1 lost = 75% (open deals don't count)");
    ok(s.overall.avgWon === 2000 && s.overall.medianDays === 20, "average won deal £2,000 (only deals with a value); typical time to close 20 days");
    ok(s.byOwner.find(x => x.key === "Ann").winRate === 100 && s.byOwner.find(x => x.key === "Bob").winRate === 50, "split by owner");
    const old = bdStats([d(400, "won", 1, { stageChangedAt: new Date(Date.now() - 400 * 86400e3) })], 12);
    ok(old.overall.won === 0, "deals decided more than 12 months ago are left out");

    // Tender deadline saved on a deal
    made.client = await db.client.create({ data: { name: "BDX Theatre", type: "venue" } });
    const ukToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
    const inDays = n => new Date(Date.parse(ukToday) + n * 86400e3 + 12 * 3600e3).toISOString().slice(0, 10);
    let r = await a("/api/opportunities", { method: "POST", body: JSON.stringify({ title: "BDX tender", type: "event", stage: "proposal", clientId: made.client.id, ownerUserId: member.id, tenderDeadline: inDays(3) }) });
    const opp = await json(r); made.opps.push(opp.id);
    ok(r.status === 201 || r.status === 200, "a deal is saved with a tender deadline");
    ok((await db.opportunity.findUnique({ where: { id: opp.id } })).tenderDeadline?.toISOString().startsWith(inDays(3)), "the deadline is kept");

    const secret = process.env.NOTIFY_SECRET;
    if (!secret) { results.push("PASS  reminders skipped: NOTIFY_SECRET isn't set here (it is in CI)"); return; }
    // A won deal whose show closed yesterday
    const won = await db.opportunity.create({ data: { title: "BDX won", type: "production", stage: "won", ownerUserId: member.id, clientId: made.client.id } });
    made.opps.push(won.id);
    made.prod = await db.production.create({ data: { name: "BDX show", type: "Other", endDate: new Date(Date.parse(ukToday) - 86400e3 + 19 * 3600e3) } });
    await db.opportunity.update({ where: { id: won.id }, data: { productionId: made.prod.id } });
    r = await fetch(`${BASE}/api/notify/daily`, { method: "POST", headers: { "x-notify-secret": secret } });
    ok(r.status === 200, "the daily job runs");
    const mine = await db.notification.findMany({ where: { userId: member.id, createdAt: { gte: since } } });
    ok(mine.some(n => n.title === "Tender due in 3 days: BDX tender" && n.body.includes("BDX Theatre")), "the owner is reminded 3 days before the tender deadline");
    ok(mine.some(n => n.title === "BDX show closed yesterday: follow up with BDX Theatre" && n.link === `/bd/clients/${made.client.id}`), "and nudged to follow up the day after the show closed");
    await fetch(`${BASE}/api/notify/daily`, { method: "POST", headers: { "x-notify-secret": secret } });
    ok((await db.notification.count({ where: { userId: member.id, createdAt: { gte: since }, title: { startsWith: "Tender due" } } })) === 1, "no repeats the same day");
  } finally {
    await db.notification.deleteMany({ where: { createdAt: { gte: since }, OR: [{ title: { contains: "BDX" } }, { body: { contains: "BDX" } }] } }).catch(() => {});
    for (const id of made.opps) await db.opportunity.delete({ where: { id } }).catch(() => {});
    if (made.prod) await db.production.delete({ where: { id: made.prod.id } }).catch(() => {});
    if (made.client) await db.client.delete({ where: { id: made.client.id } }).catch(() => {});
  }
});
