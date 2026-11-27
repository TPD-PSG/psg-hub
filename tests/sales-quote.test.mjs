import { run } from "./lib.mjs";

// TWS sales-quote layout (27 Nov 2026): a quote keeps its sales-quote boxes (customer PO, payment
// terms, due date, shipping, ship to) and a company keeps its letterhead (address, phone).
export default () => run("sales-quote", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , member, admin] = users;
  let e = null, qid = null;
  try {
    e = await db.entity.create({ data: { name: "SQ test workshop", slug: "sq-test", hasSpace: true } });
    const a = await login(admin.email);
    let r = await a(`/api/entities/${e.id}`, { method: "PUT", body: JSON.stringify({ address: " Unit 2\nStoke ", phone: "01782 000000" }) });
    const en = await r.json();
    ok(r.status === 200 && en.address === "Unit 2\nStoke" && en.phone === "01782 000000", "an admin sets a company's letterhead address and phone");
    const m = await login(member.email);
    ok((await m(`/api/entities/${e.id}`, { method: "PUT", body: JSON.stringify({ phone: "x" }) })).status === 403, "only admins change it");

    r = await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "SQ test quote", entityId: e.id }) });
    const q = await r.json(); qid = q.id;
    r = await a(`/api/quotes/${qid}`, { method: "PUT", body: JSON.stringify({ customerPo: "PO-1", paymentTerms: "50 / 30 / 20", dueDate: "2099-12-08", shippingMethod: "Client collection", shipTo: "New Vic", lines: [{ section: "Coffin", description: "Refit", quantity: 1, unit: "each", unitCost: 1, unitPrice: 1440 }] }) });
    const saved = await r.json();
    ok(r.status === 200 && saved.customerPo === "PO-1" && saved.paymentTerms === "50 / 30 / 20" && saved.dueDate?.startsWith("2099-12-08") && saved.shippingMethod === "Client collection" && saved.shipTo === "New Vic", "a quote keeps its sales-quote boxes");
    ok(saved.entity?.address === "Unit 2\nStoke" && saved.entity?.phone === "01782 000000", "the quote comes with its company's letterhead for the PDF");
    r = await a(`/api/quotes/${qid}`, { method: "PUT", body: JSON.stringify({ dueDate: "nonsense", customerPo: "" }) });
    const cleared = await r.json();
    ok(cleared.dueDate === null && cleared.customerPo === null && cleared.lines.length === 1, "a bad date or a blank box clears it, and leaves the lines alone");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    if (qid) await db.quote.delete({ where: { id: qid } }).catch(() => {});
    if (e) await db.entity.delete({ where: { id: e.id } }).catch(() => {});
  }
});
