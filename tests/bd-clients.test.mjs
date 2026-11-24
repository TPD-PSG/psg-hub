import { run } from "./lib.mjs";

// BD part 4: target accounts with owners, partial client updates, and the client page's data
// (deals, productions, contacts; invoices only with finance access; PM fee only for staff).
export default () => run("bd-clients", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  let clientId, prod, inv, deal;
  try {
    let r = await a("/api/clients", { method: "POST", body: JSON.stringify({ name: "Client Page Test Ltd", type: "promoter", billingEmail: "accounts@example.test" }) });
    clientId = (await json(r)).id;
    ok(r.status === 201, "admin adds a client");
    ok((await a("/api/clients", { method: "POST", body: JSON.stringify({ name: "  " }) })).status === 400, "client without a name refused");

    r = await a(`/api/clients/${clientId}`, { method: "PUT", body: JSON.stringify({ targetAccount: true, targetOwnerId: String(admin.id), targetSource: "Ammonite" }) });
    const t = await json(r);
    ok(t.targetAccount === true && t.targetOwner?.id === admin.id && t.targetSource === "Ammonite", "made a target account with owner and source");
    ok(t.billingEmail === "accounts@example.test" && t.type === "promoter", "ticking target keeps the other details");
    const listed = (await json(await a("/api/clients"))).find(c => c.id === clientId);
    ok(listed?.targetOwner?.id === admin.id && Array.isArray(listed.opportunities), "client list includes target owner and deals");

    // Contacts
    ok((await f(`/api/clients/${clientId}/contacts`, { method: "POST", body: JSON.stringify({ name: "X" }) })).status === 403, "freelancer can't add contacts");
    ok((await a(`/api/clients/${clientId}/contacts`, { method: "POST", body: JSON.stringify({ name: "" }) })).status === 400, "contact needs a name");
    r = await a(`/api/clients/${clientId}/contacts`, { method: "POST", body: JSON.stringify({ name: "Pat Producer", role: "Producer" }) });
    const contact = await json(r);
    ok(r.status === 201, "admin adds a contact");

    // Detail: deals, productions, invoices
    deal = await db.opportunity.create({ data: { title: "Client page test deal", type: "production", stage: "proposal", value: 20000, clientId } });
    prod = await db.production.create({ data: { name: "Client page test show", type: "Other", bdClientId: clientId, pmFee: 30000 } });
    inv = await db.companyInvoice.create({ data: { type: "sales", party: "client page test ltd", description: "Deposit", netAmount: 1000, vatAmount: 200, status: "sent" } });
    const d = await json(await a(`/api/clients/${clientId}`));
    ok(d.contacts?.[0]?.name === "Pat Producer" && d.opportunities?.[0]?.title === "Client page test deal" && d.productions?.[0]?.pmFee === 30000, "admin sees contacts, deals and productions with PM fee");
    ok(d.invoices?.some(i => i.id === inv.id), "sales invoice matched by name (any case)");
    const md = await json(await m(`/api/clients/${clientId}`));
    ok(md.invoices === null && md.productions?.[0]?.pmFee === 30000, "member without finance: no invoices, but sees PM fee");
    const fd = await json(await f(`/api/clients/${clientId}`));
    ok(fd.invoices === null && fd.productions?.[0] && !("pmFee" in fd.productions[0]), "freelancer: no invoices, no PM fee");

    ok((await a(`/api/clients/${clientId}/contacts/${contact.id}`, { method: "DELETE" })).status === 200, "admin removes a contact");

    // Pages
    const page = await (await a(`/bd/clients/${clientId}`, { headers: { accept: "text/html" } })).text();
    ok(page.includes("Client Page Test Ltd") && page.includes("Target account") && page.includes("Client page test show"), "client page shows target status and productions in the first HTML");
    ok((await a("/bd/clients/999999", { headers: { accept: "text/html" } })).status === 404, "unknown client → 404");
    const bd = await (await a("/bd", { headers: { accept: "text/html" } })).text();
    ok(bd.includes(`/bd/clients/${clientId}`), "BD client list links to the client page");
  } finally {
    if (inv) await db.companyInvoice.delete({ where: { id: inv.id } }).catch(() => {});
    if (prod) await db.production.delete({ where: { id: prod.id } }).catch(() => {});
    if (deal) await db.opportunity.delete({ where: { id: deal.id } }).catch(() => {});
    if (clientId) await db.client.delete({ where: { id: clientId } }).catch(() => {});
  }
});
