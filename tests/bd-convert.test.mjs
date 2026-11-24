import { run } from "./lib.mjs";

// BD part 2: a won deal becomes a production with its client, entity, team and PM fee stages;
// the fee is PSG staff only.
export default () => run("bd-convert", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), f = await login(free.email), c = await login(client.email);
  const json = r => r.json();
  let entity, bdClient, deal, lead, productionId;
  try {
    entity = await db.entity.create({ data: { name: "Convert Test Entity" } });
    bdClient = await db.client.create({ data: { name: "Convert Test Client", type: "promoter" } });
    deal = await db.opportunity.create({ data: { title: "Convert test deal", type: "production", stage: "won", value: 45000, entityId: entity.id, clientId: bdClient.id, ownerUserId: member.id } });
    lead = await db.opportunity.create({ data: { title: "Convert test lead", type: "production", stage: "lead" } });
    const stages = [
      { label: "Deposit", amount: 13500, dueDate: "2027-01-10" },
      { label: "Fit-up", amount: 18000, dueDate: "2027-03-01" },
      { label: "Opening", amount: 13500, dueDate: "2027-03-01" },
    ];
    const body = { name: "Convert test show", type: "Musical", startDate: "2027-03-01", pmFee: "45000", stages };

    ok((await f(`/api/opportunities/${deal.id}/convert`, { method: "POST", body: JSON.stringify(body) })).status === 403, "freelancer can't convert a deal");
    ok((await a(`/api/opportunities/${lead.id}/convert`, { method: "POST", body: JSON.stringify(body) })).status === 400, "only a won deal can become a production");
    ok((await a(`/api/opportunities/${deal.id}/convert`, { method: "POST", body: JSON.stringify({ ...body, stages: [{ label: "", amount: 1 }] }) })).status === 400, "stage without a name refused");

    let r = await a(`/api/opportunities/${deal.id}/convert`, { method: "POST", body: JSON.stringify(body) });
    const p = await json(r); productionId = p.id;
    ok(r.status === 201 && p.name === "Convert test show", "won deal becomes a production");
    const prod = await db.production.findUnique({ where: { id: productionId }, include: { feeStages: { orderBy: { sortOrder: "asc" } }, team: true } });
    ok(prod.entityId === entity.id && prod.bdClientId === bdClient.id && prod.pmFee === 45000, "production takes the deal's entity, client and fee");
    ok(prod.feeStages.map(s => `${s.label}:${s.amount}`).join(",") === "Deposit:13500,Fit-up:18000,Opening:13500", "fee stages saved in order");
    ok(prod.team.some(t => t.userId === admin.id) && prod.team.some(t => t.userId === member.id), "creator and deal owner are on the team");
    const linked = await db.opportunity.findUnique({ where: { id: deal.id }, include: { activities: true } });
    ok(linked.productionId === productionId && linked.activities.some(x => x.text.includes("Convert test show")), "deal linked to the production and the step logged");
    ok((await a(`/api/opportunities/${deal.id}/convert`, { method: "POST", body: JSON.stringify(body) })).status === 409, "a deal can't become two productions");

    // The fee: staff only
    r = await a(`/api/productions/${productionId}/fee`);
    const fee = await json(r);
    ok(r.status === 200 && fee.pmFee === 45000 && fee.stages.length === 3 && fee.deal?.id === deal.id, "admin reads the fee, with its deal");
    ok((await f("/api/productions/1/fee")).status === 403, "freelancer on a show's team can't see its fee");
    ok((await c("/api/productions/1/fee")).status === 403, "client user can't see the fee");
    r = await a(`/api/productions/${productionId}/fee`, { method: "PUT", body: JSON.stringify({ pmFee: 50000, stages: [...stages.slice(0, 2), { label: "Opening", amount: 18500, dueDate: "2027-03-01", invoicedAt: "2027-02-20", paidAt: "2027-03-05" }] }) });
    const upd = await json(r);
    ok(r.status === 200 && upd.pmFee === 50000 && upd.stages[2].amount === 18500 && upd.stages[2].paidAt?.startsWith("2027-03-05"), "admin edits the fee and marks a stage paid");
    ok((await a(`/api/productions/${productionId}/fee`, { method: "PUT", body: JSON.stringify({ pmFee: "-5", stages: [] }) })).status === 400, "negative fee refused");

    // The budget page shows the panel to staff; BD shows the link to the production
    const bd = await (await a("/bd", { headers: { accept: "text/html" } })).text();
    ok(bd.includes("Convert test deal"), "/bd still lists the converted deal");
  } finally {
    if (productionId) await db.production.delete({ where: { id: productionId } }).catch(() => {});
    for (const o of [deal, lead]) if (o) await db.opportunity.delete({ where: { id: o.id } }).catch(() => {});
    if (bdClient) await db.client.delete({ where: { id: bdClient.id } }).catch(() => {});
    if (entity) await db.entity.delete({ where: { id: entity.id } }).catch(() => {});
  }
});
