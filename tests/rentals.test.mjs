import { run } from "./lib.mjs";

// PSG Rentals & Crew, stage 1 (replacing Flex): serialised kit with barcodes, cases, packages,
// hires that hold kit for their dates, and availability day by day.
export default () => run("rentals", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const send = (who, url, method, body) => who(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const made = { rentals: null, workshop: null };
  try {
    // ── The rules, on their own ──────────────────────────────────────────────
    const L = await import("../lib/rentals.ts");
    ok(L.nextBarcodes("rc", ["RC000001", "RC000002", "RC000007", "XX1"], 2).join(",") === "RC000008,RC000009", "new barcodes carry on from the highest used");
    ok(L.cleanBarcode("  rc 0001\n") === "RC0001", "scanned barcodes are tidied (spaces, newline, case)");
    ok(L.hireDays("2026-12-01", "2026-12-03") === 3, "a hire counts the day out and the day back");
    ok(L.overlaps("2026-12-01", "2026-12-03", "2026-12-03", "2026-12-05") && !L.overlaps("2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"), "going out the day another comes back is a clash; the day after isn't");
    const owned = new Map([[1, 4]]);
    const hs = [
      { id: 10, status: "confirmed", outDate: "2026-12-01", returnDate: "2026-12-03", lines: [{ productId: 1, quantity: 3 }] },
      { id: 11, status: "quote", outDate: "2026-12-02", returnDate: "2026-12-02", lines: [{ productId: 1, quantity: 2 }] },
      { id: 12, status: "cancelled", outDate: "2026-12-01", returnDate: "2026-12-05", lines: [{ productId: 1, quantity: 4 }] },
    ];
    const av = L.availability(owned, hs, "2026-12-01", "2026-12-04").get(1);
    ok(av.free === 1 && av.byDay[3].free === 4 && av.byDay[1].pencilled === 2, "confirmed hires hold kit, quotes are only pencilled, cancelled hold nothing");
    ok(L.shortages({ outDate: "2026-12-02", returnDate: "2026-12-02", lines: [{ productId: 1, quantity: 2 }] }, owned, hs)[0]?.short === 1, "a hire wanting 2 when 1 is free is short by 1");
    ok(L.shortages({ id: 10, outDate: "2026-12-01", returnDate: "2026-12-03", lines: [{ productId: 1, quantity: 3 }] }, owned, hs).length === 0, "a hire isn't short against itself");
    ok(L.nextHireNumber(2026, ["H-2026-004", "H-2025-010"]) === "H-2026-005", "hire numbers run per year");
    ok(L.groupByCategory([{ name: "b", category: null }, { name: "x", category: "Zips" }, { name: "c", category: "Cable" }, { name: "l", category: "Lighting" }]).map(g => g.category).join("|") === "Lighting|Cable|Zips|Other", "categories sort: usual order, the team's own, then Other");

    // ── A rentals space, and a workshop one that doesn't hold kit ────────────
    made.rentals = await db.entity.create({ data: { name: "Rentals test co", shortName: "RT", slug: "rentals-test", hasSpace: true, spaceKind: "rentals" } });
    made.workshop = await db.entity.create({ data: { name: "Rentals workshop co", slug: "rentals-wk", hasSpace: true } });
    const S = "/api/spaces/rentals-test/rentals";
    ok((await m("/api/spaces/rentals-wk/rentals")).status === 404, "a workshop space has no rental kit");
    ok((await f(S)).status === 403, "a freelancer can't see the rental kit");
    ok((await send(m, `/api/entities/${made.workshop.id}`, "PUT", { spaceKind: "rentals" })).status === 403, "only admins set a space's kind");
    ok((await send(a, `/api/entities/${made.workshop.id}`, "PUT", { spaceKind: "shop" })).status === 400, "a space is a workshop or a rentals space");

    // ── Kit ──────────────────────────────────────────────────────────────────
    ok((await send(m, `${S}/products`, "POST", { name: "" })).status === 400, "a product needs a name");
    let r = await send(m, `${S}/products`, "POST", { name: "Robe MegaPointe", category: "lighting", dayRate: 85, count: 4 });
    const mega = await json(r);
    ok(r.status === 201 && mega.units.length === 4 && mega.category === "Lighting", "a product added with 4 units (category matched to Lighting)");
    ok(mega.units.every(u => /^RT\d{6}$/.test(u.barcode)), `each unit gets its own barcode (${mega.units[0]?.barcode})`);
    r = await send(m, `${S}/products`, "POST", { name: "16A 10m cable", category: "Cable", barcodes: "flex-001\nFLEX-002\n" });
    const cable = await json(r);
    ok(r.status === 201 && cable.units.map(u => u.barcode).join() === "FLEX-001,FLEX-002", "cables are serialised too, keeping the barcodes already on them");
    ok((await send(m, `${S}/products`, "POST", { name: "Dup", barcodes: "FLEX-001" })).status === 409, "a barcode can't be on two units");
    ok((await send(m, `${S}/products`, "POST", { name: "Bad", barcodes: "a b<c>" })).status === 400, "a barcode with odd characters is refused");
    ok((await send(m, `/api/rentals/products/${mega.id}/units`, "POST", { count: 2 })).status === 201, "two more MegaPointes added");
    ok((await send(m, `/api/rentals/products/${mega.id}`, "PATCH", { dayRate: -5 })).status === 400, "a day rate can't be negative");
    let detail = await json(await m(`/api/rentals/products/${mega.id}`));
    ok(detail.units.length === 6, "the product now has 6 units");
    const [u1] = detail.units;
    ok((await send(m, `/api/rentals/units/${u1.id}`, "PATCH", { status: "repair" })).status === 200, "a unit goes into repair");
    let list = await json(await m(S));
    ok(list.products.find(p => p.id === mega.id)?.units.available === 5, "a unit in repair doesn't count as ready (5 of 6)");
    r = await m(`${S}/scan?barcode=${encodeURIComponent(" flex-002 ")}`);
    ok(r.status === 200 && (await json(r)).product.id === cable.id, "scanning a barcode finds its unit");
    ok((await m(`${S}/scan?barcode=NOPE999`)).status === 404, "an unknown barcode says so");

    // Cases
    r = await send(m, `${S}/products`, "POST", { name: "Mega 2-way case", category: "Cases", isCase: true, count: 1 });
    const caseP = await json(r);
    const caseCode = caseP.units[0].barcode;
    ok((await send(m, `/api/rentals/units/${detail.units[1].id}`, "PATCH", { case: cable.units[0].barcode })).status === 400, "a unit can only be packed into a case");
    ok((await send(m, `/api/rentals/units/${detail.units[1].id}`, "PATCH", { case: caseCode })).status === 200, "a MegaPointe packed in its case by the case's barcode");
    ok((await send(m, `/api/rentals/units/${caseP.units[0].id}`, "PATCH", { case: caseCode })).status === 400, "a case can't go inside itself");
    const c2 = await json(await send(m, `/api/rentals/products/${caseP.id}/units`, "POST", { count: 1 }));
    await send(m, `/api/rentals/units/${c2.units[0].id}`, "PATCH", { case: caseCode });
    ok((await send(m, `/api/rentals/units/${caseP.units[0].id}`, "PATCH", { case: c2.units[0].barcode })).status === 400, "no loops: a case can't go inside one packed in it");
    ok((await send(m, `/api/rentals/products/${caseP.id}`, "PATCH", { isCase: false })).status === 400, "a product stays a case while units are packed in it");
    const caseD = await json(await m(`/api/rentals/products/${caseP.id}`));
    ok(caseD.units.find(u => u.barcode === caseCode)?.contents.length === 2, "the case lists what's packed in it");

    // Packages
    ok((await send(m, `${S}/packages`, "POST", { name: "Empty", items: [] })).status === 400, "a package needs a product");
    r = await send(m, `${S}/packages`, "POST", { name: "Mover pair", items: [{ productId: mega.id, quantity: 1 }, { productId: mega.id, quantity: 1 }, { productId: cable.id, quantity: 2 }] });
    const pkg = await json(r);
    ok(r.status === 201 && pkg.items.find(i => i.productId === mega.id)?.quantity === 2, "a package adds the same product twice up as one line");
    const otherCo = await db.rentalProduct.create({ data: { entityId: made.workshop.id, name: "Not ours" } });
    ok((await send(m, `/api/rentals/packages/${pkg.id}`, "PATCH", { items: [{ productId: otherCo.id, quantity: 1 }] })).status === 400, "a package only takes this company's kit");

    // ── Hires and availability ───────────────────────────────────────────────
    const H = `${S}/hires`;
    ok((await send(m, H, "POST", { title: "Gala", outDate: "2027-03-05", returnDate: "2027-03-01" })).status === 400, "kit can't come back before it goes out");
    r = await send(m, H, "POST", { title: "Gala", clientName: "Lowry", outDate: "2027-03-01", returnDate: "2027-03-03", lines: [{ productId: mega.id, quantity: 4 }] });
    const gala = await json(r);
    ok(r.status === 201 && gala.status === "quote" && /^H-2027-\d{3}$/.test(gala.number) && gala.lines[0].dayRate === 85, `a new hire is a quote, numbered ${gala.number}, with the product's day rate`);
    let avr = await json(await m(`${S}/availability?from=2027-03-01&to=2027-03-04`));
    let row = avr.products.find(p => p.id === mega.id);
    ok(row.owned === 5 && row.free === 5 && row.pencilled === 4, "a quote is pencilled on availability and holds nothing");
    r = await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "confirmed" });
    ok(r.status === 200 && (await json(r)).status === "confirmed", "confirming with enough kit free");
    avr = await json(await m(`${S}/availability?from=2027-03-01&to=2027-03-04`));
    row = avr.products.find(p => p.id === mega.id);
    ok(row.free === 1 && row.byDay[3].free === 5, "the confirmed hire holds 4 for its dates (1 free), all 5 free the day after");
    r = await send(m, H, "POST", { title: "Concert", outDate: "2027-03-03", returnDate: "2027-03-04", lines: [{ productId: mega.id, quantity: 3 }] });
    const concert = await json(r);
    ok(concert.shortages[0]?.short === 2, "a quote that clashes shows it's 2 short");
    r = await send(m, `/api/rentals/hires/${concert.id}`, "PATCH", { status: "confirmed" });
    ok(r.status === 409 && (await json(r)).shortages[0].free === 1, "confirming a hire that's short is stopped, saying what's free");
    r = await send(m, `/api/rentals/hires/${concert.id}`, "PATCH", { status: "confirmed", allowShort: true });
    ok(r.status === 200, "…unless they'll sub-hire the rest");
    avr = await json(await m(`${S}/availability?from=2027-03-03&to=2027-03-03`));
    ok(avr.products.find(p => p.id === mega.id).free === -2, "availability shows the day as 2 short");
    r = await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { returnDate: "2027-03-02" });
    ok(r.status === 200, "bringing the gala back a day early frees up its kit for the concert");
    avr = await json(await m(`${S}/availability?from=2027-03-03&to=2027-03-03`));
    ok(avr.products.find(p => p.id === mega.id).free === 2, "now 2 are free on the concert's first day");
    r = await send(m, `/api/rentals/hires/${concert.id}`, "PATCH", { lines: [{ productId: mega.id, quantity: 9 }] });
    ok(r.status === 409, "adding more kit to a confirmed hire is checked too");
    ok((await send(m, `/api/rentals/hires/${concert.id}`, "PATCH", { lines: [{ productId: otherCo.id, quantity: 1 }] })).status === 400, "a hire only takes this company's kit");
    ok((await send(m, `/api/rentals/hires/${gala.id}`, "DELETE")).status === 400, "a confirmed hire can't be deleted, only cancelled");
    ok((await send(f, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "cancelled" })).status === 403, "a freelancer can't change a hire");
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "out" });
    ok((await json(await m(`/api/rentals/hires/${gala.id}`))).status === "out", "the gala goes out");
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "returned" });
    ok((await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { lines: [] })).status === 400, "a returned hire's kit can't be changed");
    await send(m, `/api/rentals/hires/${concert.id}`, "PATCH", { status: "cancelled" });
    ok((await send(m, `/api/rentals/hires/${concert.id}`, "DELETE")).status === 200, "a cancelled hire can be deleted");
    list = await json(await m(S));
    ok(list.hires.some(h => h.id === gala.id && h.items === 4), "the hire list carries how many items each hire has");

    // A product that's been on a hire is archived, not deleted
    r = await send(m, `/api/rentals/products/${mega.id}`, "DELETE");
    ok((await json(r)).archived === true, "deleting a product that's been hired archives it instead");
    r = await send(m, `/api/rentals/products/${cable.id}`, "DELETE");
    ok((await json(r)).deleted === true, "a product never hired is deleted");
    ok((await db.rentalUnit.count({ where: { productId: cable.id } })) === 0, "…with its units");
  } finally {
    for (const e of [made.rentals, made.workshop]) if (e) {
      await db.rentalHire.deleteMany({ where: { entityId: e.id } });
      await db.entity.delete({ where: { id: e.id } }).catch(() => {});
    }
  }
});
