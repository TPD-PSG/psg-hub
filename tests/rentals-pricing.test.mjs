import { run } from "./lib.mjs";

// PSG Rentals & Crew, stage 2: prices on hires (day and week rates, our own price, discounts,
// other charges, VAT), the quote fields, and raising the hire's invoice in Finance.
export default () => run("rentals-pricing", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member] = users;
  const m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const send = (who, url, method, body) => who(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  let entity = null;
  try {
    // ── The rules ────────────────────────────────────────────────────────────
    const L = await import("../lib/rentals.ts");
    ok(L.rateFor(3, 85, null) === 255, "3 days at £85 a day is £255");
    ok(L.rateFor(7, 85, 255) === 255 && L.rateFor(9, 85, 255) === 425 && L.rateFor(13, 85, 255) === 510, "a week costs the week rate; leftover days cost day rates, never more than another week");
    ok(L.linePrice({ quantity: 2, dayRate: 85, unitPrice: 100, discountPct: 10 }, 5).amount === 180, "our own price per unit replaces the rates, then the line's discount comes off");
    ok(L.chargedDays({ chargeDays: 2, outDate: "2027-01-01", returnDate: "2027-01-05" }) === 2 && L.chargedDays({ chargeDays: null, outDate: "2027-01-01", returnDate: "2027-01-05" }) === 5, "days charged: as set, else every day away");
    const t = L.hireTotals({ outDate: "2027-03-01", returnDate: "2027-03-03", discountPct: 10, vatRate: 20, lines: [{ quantity: 4, dayRate: 85 }, { quantity: 10, dayRate: 2, discountPct: 50 }], charges: [{ quantity: 1, unitPrice: 150 }] });
    ok(t.kit === 1050 && t.hireDiscount === 105 && t.net === 1095 && t.vat === 219 && t.gross === 1314, "totals: kit after line discounts, hire discount off the kit only, charges, then VAT");
    const iss = new Date("2027-01-10T00:00:00Z"), out = new Date("2027-02-01T00:00:00Z");
    ok(L.invoiceDue("30 days", iss, out).toISOString().startsWith("2027-02-09") && L.invoiceDue("In advance", iss, out).toISOString().startsWith("2027-02-01") && L.invoiceDue(null, iss, out).toISOString().startsWith("2027-02-09"),
      "invoice due: '30 days' after issue, 'In advance' by the day it goes out, else 30 days");

    // ── On a hire ────────────────────────────────────────────────────────────
    entity = await db.entity.create({ data: { name: "Rentals pricing co", shortName: "RP", slug: "rentals-price", hasSpace: true, spaceKind: "rentals" } });
    const S = "/api/spaces/rentals-price/rentals";
    const mega = await json(await send(m, `${S}/products`, "POST", { name: "MegaPointe", category: "Lighting", dayRate: 85, weekRate: 255, count: 6 }));
    const cable = await json(await send(m, `${S}/products`, "POST", { name: "Cable", category: "Cable", dayRate: 2, count: 20 }));
    ok((await send(m, `${S}/hires`, "POST", { title: "X", outDate: "2027-04-01", returnDate: "2027-04-02", discountPct: 150 })).status === 400, "a discount over 100% is refused");
    ok((await send(m, `${S}/hires`, "POST", { title: "X", outDate: "2027-04-01", returnDate: "2027-04-02", charges: [{ quantity: 1, unitPrice: 50 }] })).status === 400, "a charge needs a description");
    ok((await send(m, `${S}/hires`, "POST", { title: "X", outDate: "2027-04-01", returnDate: "2027-04-02", delivery: "drone" })).status === 400, "delivery is collection or delivery");
    ok((await send(m, `${S}/hires`, "POST", { title: "X", outDate: "2027-04-01", returnDate: "2027-04-02", lines: [{ productId: mega.id, quantity: 1, discountPct: 101 }] })).status === 400, "a line's discount is 0 to 100%");
    let r = await send(m, `${S}/hires`, "POST", {
      title: "Lowry gala", clientName: "The Lowry", clientEmail: "events@lowry.example", outDate: "2027-04-01", returnDate: "2027-04-09",
      chargeDays: 8, discountPct: 10, vatRate: 20, paymentTerms: "30 days", customerPo: "PO-778", delivery: "delivery", deliveryTo: "Pier 8, Salford", validUntil: "2027-03-15", terms: "Damage charged at replacement cost.",
      lines: [{ productId: mega.id, quantity: 4 }, { productId: cable.id, quantity: 10, unitPrice: 5 }],
      charges: [{ description: "Delivery and collection", quantity: 1, unitPrice: 180 }],
    });
    const gala = await json(r);
    ok(r.status === 201 && gala.lines[0].weekRate === 255 && gala.charges.length === 1 && gala.customerPo === "PO-778", "a hire keeps its pricing, quote fields and charges; lines copy the week rate too");
    // 8 days: MegaPointe = 255 + min(85, 255) = 340 each × 4 = 1360; cable £5 × 10 = 50; kit 1410; 10% off = 141; + 180 → 1449
    ok(gala.totals.days === 8 && gala.totals.kit === 1410 && gala.totals.hireDiscount === 141 && gala.totals.net === 1449 && gala.totals.gross === 1738.8, `the hire's totals come back with it (net £${gala.totals.net})`);
    let list = await json(await m(S));
    ok(list.hires.find(h => h.id === gala.id)?.net === 1449, "the hire list carries each hire's value");
    r = await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { quoteSent: true });
    ok(!!(await json(r)).quoteSentAt, "a quote is marked as sent");

    // Invoicing
    ok((await send(m, `/api/rentals/hires/${gala.id}/invoice`, "POST")).status === 400, "a quote can't be invoiced until it's confirmed");
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "confirmed" });
    ok((await send(f, `/api/rentals/hires/${gala.id}/invoice`, "POST")).status === 403, "a freelancer can't raise an invoice");
    r = await send(m, `/api/rentals/hires/${gala.id}/invoice`, "POST");
    let h = await json(r);
    let inv = h.invoice && await db.companyInvoice.findUnique({ where: { id: h.invoice.id } });
    ok(r.status === 201 && inv?.type === "sales" && inv.reference === gala.number && inv.party === "The Lowry" && inv.netAmount === 1449 && inv.vatAmount === 289.8 && inv.status === "draft", "raising the invoice puts a draft sales invoice in Finance for the hire's total");
    ok(inv && Math.round((inv.dueDate - inv.issueDate) / 86400000) === 30 && /PO-778/.test(inv.notes ?? ""), "it's due on the payment terms and notes the client's PO");
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { charges: [{ description: "Delivery and collection", quantity: 1, unitPrice: 180 }, { description: "Technician day", quantity: 1, unitPrice: 250 }] });
    r = await send(m, `/api/rentals/hires/${gala.id}/invoice`, "POST");
    inv = await db.companyInvoice.findUnique({ where: { id: h.invoice.id } });
    ok(r.status === 200 && inv.netAmount === 1699 && (await db.companyInvoice.count({ where: { reference: gala.number } })) === 1, "a draft invoice is brought up to date, not raised twice");
    await db.companyInvoice.update({ where: { id: inv.id }, data: { status: "sent" } });
    ok((await send(m, `/api/rentals/hires/${gala.id}/invoice`, "POST")).status === 409, "once the invoice has been sent, the hire leaves it alone");
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "cancelled" });
    ok((await send(m, `/api/rentals/hires/${gala.id}`, "DELETE")).status === 400, "a hire with an invoice can't be deleted");
    // After it's back: a damage charge can still be added to a returned hire, but not more kit
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "quote" });
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "confirmed" });
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "returned" });
    r = await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { charges: [{ description: "Damaged lens", quantity: 1, unitPrice: 320 }] });
    ok(r.status === 200 && (await json(r)).charges[0].description === "Damaged lens", "a damage charge goes on a returned hire");
  } finally {
    if (entity) {
      const hires = await db.rentalHire.findMany({ where: { entityId: entity.id }, select: { invoiceId: true } });
      await db.rentalHire.deleteMany({ where: { entityId: entity.id } });
      await db.companyInvoice.deleteMany({ where: { id: { in: hires.map(x => x.invoiceId).filter(Boolean) } } });
      await db.entity.delete({ where: { id: entity.id } }).catch(() => {});
    }
  }
});
