import { run } from "./lib.mjs";

// Quotes: PSG staff with BD access only; start from a deal or a template; lines with cost and
// price give totals and margin; status stamps; save as template.
export default () => run("quotes", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  let entity, client, deal; const quoteIds = []; let templateId;
  try {
    entity = await db.entity.create({ data: { name: "Quote Test Co" } });
    client = await db.client.create({ data: { name: "Quote Test Client", type: "promoter" } });
    deal = await db.opportunity.create({ data: { title: "Quote test deal", type: "production", stage: "proposal", clientId: client.id, entityId: entity.id } });

    ok((await f("/api/quotes")).status === 403, "freelancer can't see quotes");
    ok((await m("/api/quotes", { method: "POST", body: JSON.stringify({ title: "x" }) })).status === 403, "member without BD access can't create quotes");

    let r = await a("/api/quotes", { method: "POST", body: JSON.stringify({ opportunityId: deal.id }) });
    const q = await json(r); quoteIds.push(q.id);
    ok(r.status === 201 && /^Q-\d{4}-\d{3}$/.test(q.number), `quote numbered (${q.number})`);
    ok(q.title === "Quote test deal" && q.client?.id === client.id && q.entity?.id === entity.id && q.opportunity?.id === deal.id, "quote from a deal takes its title, client and company");

    const lines = [
      { section: "Pre-production", description: "PM days", quantity: 10, unit: "days", unitCost: 300, unitPrice: 450 },
      { section: "Fit-up", description: "Drawings", quantity: "1", unitCost: "800", unitPrice: "1500" },
    ];
    r = await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ lines, vatRate: 20, terms: "30/40/30" }) });
    const u = await json(r);
    ok(u.lines.length === 2 && u.totals.net === 6000 && u.totals.cost === 3800 && u.totals.vat === 1200 && u.totals.margin === 2200, "totals: £6,000 net, £3,800 cost, £1,200 VAT, £2,200 margin");
    ok((await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ lines: [{ description: "" }] }) })).status === 400, "line without a description refused");
    r = await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ terms: "Changed" }) });
    ok((await json(r)).lines.length === 2, "updating the header leaves the lines alone");

    r = await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ status: "sent" }) });
    ok((await json(r)).sentAt, "marking sent stamps the date");
    r = await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ status: "accepted" }) });
    ok((await json(r)).decidedAt, "accepting stamps the decision date");

    r = await a("/api/quote-templates", { method: "POST", body: JSON.stringify({ quoteId: q.id, name: "Test PM template" }) });
    templateId = (await json(r)).id;
    ok(r.status === 201, "saved as a template");
    const tlist = await json(await a("/api/quote-templates"));
    ok(tlist.find(t => t.id === templateId)?.lineCount === 2, "template keeps the lines");
    r = await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "From template", templateId }) });
    const q2 = await json(r); quoteIds.push(q2.id);
    ok(q2.lines.length === 2 && q2.terms === "Changed" && q2.entity?.id === entity.id && q2.number !== q.number, "new quote from the template gets its lines, terms and company, and a new number");

    const deals = await json(await a(`/api/quotes?opportunityId=${deal.id}`));
    ok(deals.length === 1 && deals[0].id === q.id, "quotes listed by deal");
    const listPage = await (await a("/bd/quotes", { headers: { accept: "text/html" } })).text();
    ok(listPage.includes(q.number) && listPage.includes("Test PM template"), "quotes page lists quotes and templates in the first HTML");
    const ed = await (await a(`/bd/quotes/${q.id}`, { headers: { accept: "text/html" } })).text();
    ok(ed.includes(q.number) && ed.includes("PM days"), "quote editor arrives with its lines");
  } finally {
    for (const id of quoteIds) await db.quote.delete({ where: { id } }).catch(() => {});
    if (templateId) await db.quoteTemplate.delete({ where: { id: templateId } }).catch(() => {});
    if (deal) await db.opportunity.delete({ where: { id: deal.id } }).catch(() => {});
    if (client) await db.client.delete({ where: { id: client.id } }).catch(() => {});
    if (entity) await db.entity.delete({ where: { id: entity.id } }).catch(() => {});
  }
});
