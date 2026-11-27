import { run, BASE } from "./lib.mjs";

// PSG Rentals & Crew, stage 3: the warehouse. Scanning units out on a hire (cases bring what's
// packed in them), checking them back in, damage and missing kit, sub-hires covering shortages.
export default () => run("rentals-warehouse", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member] = users;
  const m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const send = (who, url, method, body) => who(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const made = [];
  try {
    // ── The rules ────────────────────────────────────────────────────────────
    const L = await import("../lib/rentals.ts");
    const p = L.prepProgress([{ productId: 1, quantity: 4 }], [{ productId: 1, quantity: 1 }], [{ productId: 1, back: false }, { productId: 1, back: true }, { productId: 9, back: false }]);
    ok(p.rows[0].fromUs === 3 && p.rows[0].toScan === 1 && p.extra[0].productId === 9 && p.outNow === 2, "prep: sub-hired kit isn't ours to scan; cases and their contents count as extra");
    ok(JSON.stringify(L.ourShare([{ productId: 1, quantity: 4 }, { productId: 1, quantity: 2 }], [{ productId: 1, quantity: 5 }])) === '[{"productId":1,"quantity":1}]', "what our kit covers is the hire less its sub-hires");

    // ── Set-up ───────────────────────────────────────────────────────────────
    const e = await db.entity.create({ data: { name: "Rentals warehouse co", shortName: "RW", slug: "rentals-wh", hasSpace: true, spaceKind: "rentals" } });
    made.push(e.id);
    const other = await db.entity.create({ data: { name: "Rentals other wh co", slug: "rentals-wh2", hasSpace: true, spaceKind: "rentals" } });
    made.push(other.id);
    const S = "/api/spaces/rentals-wh/rentals";
    const mega = await json(await send(m, `${S}/products`, "POST", { name: "MegaPointe", dayRate: 85, replacementCost: 9000, barcodes: "WH1\nWH2\nWH3\nWH4" }));
    const caseP = await json(await send(m, `${S}/products`, "POST", { name: "Mover case", isCase: true, barcodes: "WHCASE" }));
    const cable = await json(await send(m, `${S}/products`, "POST", { name: "Cable", barcodes: "WHC1" }));
    const u = Object.fromEntries(mega.units.map(x => [x.barcode, x]));
    await send(m, `/api/rentals/units/${u.WH4.id}`, "PATCH", { case: "WHCASE" });
    const gala = await json(await send(m, `${S}/hires`, "POST", { title: "Gala", clientName: "Lowry", outDate: "2027-05-01", returnDate: "2027-05-03", lines: [{ productId: mega.id, quantity: 3 }] }));
    const scan = (hire, barcode, mode = "out", who = m) => send(who, `/api/rentals/hires/${hire}/scan`, "POST", { barcode, mode });

    // ── Scanning out ─────────────────────────────────────────────────────────
    ok((await scan(gala.id, "WH1")).status === 400, "a quote can't be prepped until it's confirmed");
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "confirmed" });
    ok((await scan(gala.id, "WH1", "out", f)).status === 403, "a freelancer can't scan kit out");
    ok((await scan(gala.id, "NOPE")).status === 404, "an unknown barcode says so");
    let r = await scan(gala.id, "WHC1");
    ok(r.status === 409 && /isn't on this hire/.test((await json(r)).error), "kit that isn't on the hire is refused");
    r = await scan(gala.id, " wh1\n");
    let j = await json(r);
    ok(r.status === 200 && j.view.progress.rows[0].scanned === 1, "a MegaPointe scanned out (barcode tidied)");
    ok((await db.rentalHire.findUnique({ where: { id: gala.id } })).status === "out", "the first scan sends the hire out");
    ok((await scan(gala.id, "WH1")).status === 409, "the same unit can't be scanned twice");
    r = await scan(gala.id, "WHCASE");
    j = await json(r);
    ok(r.status === 200 && j.barcodes.join() === "WHCASE,WH4" && j.view.progress.rows[0].scanned === 2 && j.view.progress.extra[0]?.productId === caseP.id, "scanning a case scans what's packed in it; the case rides along as extra");
    await send(m, `/api/rentals/units/${u.WH3.id}`, "PATCH", { status: "repair" });
    r = await scan(gala.id, "WH3");
    ok(r.status === 409 && /in repair/.test((await json(r)).error), "a unit in repair can't go out");
    await send(m, `/api/rentals/units/${u.WH3.id}`, "PATCH", { status: "available" });
    r = await scan(gala.id, "WH2");
    j = await json(r);
    ok(r.status === 200 && j.view.progress.ready === true, "all three scanned: the hire is ready");
    ok((await scan(gala.id, "WH3")).status === 409, "nothing beyond what the hire needs");
    r = await send(m, `/api/rentals/hires/${gala.id}/scan`, "DELETE", { unitId: u.WH2.id });
    ok(r.status === 200 && (await json(r)).view.progress.toScan === 1, "a unit scanned by mistake is taken off again");
    await scan(gala.id, "WH2");
    const prod = await json(await m(`/api/rentals/products/${mega.id}`));
    ok(prod.units.find(x => x.barcode === "WH1").hireUnits[0]?.hire.number === gala.number, "Kit shows which hire a unit is out on");

    // ── Sub-hires and shortages ──────────────────────────────────────────────
    const show = await json(await send(m, `${S}/hires`, "POST", { title: "Show", outDate: "2027-05-02", returnDate: "2027-05-04", lines: [{ productId: mega.id, quantity: 3 }] }));
    ok(show.shortages[0]?.short === 2, "a clashing hire is 2 short (4 owned, 3 held by the gala)");
    ok((await send(m, `/api/rentals/hires/${show.id}/subhires`, "POST", { productId: mega.id, quantity: 0 })).status === 400, "a sub-hire needs a quantity");
    const theirs = await db.rentalProduct.create({ data: { entityId: other.id, name: "Not ours" } });
    ok((await send(m, `/api/rentals/hires/${show.id}/subhires`, "POST", { productId: theirs.id })).status === 400, "a sub-hire stands in for this company's kit only");
    r = await send(m, `/api/rentals/hires/${show.id}/subhires`, "POST", { productId: mega.id, quantity: 2, supplierName: "White Light", cost: 300 });
    const sub = await json(r);
    ok(r.status === 201 && sub.description === "MegaPointe" && sub.status === "needed", "two MegaPointes sub-hired from White Light");
    ok((await json(await m(`/api/rentals/hires/${show.id}`))).shortages.length === 0, "the sub-hire covers the shortage");
    ok((await send(m, `/api/rentals/hires/${show.id}`, "PATCH", { status: "confirmed" })).status === 200, "so the hire confirms without overriding");
    const av = await json(await m(`${S}/availability?from=2027-05-02&to=2027-05-02`));
    ok(av.products.find(x => x.id === mega.id).free === 0, "availability counts only what our kit covers (3 + 1 held, none free)");
    ok((await send(m, `/api/rentals/subhires/${sub.id}`, "PATCH", { status: "lost" })).status === 400, "a sub-hire's status is needed, ordered, received or sent back");
    ok((await send(m, `/api/rentals/subhires/${sub.id}`, "PATCH", { status: "received" })).status === 200, "the sub-hire arrives");
    r = await scan(show.id, "WH1");
    ok(r.status === 409 && /still out on/.test((await json(r)).error), "a unit out on another hire can't be scanned out");
    r = await scan(show.id, "WH3");
    ok(r.status === 200 && (await json(r)).view.progress.ready, "the show only needs 1 of ours: ready after one scan");

    // ── Coming back ──────────────────────────────────────────────────────────
    ok((await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "returned" })).status === 409, "a hire can't be closed while units are still out");
    r = await send(m, `${S}/checkin`, "POST", { barcode: "WH1" });
    ok(r.status === 200 && /back in/.test((await json(r)).message), "quick check-in: a unit goes back on whichever hire it was out on");
    ok((await send(m, `${S}/checkin`, "POST", { barcode: "WH1" })).status === 409, "a unit that's already back says so");
    r = await scan(show.id, "WH2", "in");
    ok(r.status === 200 && /out on .*H-/.test((await json(r)).message), "checking in on the wrong hire still works, and says which hire it was on");
    let view = await json(await m(`/api/rentals/hires/${gala.id}/warehouse`));
    const hu4 = view.hire.units.find(x => x.unit.barcode === "WH4");
    ok((await send(m, `/api/rentals/hire-units/${hu4.id}`, "PATCH", { condition: "damaged" })).status === 400, "damage needs a note saying what's wrong");
    r = await send(m, `/api/rentals/hire-units/${hu4.id}`, "PATCH", { condition: "damaged", note: "Cracked lens", charge: 120 });
    ok(r.status === 200 && (await db.rentalUnit.findUnique({ where: { id: u.WH4.id } })).status === "repair", "a damaged unit goes into repair");
    ok((await db.rentalHireCharge.findFirst({ where: { hireId: gala.id } }))?.unitPrice === 120, "…with the damage charge added to the hire");
    r = await scan(gala.id, "WHCASE", "in");
    ok(r.status === 200 && (await db.rentalHire.findUnique({ where: { id: gala.id } })).status === "returned", "when everything's back, the hire is marked returned");
    view = await json(await m(`/api/rentals/hires/${show.id}/warehouse`));
    const hu3 = view.hire.units.find(x => x.unit.barcode === "WH3");
    r = await send(m, `/api/rentals/hire-units/${hu3.id}`, "PATCH", { condition: "missing", note: "Not on the truck" });
    ok(r.status === 200 && (await db.rentalUnit.findUnique({ where: { id: u.WH3.id } })).status === "lost" && (await db.rentalHire.findUnique({ where: { id: show.id } })).status === "returned", "a missing unit is marked lost, and the hire closes");
    r = await send(m, `/api/rentals/hire-units/${hu3.id}`, "PATCH", { condition: "ok" });
    ok(r.status === 200 && (await db.rentalUnit.findUnique({ where: { id: u.WH3.id } })).status === "available", "it turned up: back in service");
    ok((await send(m, `/api/rentals/units/${u.WH1.id}`, "DELETE")).status === 400, "a unit that's been out on hires can't be deleted");
    ok((await json(await send(m, `/api/rentals/products/${caseP.id}`, "DELETE"))).archived === true, "a case that's been out is archived, not deleted");
    const wl = await json(await m(`${S}/warehouse`));
    ok(Array.isArray(wl.hires) && !wl.hires.some(h => h.id === gala.id), "the warehouse list leaves out returned hires");
    const head = await fetch(`${BASE}/login`);
    ok(/camera=\(self\)/.test(head.headers.get("permissions-policy") ?? ""), "the Hub's own pages may use the camera (for scanning)");
  } finally {
    for (const id of made) {
      await db.rentalHire.deleteMany({ where: { entityId: id } });
      await db.entity.delete({ where: { id } }).catch(() => {});
    }
  }
});
