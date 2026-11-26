import { run, BASE } from "./lib.mjs";

// Machine inductions in a workshop space: the workshop's staff look after machines and trainers;
// only a machine's trainers (or admins) record inductions, signed by both; refresher dates; visitors
// by name; withdrawing; warnings (not blocks) in the planner and on the tablet; daily reminders.
export default () => run("machine-inductions", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const made = { e: null };
  const since = new Date();
  const SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const day = n => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
  try {
    const core = await import("../lib/inductionsCore.ts");
    ok(core.refresherDate(new Date("2026-01-31T00:00:00Z"), 1).toISOString().startsWith("2026-02-28") && core.refresherDate(new Date("2026-03-15T00:00:00Z"), 12).toISOString().startsWith("2027-03-15") && core.refresherDate(new Date(), 0) === null, "refresher dates: months later, end-of-month safe, none for 0");
    const now = new Date("2026-06-01T00:00:00Z");
    const ind = (exp, rev = null) => ({ inductedAt: "2025-06-01", expiresAt: exp, revokedAt: rev });
    ok(core.inductionStatus(ind("2026-12-01"), now) === "valid" && core.inductionStatus(ind("2026-06-20"), now) === "due" && core.inductionStatus(ind("2026-05-01"), now) === "expired" && core.inductionStatus(ind(null), now) === "valid" && core.inductionStatus(ind("2026-12-01", "2026-05-01"), now) === "none" && core.inductionStatus(null, now) === "none", "status: valid, due within 30 days, lapsed, none when withdrawn or never");
    ok(core.missing([{ machineId: 1, ...ind("2026-12-01") }, { machineId: 2, ...ind("2026-01-01") }], [1, 2, 3], now).join() === "2,3", "missing lists machines never inducted or lapsed");

    made.e = await db.entity.create({ data: { name: "ZZ Induction Shop", slug: "zz-ind-shop", hasSpace: true } });
    await db.user.updateMany({ where: { id: { in: [member.id, free.id] } }, data: { homeEntityId: made.e.id } });
    const a = await login(admin.email), m = await login(member.email), f = await login(free.email), c = await login(client.email);
    const api = `/api/spaces/${made.e.slug}/machines`;

    ok((await c(api)).status === 403, "someone outside the space can't see its machines");
    let d = await (await f(api)).json();
    ok(d.staff === false && d.machines.length === 0, "a freelancer in the workshop sees it, not as staff");
    ok((await f(api, { method: "POST", body: JSON.stringify({ usual: true }) })).status === 403, "a freelancer can't add machines");
    d = await (await m(api, { method: "POST", body: JSON.stringify({ usual: true }) })).json();
    ok(d.staff && d.machines.length >= 10, "the workshop's staff add the usual machines");
    const saw = d.machines.find(x => x.name === "Panel saw"), band = d.machines.find(x => x.name === "Bandsaw");
    ok(d.canTrain.length === 0, "being staff doesn't make you a trainer");
    ok((await m(`/api/machines/${saw.id}`, { method: "PATCH", body: JSON.stringify({ trainerIds: [free.id] }) })).status === 400, "trainers must be the workshop's own staff");
    d = await (await m(`/api/machines/${saw.id}`, { method: "PATCH", body: JSON.stringify({ trainerIds: [member.id] }) })).json();
    ok(d.canTrain.includes(saw.id) && !d.canTrain.includes(band.id), "the member becomes the panel saw's trainer");

    // Recording inductions
    const rec = (who, machine, body) => who(`/api/machines/${machine}/inductions`, { method: "POST", body: JSON.stringify({ inductedAt: day(0), traineeSignature: SIG, trainerSignature: SIG, ...body }) });
    ok((await rec(f, saw.id, { userId: free.id })).status === 403, "a non-trainer can't record an induction");
    ok((await rec(m, band.id, { userId: free.id })).status === 403, "a trainer can't record on a machine they don't train on");
    ok((await rec(m, saw.id, { userId: free.id, traineeSignature: null })).status === 400, "both signatures are needed");
    ok((await rec(m, saw.id, { userId: free.id, inductedAt: day(5) })).status === 400, "not a date in the future");
    let r = await rec(m, saw.id, { userId: free.id, notes: "Guards, push sticks" });
    const first = await r.json();
    const due = new Date(new Date(`${day(0)}T00:00:00Z`).setUTCMonth(new Date(`${day(0)}T00:00:00Z`).getUTCMonth() + 12)).toISOString().slice(0, 10);
    ok(r.status === 201 && first.induction.expiresAt.startsWith(due) && first.induction.trainerName.length > 0, "the trainer records an induction; refresher in 12 months");
    r = await rec(m, saw.id, { personName: "Visiting Carpenter", personCompany: "Hire Co" });
    d = await r.json();
    const visitor = d.people.find(p => p.name === "Visiting Carpenter");
    ok(r.status === 201 && visitor && visitor.userId === null && !visitor.team && d.cells[visitor.key][saw.id].status === "valid", "a visitor without a login is inducted by name");
    ok(d.cells[`u${free.id}`][saw.id].status === "valid", "the matrix shows the freelancer inducted on the panel saw");
    ok((await rec(a, band.id, { userId: member.id })).status === 201, "an admin can induct on any machine");

    // Who sees what
    const fd = await (await f(api)).json();
    ok(fd.people.length === 1 && fd.people[0].userId === free.id && fd.cells[`u${free.id}`][saw.id].status === "valid", "the freelancer sees only their own row");
    const own = await f(`/api/machine-inductions/${first.induction.id}`);
    ok(own.status === 200 && (await own.json()).traineeSignature.startsWith("data:image/png"), "and can open their own signed record");
    const vRec = d.cells[visitor.key][saw.id].id;
    ok((await f(`/api/machine-inductions/${vRec}`)).status === 404, "but not someone else's");

    // Warnings: planner and tablet
    const job = await db.job.create({ data: { number: "J-2099-971", title: "IND test build", jobType: "workshop", entityId: made.e.id, stage: "build" } });
    const part = await db.buildPart.create({ data: { jobId: job.id, label: "Cut flats", userId: free.id, startDate: new Date(`${day(0)}T00:00:00Z`), days: 2 } });
    ok((await m(`/api/jobs/${job.id}/parts/${part.id}`, { method: "PATCH", body: JSON.stringify({ machineIds: [999999] }) })).status === 400, "a part can't need an unknown machine");
    r = await m(`/api/jobs/${job.id}/parts/${part.id}`, { method: "PATCH", body: JSON.stringify({ machineIds: [saw.id, band.id] }) });
    ok(r.status === 200 && (await r.json()).machines.length === 2, "a part lists the machines it needs");
    const pl = await (await m(`/api/spaces/${made.e.slug}/planner`)).json();
    ok(pl.machines.some(x => x.id === saw.id) && (pl.inducted[free.id] ?? []).includes(saw.id) && !(pl.inducted[free.id] ?? []).includes(band.id), "the planner knows the freelancer is inducted on the panel saw, not the bandsaw");
    const t = await (await m(`/api/spaces/${made.e.slug}/tablet`, { method: "POST", body: JSON.stringify({ userId: free.id, action: "on", jobId: job.id }) })).json();
    ok(Array.isArray(t.notInducted) && t.notInducted.includes("Bandsaw") && !t.notInducted.includes("Panel saw"), "clocking on to the build warns about machines their part needs that they're not inducted on");
    ok((await db.clockEntry.count({ where: { userId: free.id, jobId: job.id, endAt: null } })) === 1, "warning only: they're still clocked on");
    await m(`/api/spaces/${made.e.slug}/tablet`, { method: "POST", body: JSON.stringify({ userId: free.id, action: "off" }) });
    const t2 = await (await m(`/api/spaces/${made.e.slug}/tablet`, { method: "POST", body: JSON.stringify({ userId: member.id, action: "on", jobId: job.id }) })).json();
    ok(!t2.notInducted, "no warning for someone the part isn't planned on");
    await m(`/api/spaces/${made.e.slug}/tablet`, { method: "POST", body: JSON.stringify({ userId: member.id, action: "off" }) });

    // Withdrawing
    ok((await f(`/api/machine-inductions/${first.induction.id}`, { method: "PATCH", body: JSON.stringify({ revoke: "x" }) })).status === 403, "the trainee can't withdraw an induction");
    ok((await m(`/api/machine-inductions/${first.induction.id}`, { method: "PATCH", body: "{}" })).status === 400, "withdrawing needs a reason");
    d = await (await m(`/api/machine-inductions/${first.induction.id}`, { method: "PATCH", body: JSON.stringify({ revoke: "Removed the guard" }) })).json();
    ok(!d.cells[`u${free.id}`][saw.id], "once withdrawn it no longer counts");

    // Daily reminders: 30 days before the refresher
    const secret = process.env.NOTIFY_SECRET;
    if (!secret) results.push("PASS  refresher reminders skipped: NOTIFY_SECRET isn't set here (it is in CI)");
    else {
      const old = new Date(Date.now() - 335 * 86400e3);
      const start = new Date(); start.setHours(0, 0, 0, 0);
      await db.machineInduction.create({ data: { machineId: saw.id, userId: free.id, personName: "x", trainerName: "y", trainerId: member.id, inductedAt: old, expiresAt: new Date(start.getTime() + 30 * 86400e3 + 3600e3), traineeSignature: SIG, trainerSignature: SIG } });
      await fetch(`${BASE}/api/notify/daily`, { method: "POST", headers: { "x-notify-secret": secret } });
      ok((await db.notification.count({ where: { userId: free.id, createdAt: { gte: since }, title: { startsWith: "Your Panel saw induction needs a refresher in 30 days" } } })) === 1, "the person is reminded 30 days before their refresher");
      ok((await db.notification.count({ where: { userId: member.id, createdAt: { gte: since }, title: { contains: "Panel saw refresher is due in 30 days" } } })) === 1, "and so is the machine's trainer");
    }
  } finally {
    if (made.e) {
      await db.notification.deleteMany({ where: { createdAt: { gte: since }, link: { contains: "/spaces/zz-ind-shop/" } } }).catch(() => {});
      await db.clockEntry.deleteMany({ where: { job: { entityId: made.e.id } } }).catch(() => {});
      await db.timeEntry.deleteMany({ where: { job: { entityId: made.e.id } } }).catch(() => {});
      await db.job.deleteMany({ where: { entityId: made.e.id } }).catch(() => {});
      await db.user.updateMany({ where: { homeEntityId: made.e.id }, data: { homeEntityId: null } }).catch(() => {});
      await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
    }
  }
});
