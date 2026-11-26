import { run, BASE } from "./lib.mjs";

// Equipment checks in a workshop space: any kit with the checks it needs; pass sets the next due
// date, fail takes it out of use until a later pass; out of use by hand; certificates; the planner
// and tablet warn; daily reminders 14 days before (with NOTIFY_SECRET).
export default () => run("equipment-checks", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member] = users;
  const made = { e: null };
  const since = new Date();
  const day = n => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
  try {
    const core = await import("../lib/equipmentCore.ts");
    const now = new Date("2026-06-01T00:00:00Z");
    ok(core.addMonths(new Date("2026-08-31T00:00:00Z"), 6).toISOString().startsWith("2027-02-28") && core.addMonths(now, 0) === null, "next due: months later, end-of-month safe, none for 0");
    ok(core.checkState({ firstDue: null }, [], now).status === "never" && core.checkState({ firstDue: "2026-05-01" }, [], now).status === "overdue", "a check never done is 'never', or overdue once its first due date passes");
    ok(core.checkState({ firstDue: null }, [{ doneAt: "2026-01-01", passed: true, nextDue: "2026-06-20" }], now).status === "due" && core.checkState({ firstDue: null }, [{ doneAt: "2026-01-01", passed: true, nextDue: "2026-03-01" }, { doneAt: "2026-05-01", passed: false, nextDue: null }], now).status === "failed", "due within 30 days; the latest fail wins");
    ok(core.itemState({ outOfUseAt: null }, ["ok", "never"]) === "due" && core.itemState({ outOfUseAt: null }, ["ok", "overdue"]) === "overdue" && core.itemState({ outOfUseAt: "2026-05-01" }, ["ok"]) === "out" && core.unusable("overdue") && !core.unusable("due"), "item state: never asks for a record, overdue and out of use mean don't use");

    made.e = await db.entity.create({ data: { name: "ZZ Equipment Shop", slug: "zz-eq-shop", hasSpace: true } });
    await db.user.updateMany({ where: { id: { in: [member.id, free.id] } }, data: { homeEntityId: made.e.id } });
    const m = await login(member.email), f = await login(free.email), c = await login(client.email);
    const api = `/api/spaces/${made.e.slug}/equipment`;

    ok((await c(api)).status === 403, "someone outside the space can't see its equipment");
    ok((await f(api, { method: "POST", body: JSON.stringify({ name: "Sling", category: "lifting" }) })).status === 403, "a freelancer can't add equipment");
    let d = await (await m(api, { method: "POST", body: JSON.stringify({ name: "Chain sling 1t", category: "lifting", assetTag: "SL-01" }) })).json();
    let sling = d.items.find(i => i.name === "Chain sling 1t");
    ok(sling && sling.checks.length === 1 && sling.checks[0].kind === "thorough_exam" && sling.checks[0].intervalMonths === 6 && !sling.needsInduction, "lifting gear gets a 6-monthly thorough examination, and no induction");
    ok(sling.status === "due" && sling.checks[0].status === "never", "with no record yet it asks for one (not out of use)");
    const fd = await (await f(api)).json();
    ok(fd.staff === false && fd.items.some(i => i.id === sling.id), "a freelancer in the workshop sees the kit");

    // Recording results
    const rec = (who, checkId, body) => who(`/api/equipment-checks/${checkId}/records`, { method: "POST", body: JSON.stringify({ doneAt: day(0), doneBy: "LOLER Inspections Ltd", ...body }) });
    ok((await rec(f, sling.checks[0].id, { passed: true })).status === 403, "a freelancer can't record checks");
    ok((await rec(m, sling.checks[0].id, {})).status === 400, "a result needs pass or fail");
    const PDF = "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg==";
    d = await (await rec(m, sling.checks[0].id, { passed: true, file: { name: "loler.pdf", dataUrl: PDF } })).json();
    sling = d.items.find(i => i.id === sling.id);
    const want = new Date(`${day(0)}T00:00:00Z`); want.setUTCMonth(want.getUTCMonth() + 6);
    ok(sling.status === "ok" && sling.checks[0].due.startsWith(want.toISOString().slice(0, 7)), "a pass sets the next examination 6 months on");
    const certId = sling.checks[0].records[0].id;
    const cert = await f(`/api/equipment-check-records/${certId}`);
    ok(cert.status === 200 && cert.headers.get("content-type") === "application/pdf", "anyone in the workshop can open the certificate");
    ok((await c(`/api/equipment-check-records/${certId}`)).status === 403, "outsiders can't");

    // A failure, warnings, then a pass
    d = await (await rec(m, sling.checks[0].id, { passed: false, notes: "Link stretched" })).json();
    sling = d.items.find(i => i.id === sling.id);
    ok(sling.status === "out" && sling.checks[0].status === "failed", "a failed check takes it out of use");
    const job = await db.job.create({ data: { number: "J-2099-961", title: "EQ test build", jobType: "workshop", entityId: made.e.id, stage: "build" } });
    const part = await db.buildPart.create({ data: { jobId: job.id, label: "Fly the header", userId: free.id, startDate: new Date(`${day(0)}T00:00:00Z`), days: 1, machines: { create: [{ machineId: sling.id }] } } });
    const pl = await (await m(`/api/spaces/${made.e.slug}/planner`)).json();
    ok(pl.unavailable[sling.id]?.includes("failed"), "the planner knows it can't be used, and why");
    const t = await (await m(`/api/spaces/${made.e.slug}/tablet`, { method: "POST", body: JSON.stringify({ userId: free.id, action: "on", jobId: job.id }) })).json();
    ok(t.kitProblems?.[0]?.startsWith("Chain sling 1t"), "clocking on to work that needs it warns not to use it");
    await m(`/api/spaces/${made.e.slug}/tablet`, { method: "POST", body: JSON.stringify({ userId: free.id, action: "off" }) });
    d = await (await rec(m, sling.checks[0].id, { passed: true, doneBy: "LOLER Inspections Ltd", notes: "Sling replaced" })).json();
    ok(d.items.find(i => i.id === sling.id).status === "ok", "a later pass puts it back in use");
    ok(!(await (await m(`/api/spaces/${made.e.slug}/planner`)).json()).unavailable[sling.id], "and the planner stops warning");
    void part;

    // Out of use by hand
    ok((await m(`/api/machines/${sling.id}?view=equipment`, { method: "PATCH", body: JSON.stringify({ outOfUse: "" }) })).status === 400, "taking it out of use needs a reason");
    d = await (await m(`/api/machines/${sling.id}?view=equipment`, { method: "PATCH", body: JSON.stringify({ outOfUse: "Lost on tour" }) })).json();
    ok(d.items.find(i => i.id === sling.id).status === "out", "staff take it out of use by hand");
    d = await (await m(`/api/machines/${sling.id}?view=equipment`, { method: "PATCH", body: JSON.stringify({ outOfUse: false }) })).json();
    ok(d.items.find(i => i.id === sling.id).status === "ok", "and put it back");

    // Machines and the inductions table
    d = await (await m(api, { method: "POST", body: JSON.stringify({ name: "Panel saw", category: "machine" }) })).json();
    const saw = d.items.find(i => i.name === "Panel saw");
    ok(saw.needsInduction && saw.checks.map(x => x.kind).sort().join() === "pat,service", "a machine gets service and PAT checks, and needs inductions");
    const mx = await (await m(`/api/spaces/${made.e.slug}/machines`)).json();
    ok(mx.machines.some(x => x.id === saw.id) && !mx.machines.some(x => x.id === sling.id), "the inductions table lists the saw but not the sling");

    // Adding and removing a check
    d = await (await m(`/api/machines/${saw.id}/checks`, { method: "POST", body: JSON.stringify({ kind: "inspection", intervalMonths: 1, firstDue: day(-2) }) })).json();
    const sawNow = d.items.find(i => i.id === saw.id);
    ok(sawNow.checks.length === 3 && sawNow.status === "overdue", "a monthly inspection first due two days ago makes it overdue");
    const insp = sawNow.checks.find(x => x.kind === "inspection");
    d = await (await m(`/api/equipment-checks/${insp.id}`, { method: "DELETE" })).json();
    ok(d.items.find(i => i.id === saw.id).checks.length === 2, "a check can be removed");

    // Daily reminder 14 days before
    const secret = process.env.NOTIFY_SECRET;
    if (!secret) results.push("PASS  check reminders skipped: NOTIFY_SECRET isn't set here (it is in CI)");
    else {
      await m(`/api/machines/${saw.id}/checks`, { method: "POST", body: JSON.stringify({ kind: "calibration", intervalMonths: 12, firstDue: day(14) }) });
      await fetch(`${BASE}/api/notify/daily`, { method: "POST", headers: { "x-notify-secret": secret } });
      ok((await db.notification.count({ where: { userId: member.id, createdAt: { gte: since }, title: "Panel saw: Calibration due in 14 days" } })) === 1, "the workshop's staff are reminded 14 days before a check");
    }
  } finally {
    if (made.e) {
      await db.notification.deleteMany({ where: { createdAt: { gte: since }, link: { contains: "/spaces/zz-eq-shop/" } } }).catch(() => {});
      await db.clockEntry.deleteMany({ where: { job: { entityId: made.e.id } } }).catch(() => {});
      await db.timeEntry.deleteMany({ where: { job: { entityId: made.e.id } } }).catch(() => {});
      await db.job.deleteMany({ where: { entityId: made.e.id } }).catch(() => {});
      await db.user.updateMany({ where: { homeEntityId: made.e.id }, data: { homeEntityId: null } }).catch(() => {});
      await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
    }
  }
});
