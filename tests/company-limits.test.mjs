import { run } from "./lib.mjs";

// "Companies they can see": someone limited to company P sees P's productions, deals, quotes and
// jobs, and nothing of company W's or untagged records. Admins see everything. New records they
// add land in their company.
export default () => run("company-limits", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , member, admin] = users;
  const a = await login(admin.email);
  let m = await login(member.email);
  const json = r => r.json();
  const before = await db.user.findUnique({ where: { id: member.id }, select: { permissions: true } });
  const made = { P: null, W: null, prods: [], deals: [], quotes: [], jobs: [], newIds: { prods: [], deals: [], jobs: [], quotes: [] } };
  const limit = async ids => {
    const p = before.permissions ? JSON.parse(before.permissions) : { modules: ["bd", "productions", "venues", "tasks", "property", "finance", "sales", "marketing", "roadmap", "suppliers", "fun", "ask"], allProductions: true };
    delete p.spaceEntityIds;
    if (ids === undefined) delete p.entityIds; else p.entityIds = ids;
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ ...p, allProductions: true, modules: [...new Set([...(p.modules ?? []), "bd", "productions"])] }) } });
  };
  try {
    made.P = await db.entity.create({ data: { name: "Limit test PSG" } });
    made.W = await db.entity.create({ data: { name: "Limit test TWS" } });
    const mkProd = (name, entityId) => db.production.create({ data: { name, type: "play", entityId } });
    const pP = await mkProd("CL PSG show", made.P.id), pW = await mkProd("CL TWS show", made.W.id), pN = await mkProd("CL untagged show", null);
    made.prods.push(pP, pW, pN);
    const dP = await db.opportunity.create({ data: { title: "CL PSG deal", type: "production", entityId: made.P.id } }), dW = await db.opportunity.create({ data: { title: "CL TWS deal", type: "production", entityId: made.W.id } });
    made.deals.push(dP, dW);
    const qW = await db.quote.create({ data: { number: "Q-2099-991", title: "CL TWS quote", entityId: made.W.id } });
    made.quotes.push(qW);
    const jW = await db.job.create({ data: { number: "J-2099-991", title: "CL TWS job", jobType: "workshop", entityId: made.W.id } });
    const jP = await db.job.create({ data: { number: "J-2099-992", title: "CL PSG job", jobType: "pm", entityId: made.P.id } });
    made.jobs.push(jW, jP);

    await limit([made.P.id]);
    m = await login(member.email); // modules (BD, all productions) are read at sign-in; the company limit itself applies at once
    const prods = await json(await m("/api/productions"));
    ok(prods.some(p => p.id === pP.id) && !prods.some(p => p.id === pW.id) && !prods.some(p => p.id === pN.id), "productions: their company's only (not the other's, not untagged)");
    ok((await m(`/api/productions/${pW.id}`)).status === 403 && (await m(`/api/productions/${pP.id}`)).status === 200, "the other company's production page is refused");
    ok((await m(`/api/productions/${pW.id}/key-dates`)).status === 403 && (await m(`/api/productions/${pP.id}/key-dates`)).status === 200, "…and what's inside it");
    const cal = JSON.stringify(await json(await m("/api/calendar")));
    ok(!cal.includes("CL TWS show") && !cal.includes("CL untagged show"), "calendar leaves them out");
    const deals = await json(await m("/api/opportunities"));
    ok(deals.some(d => d.id === dP.id) && !deals.some(d => d.id === dW.id), "deals: their company's only");
    ok((await m(`/api/opportunities/${dW.id}`, { method: "PUT", body: JSON.stringify({ title: "x" }) })).status === 404, "can't change the other company's deal");
    ok((await m(`/api/opportunities/${dP.id}`, { method: "PUT", body: JSON.stringify({ entityId: made.W.id }) })).status === 400, "can't move a deal to the other company");
    let r = await m("/api/opportunities", { method: "POST", body: JSON.stringify({ title: "CL new deal" }) });
    const nd = await json(r); made.newIds.deals.push(nd.id);
    ok(r.status === 201 && nd.entityId === made.P.id, "a new deal lands in their company");
    ok((await m("/api/opportunities", { method: "POST", body: JSON.stringify({ title: "CL bad deal", entityId: made.W.id }) })).status === 400, "can't add a deal for the other company");
    ok(!(await json(await m("/api/quotes"))).some(q => q.id === qW.id) && (await m(`/api/quotes/${qW.id}`)).status === 404, "quotes: the other company's are hidden");
    const jobs = (await json(await m("/api/jobs"))).jobs;
    ok(jobs.some(j => j.id === jP.id) && !jobs.some(j => j.id === jW.id), "jobs: their company's only");
    ok((await m(`/api/jobs/${jW.id}/parts`)).status === 404 && (await m(`/api/jobs/${jW.id}/time`, { method: "POST", body: JSON.stringify({ date: "2026-11-20", days: 1 }) })).status === 404, "…and inside the other's jobs");
    r = await m("/api/productions", { method: "POST", body: JSON.stringify({ name: "CL new show", type: "play" }) });
    const np = await json(r); made.newIds.prods.push(np.id);
    ok(r.status === 201 && np.entityId === made.P.id, "a new production lands in their company");
    const ents = await json(await m("/api/entities"));
    ok(ents.some(e => e.id === made.P.id) && !ents.some(e => e.id === made.W.id), "company pickers only offer their companies");
    const rows = (await json(await m("/api/dashboard/entities"))).rows;
    ok(rows.some(x => x.entityId === made.P.id) && !rows.some(x => x.entityId === made.W.id) && !rows.some(x => x.entityId === null), "Home companies table: their companies only, no 'No entity' row");

    // Lists across productions follow each production's company
    await db.haulageMovement.create({ data: { productionId: pW.id, haulageCompany: "CL Haul", fromLocation: "Stoke", toLocation: "Leeds", departureAt: new Date() } });
    await db.haulageMovement.create({ data: { productionId: pP.id, haulageCompany: "CL Haul P", fromLocation: "London", toLocation: "Bath", departureAt: new Date() } });
    await db.staffAssignment.create({ data: { userId: member.id, productionId: pW.id, startDate: new Date(), endDate: new Date() } });
    await db.task.create({ data: { title: "CL TWS task", productionId: pW.id, assigneeUserId: member.id } });
    await db.task.create({ data: { title: "CL my own to-do", assigneeUserId: member.id } });
    const haul = JSON.stringify(await json(await m("/api/haulage")));
    ok(haul.includes("CL Haul P") && !haul.includes("\"CL Haul\""), "haulage: their company's shows only");
    ok(!(await json(await m("/api/staff-assignments"))).some(x => x.productionId === pW.id), "staff bookings: not on the other company's shows");
    const tasks = JSON.stringify(await json(await m(`/api/tasks?assigneeId=${member.id}`)));
    ok(!tasks.includes("CL TWS task") && tasks.includes("CL my own to-do"), "tasks: not on the other company's shows; their own to-dos stay");

    ok((await json(await a("/api/productions"))).some(p => p.id === pW.id), "admins still see everything");
    await limit(undefined);
    ok((await json(await m("/api/productions"))).some(p => p.id === pW.id), "back to All companies: everything again");
  } finally {
    await db.user.update({ where: { id: member.id }, data: { permissions: before.permissions } }).catch(() => {});
    for (const id of made.newIds.deals) await db.opportunity.delete({ where: { id } }).catch(() => {});
    for (const id of made.newIds.prods) await db.production.delete({ where: { id } }).catch(() => {});
    for (const x of made.jobs) await db.job.delete({ where: { id: x.id } }).catch(() => {});
    for (const x of made.quotes) await db.quote.delete({ where: { id: x.id } }).catch(() => {});
    for (const x of made.deals) await db.opportunity.delete({ where: { id: x.id } }).catch(() => {});
    await db.task.deleteMany({ where: { title: { startsWith: "CL " } } }).catch(() => {});
    for (const x of made.prods) await db.production.delete({ where: { id: x.id } }).catch(() => {});
    for (const e of [made.P, made.W]) if (e) await db.entity.delete({ where: { id: e.id } }).catch(() => {});
  }
});
