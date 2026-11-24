import { run } from "./lib.mjs";

// Cross-entity dashboard: one row per company for PSG staff, each part limited to what the viewer
// may see; productions take a company from the edit form.
export default () => run("entity-overview", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email), c = await login(client.email);
  const json = r => r.json();
  let entity, prod, deal, variation;
  const soon = new Date(Date.now() + 3 * 86400e3);
  try {
    entity = await db.entity.create({ data: { name: "Overview Test Co" } });
    prod = await db.production.create({ data: { name: "Overview test show", type: "Other", startDate: soon, pmFee: 1000,
      feeStages: { create: [{ label: "Deposit", amount: 1000, dueDate: new Date() }] } } });
    deal = await db.opportunity.create({ data: { title: "Overview test deal", type: "production", stage: "negotiating", value: 10000, entityId: entity.id, followUpDate: new Date(Date.now() + 86400e3) } });

    // The production form sets the company; leaving it out of an update keeps it
    const base = { name: prod.name, type: "Other", status: "planning", startDate: soon.toISOString().slice(0, 10) };
    let r = await a(`/api/productions/${prod.id}`, { method: "PUT", body: JSON.stringify({ ...base, entityId: String(entity.id) }) });
    ok(r.status === 200 && (await json(r)).entityId === entity.id, "production edit sets its company");
    r = await a(`/api/productions/${prod.id}`, { method: "PUT", body: JSON.stringify(base) });
    ok((await json(r)).entityId === entity.id, "an update without the field keeps the company");
    variation = await db.budgetVariation.create({ data: { productionId: prod.id, type: "saving", status: "pending_approval", title: "Overview test variation" } });

    r = await a("/api/dashboard/entities");
    const body = await json(r);
    const row = body.rows?.find(x => x.entityId === entity.id);
    ok(r.status === 200 && row, "admin gets a row for the company");
    ok(row.live?.count === 1 && row.live.shows[0].name === "Overview test show", "live show listed");
    ok(row.pipeline?.open === 1 && row.pipeline.weighted === 7500, "pipeline: weighted at 75%");
    ok(row.dates?.some(d => d.label === "Opens" && d.production === "Overview test show"), "opening in the next 14 days");
    ok(row.waiting?.variations === 1 && row.waiting.feeStages === 1 && row.waiting.feeAmount === 1000, "waiting: variation to approve and fee stage to invoice");

    ok((await f("/api/dashboard/entities")).status === 403, "freelancer gets no company overview");
    ok((await c("/api/dashboard/entities")).status === 403, "client user gets no company overview");
    const mb = await json(await m("/api/dashboard/entities"));
    const mrow = mb.rows?.find(x => x.entityId === entity.id);
    ok(mb.see?.bd === false && mrow && mrow.pipeline === null, "member without BD: no pipeline");
    ok(mrow.live?.count === 0, "member only counts shows they're on");

    const home = await (await a("/", { headers: { accept: "text/html" } })).text();
    ok(home.includes("Companies") && home.includes("Overview Test Co"), "Home shows the company rows in the first HTML");
    const fhome = await (await f("/", { headers: { accept: "text/html" } })).text();
    ok(!fhome.includes("Overview Test Co"), "freelancer's Home has no company rows");
  } finally {
    if (variation) await db.budgetVariation.delete({ where: { id: variation.id } }).catch(() => {});
    if (deal) await db.opportunity.delete({ where: { id: deal.id } }).catch(() => {});
    if (prod) await db.production.delete({ where: { id: prod.id } }).catch(() => {});
    if (entity) await db.entity.delete({ where: { id: entity.id } }).catch(() => {});
  }
});
