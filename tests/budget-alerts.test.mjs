import { run } from "./lib.mjs";

// Overspend alerts (27 Nov 2026): when spend takes a budget line, or the whole budget, to 90% or
// over, the show's staff team gets one Hub notification. Not sent twice; sent again after it drops
// back under; freelancers and clients never get one; old levels don't re-alert.
export default () => run("budget-alerts", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  let pid = null;
  try {
    const core = await import("../lib/budgetAlertsCore.ts");
    ok(core.alertLevel(1000, 899.99) === 0 && core.alertLevel(1000, 900) === 90 && core.alertLevel(1000, 1000) === 90 && core.alertLevel(1000, 1000.01) === 100, "90% is nearly spent, a penny over is over");
    ok(core.alertLevel(0, 0) === 0 && core.alertLevel(0, 5) === 100 && core.alertLevel(500, -20) === 0, "spend on a line with no allocation is over; nothing spent is fine");
    const w = core.budgetWarnings([{ id: 1, department: "A", description: "a", allocation: 100, net: 95 }, { id: 2, department: "B", description: "b", allocation: 100, net: 150 }, { id: 3, department: "C", description: "c", allocation: 100, net: 10 }], { allocation: 300, net: 280 });
    ok(w.map(x => x.lineId).join(",") === ",2,1", "warnings list the whole budget first, then the worst line");

    const p = await db.production.create({ data: { name: "BA test show", type: "tour" } });
    pid = p.id;
    await db.productionTeam.createMany({ data: [admin, member, free].map(u => ({ productionId: pid, userId: u.id })) });
    const a = await login(admin.email);
    const since = new Date();
    const mine = async uid => db.notification.findMany({ where: { userId: uid, createdAt: { gte: since }, link: `/productions/${pid}?section=budget` }, orderBy: { id: "asc" } });

    let r = await a(`/api/productions/${pid}/budget`, { method: "POST", body: JSON.stringify({ department: "Scenery", description: "Build", budgeted: 1000 }) });
    const line = await r.json();
    r = await a(`/api/budget-lines/${line.id}/expenses`, { method: "POST", body: JSON.stringify({ description: "Timber", committed: 500 }) });
    ok(r.status === 201 && (await mine(admin.id)).length === 0, "half spent: no alert");

    r = await a(`/api/budget-lines/${line.id}/expenses`, { method: "POST", body: JSON.stringify({ description: "Paint", committed: 420 }) });
    const e2 = await r.json();
    let n = await mine(admin.id);
    ok(n.some(x => x.title === "Nearly spent: Scenery: Build · BA test show" && /£920 of £1,000 \(92%\)/.test(x.body)), "reaching 90% sends 'nearly spent' with the figures");
    ok(n.some(x => x.title === "BA test show's budget is nearly spent"), "the whole budget gets its own alert");
    ok((await mine(member.id)).length === n.length, "staff on the show's team get it");
    ok((await mine(free.id)).length === 0, "freelancers on the team don't (they can't see budgets)");

    await a(`/api/budget-expenses/${e2.id}`, { method: "PUT", body: JSON.stringify({ ...e2, committed: 430 }) });
    ok((await mine(admin.id)).length === n.length, "more spend at the same level isn't sent again");

    await a(`/api/budget-expenses/${e2.id}`, { method: "PUT", body: JSON.stringify({ ...e2, committed: 650 }) });
    n = await mine(admin.id);
    ok(n.some(x => x.title === "Over budget: Scenery: Build · BA test show" && /£150 over/.test(x.body)), "going over sends 'over budget' with how much");
    ok(n.some(x => x.title === "BA test show is over budget"), "and the whole budget too");
    const count = n.length;
    ok((await db.budgetLine.findUnique({ where: { id: line.id } })).alertLevel === 100, "the line remembers it alerted as over");

    // An approved variation adds budget: back to nearly spent, nothing sent
    const v = await db.budgetVariation.create({ data: { productionId: pid, type: "additional_spend", status: "pending_approval", title: "BA more", items: { create: [{ budgetLineId: line.id, amount: 200 }] } } });
    await a(`/api/budget-reallocation/${v.id}`, { method: "PUT", body: JSON.stringify({ status: "approved" }) });
    ok((await db.budgetLine.findUnique({ where: { id: line.id } })).alertLevel === 90 && (await mine(admin.id)).length === count, "extra budget lowers the level without an alert");

    // Back under, then over again: alerts again
    await a(`/api/budget-expenses/${e2.id}`, { method: "DELETE" });
    ok((await db.budgetLine.findUnique({ where: { id: line.id } })).alertLevel === 0, "dropping back under resets it");
    await a(`/api/budget-lines/${line.id}/expenses`, { method: "POST", body: JSON.stringify({ description: "Steel", committed: 900 }) });
    n = await mine(admin.id);
    ok(n.filter(x => x.title.startsWith("Over budget: Scenery")).length === 2, "going over again after dropping back sends it again");

    // Haulage on the line counts too
    const line2 = await (await a(`/api/productions/${pid}/budget`, { method: "POST", body: JSON.stringify({ department: "Transport", description: "Trucks", budgeted: 300 }) })).json();
    await a(`/api/productions/${pid}/haulage`, { method: "POST", body: JSON.stringify({ haulageCompany: "BA Haul", fromLocation: "A", toLocation: "B", departureAt: "2099-01-01", actualCost: 350, budgetLineId: line2.id }) });
    ok((await mine(admin.id)).some(x => x.title === "Over budget: Transport: Trucks · BA test show"), "haulage linked to a line counts towards it");

  } catch (e) {
    ok(false, `threw: ${e instanceof Error ? e.message : e}`);
  } finally {
    if (pid) {
      await db.notification.deleteMany({ where: { link: `/productions/${pid}?section=budget` } });
      await db.production.delete({ where: { id: pid } });
    }
  }
});
