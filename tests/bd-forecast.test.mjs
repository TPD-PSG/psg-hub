import { run } from "./lib.mjs";

// BD part 3: the Director revenue forecast (admins only) adds up fee stages and weighted deals
// by entity and month against the entity's target.
export default () => run("bd-forecast", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email);
  const Y = 2031; // a year nothing else uses
  let entity, prod, deal;
  try {
    entity = await db.entity.create({ data: { name: "Forecast Test Entity", targets: { create: { year: Y, amount: 100000 } } } });
    prod = await db.production.create({ data: { name: "Forecast test show", type: "Other", entityId: entity.id, pmFee: 30000, startDate: new Date(`${Y}-04-01`),
      feeStages: { create: [{ label: "Deposit", amount: 9000, dueDate: new Date(`${Y}-02-10`), paidAt: new Date(`${Y}-02-12`) }, { label: "Fit-up", amount: 21000, dueDate: new Date(`${Y}-04-01`) }] } } });
    deal = await db.opportunity.create({ data: { title: "Forecast test deal", type: "production", stage: "proposal", value: 40000, entityId: entity.id, closeDate: new Date(`${Y}-06-15`) } });

    ok((await m(`/api/bd/forecast?year=${Y}`)).status === 403, "member can't see the forecast");
    const r = await a(`/api/bd/forecast?year=${Y}`);
    const fc = await r.json();
    const row = fc.rows?.find(x => x.entityId === entity.id);
    ok(r.status === 200 && fc.year === Y && row, "admin gets the forecast for the year asked");
    ok(row.target === 100000, "entity target for the year");
    ok(row.confirmed[1] === 9000 && row.confirmed[3] === 21000 && row.totalConfirmed === 30000 && row.paid === 9000, "fee stages by month, paid tracked");
    ok(row.pipeline[5] === 20000 && row.totalPipeline === 20000, "proposal counts at 50% in its close month");
    ok(row.gap === 50000, "gap = target − confirmed − pipeline");
    const html = await (await a("/director", { headers: { accept: "text/html" } })).text();
    ok(html.includes("Revenue forecast"), "Director page shows the forecast");
  } finally {
    if (deal) await db.opportunity.delete({ where: { id: deal.id } }).catch(() => {});
    if (prod) await db.production.delete({ where: { id: prod.id } }).catch(() => {});
    if (entity) await db.entity.delete({ where: { id: entity.id } }).catch(() => {});
  }
});
