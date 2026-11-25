import { run } from "./lib.mjs";

// Quote building (workshop feedback, 27 Nov 2026): stock and last-paid-price lookup, units that
// follow the section, and section subtotals on the PDF.
export default () => run("quote-builder", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), f = await login(free.email), m = await login(member.email);
  const json = r => r.json();
  const made = { e: null, other: null, quote: null };
  try {
    const { unitsFor, QUOTE_SECTIONS } = await import("../lib/quoteUnits.ts");
    ok(unitsFor("Timber").includes("m") && unitsFor("timber").includes("lengths") && !unitsFor("Timber").includes("hours"), "Timber offers metres and lengths, not hours");
    ok(unitsFor("Labour").includes("hours") && !unitsFor("Labour").includes("m"), "Labour offers hours and days");
    ok(unitsFor("Something new").includes("m") && unitsFor(null).includes("each"), "an unknown section gets the full list, metres included");
    const { STOCK_SECTIONS } = await import("../lib/stockSections.ts");
    ok(STOCK_SECTIONS.every(x => QUOTE_SECTIONS.includes(x)) && QUOTE_SECTIONS.includes("Labour"), "every stock section is offered as a quote section");

    made.e = await db.entity.create({ data: { name: "QB workshop", slug: "qb-test", hasSpace: true } });
    made.other = await db.entity.create({ data: { name: "QB other co", slug: "qb-other", hasSpace: true } });
    await db.stockItem.create({ data: { entityId: made.e.id, name: "QB Pine PSE 3x1 (69x21mm)", unit: "m", quantity: 120, unitCost: 1.85, section: "Timber" } });
    await db.stockItem.create({ data: { entityId: made.other.id, name: "QB Pine 3x1 other co", unit: "m", quantity: 5, unitCost: 2 } });
    const po = await db.purchaseOrder.create({ data: { number: "PO-2099-901", entityId: made.e.id, status: "delivered", supplierName: "QB Timber Ltd", lines: { create: [{ description: "QB Pine PSE 3x1 4.8m", quantity: 20, unit: "lengths", unitCost: 8.9 }] } } });
    const old = await db.purchaseOrder.create({ data: { number: "PO-2099-902", entityId: made.e.id, status: "delivered", supplierName: "QB Old", createdAt: new Date(Date.now() - 30 * 86400e3), lines: { create: [{ description: "QB Pine PSE 3x1 4.8m", quantity: 10, unit: "lengths", unitCost: 7.5 }] } } });

    let r = await a(`/api/quotes/lookup?q=${encodeURIComponent("3x1 pine")}&entityId=${made.e.id}`);
    let d = await json(r);
    ok(r.status === 200 && d.stock[0]?.name === "QB Pine PSE 3x1 (69x21mm)" && d.stock[0].quantity === 120 && d.stock[0].unitCost === 1.85 && d.stock[0].section === "Timber", "searching '3x1 pine' finds the stock item with level, cost and section (any word order)");
    const paid = d.recent.filter(x => x.description === "QB Pine PSE 3x1 4.8m");
    ok(paid.length === 1 && paid[0].unitCost === 8.9 && paid[0].supplier === "QB Timber Ltd", "last-paid price comes from the latest purchase order, once per item");
    ok((await json(await a("/api/quotes/lookup?q=p"))).stock.length === 0, "one letter isn't searched");
    ok((await f("/api/quotes/lookup?q=pine")).status === 403, "freelancers can't look up costs");

    // A member limited to one company only sees that company's stock and prices
    const before = await db.user.findUnique({ where: { id: member.id }, select: { permissions: true } });
    const perms = JSON.parse(before.permissions ?? "{}");
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ ...perms, modules: [...new Set([...(perms.modules ?? []), "bd"])], entityIds: [made.other.id] }) } });
    const m2 = await login(member.email);
    d = await json(await m2("/api/quotes/lookup?q=3x1"));
    ok(d.stock.length === 1 && d.stock[0].name === "QB Pine 3x1 other co" && d.recent.length === 0, "a company limit applies to the lookup");
    await db.user.update({ where: { id: member.id }, data: { permissions: before.permissions } });

    // Subtotals setting
    made.quote = await db.quote.create({ data: { number: "Q-2099-901", title: "QB quote", entityId: made.e.id } });
    r = await a(`/api/quotes/${made.quote.id}`, { method: "PUT", body: JSON.stringify({ showSubtotals: true, lines: [
      { section: "Timber", description: "Pine 3x1", quantity: 40, unit: "m", unitCost: 1.85, unitPrice: 2.4 },
      { section: "Labour", description: "Carpenter", quantity: 2, unit: "days", unitCost: 200, unitPrice: 280 },
    ] }) });
    const saved = await json(r);
    ok(r.status === 200 && saved.showSubtotals === true && saved.lines.length === 2 && saved.lines[0].unit === "m", "a quote saves 'show section subtotals' and lines in metres");
    await db.purchaseOrder.delete({ where: { id: po.id } }); await db.purchaseOrder.delete({ where: { id: old.id } });
  } finally {
    if (made.quote) await db.quote.delete({ where: { id: made.quote.id } }).catch(() => {});
    await db.purchaseOrder.deleteMany({ where: { number: { in: ["PO-2099-901", "PO-2099-902"] } } }).catch(() => {});
    for (const e of [made.e, made.other]) if (e) { await db.stockItem.deleteMany({ where: { entityId: e.id } }).catch(() => {}); await db.entity.delete({ where: { id: e.id } }).catch(() => {}); }
  }
});
