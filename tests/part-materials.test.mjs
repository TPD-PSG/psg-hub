import { run } from "./lib.mjs";

// Materials on the parts of a build, before pricing; "Quote this build" prices each part's labour
// and materials, grouped by part (or Labour / Materials), and doesn't add POs/stock on top.
export default () => run("part-materials", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), f = await login(free.email);
  const json = r => r.json();
  const made = { e: null, job: null, quotes: [] };
  try {
    made.e = await db.entity.create({ data: { name: "PM test workshop", slug: "pm-test", hasSpace: true } });
    made.job = await db.job.create({ data: { number: "J-2099-997", title: "PM palace", jobType: "workshop", entityId: made.e.id, stage: "quote" } });
    const J = made.job.id;
    await db.user.update({ where: { id: member.id }, data: { costDayRate: 240 } });
    const flats = await db.buildPart.create({ data: { jobId: J, label: "Palace flats", days: 3, userId: member.id } });
    const paint = await db.buildPart.create({ data: { jobId: J, label: "Scenic paint", days: 2, userId: member.id } });
    const M = p => `/api/jobs/${J}/parts/${p}/materials`;
    const post = (p, body) => a(M(p), { method: "POST", body: JSON.stringify(body) });

    ok((await post(flats.id, { description: " " })).status === 400, "a material needs a description");
    ok((await post(flats.id, { description: "Ply", quantity: 0 })).status === 400, "quantity must be more than 0");
    ok((await f(M(flats.id), { method: "POST", body: JSON.stringify({ description: "x" }) })).status === 403, "freelancers can't add materials");
    let part = await json(await post(flats.id, { section: "Sheet materials", description: "18mm ply", quantity: 12, unit: "sheets", unitCost: 31.5 }));
    part = await json(await post(flats.id, { section: "Timber", description: "Pine PSE 3x1", quantity: 40, unit: "m", unitCost: 1.85 }));
    ok(part.materials.length === 2 && part.materials[1].unit === "m" && part.materials[1].quantity === 40, "two materials on the flats, one in metres");
    const pine = part.materials[1];
    part = await json(await a(`${M(flats.id)}/${pine.id}`, { method: "PATCH", body: JSON.stringify({ quantity: 50 }) }));
    ok(part.materials.find(x => x.id === pine.id).quantity === 50, "a quantity can be changed");
    await post(paint.id, { section: "Paint & finishes", description: "Scenic black", quantity: 10, unit: "L", unitCost: 6 });
    const extra = await json(await post(paint.id, { description: "Mistake", quantity: 1, unitCost: 1 }));
    part = await json(await a(`${M(paint.id)}/${extra.materials.find(x => x.description === "Mistake").id}`, { method: "DELETE" }));
    ok(part.materials.length === 1, "a material can be removed");
    const parts = await json(await a(`/api/jobs/${J}/parts`));
    ok(parts.find(p => p.id === flats.id).materials.length === 2, "parts come with their materials");

    // A PO on the build shouldn't be counted again
    await db.purchaseOrder.create({ data: { number: "PO-2099-997", entityId: made.e.id, jobId: J, status: "ordered", supplierName: "Timber Co", lines: { create: [{ description: "Ply (ordered)", quantity: 12, unitCost: 31.5 }] } } });

    // Quote by part
    let d = await json(await a(`/api/jobs/${J}/quote`, { method: "POST", body: JSON.stringify({ markupPct: 25, group: "part" }) }));
    made.quotes.push(d.id);
    let q = await json(await a(`/api/quotes/${d.id}`));
    const sec = n => q.lines.filter(l => l.section === n);
    ok(sec("Palace flats").length === 3 && sec("Scenic paint").length === 2, "by part: each part is a section with its labour and materials");
    const lab = sec("Palace flats").find(l => l.description.startsWith("Labour"));
    ok(lab?.quantity === 3 && lab.unitCost === 240 && lab.unitPrice === 300, "labour: 3 days at £240, +25%");
    const pl = q.lines.find(l => l.description === "Pine PSE 3x1");
    ok(pl?.quantity === 50 && pl.unitCost === 1.85 && pl.unitPrice === 2.31 && pl.unit === "m", "materials at cost + 25%, in metres");
    ok(!q.lines.some(l => l.description.includes("ordered")) && d.notes.some(n => n.includes("weren't added again")), "the PO isn't counted on top of the estimates");
    ok(Math.abs(q.totals.cost - (5 * 240 + 12 * 31.5 + 50 * 1.85 + 10 * 6)) < 0.01, "total cost = labour (5 days) + materials (£530.50)");

    // Labour / Materials
    d = await json(await a(`/api/jobs/${J}/quote`, { method: "POST", body: JSON.stringify({ markupPct: 25, group: "type" }) }));
    made.quotes.push(d.id);
    q = await json(await a(`/api/quotes/${d.id}`));
    ok(q.lines.filter(l => l.section === "Labour").length === 2 && q.lines.some(l => l.section === "Timber") && q.lines.some(l => l.section === "Paint & finishes"), "Labour / Materials: labour together, materials by their section");
  } finally {
    await db.user.update({ where: { id: member.id }, data: { costDayRate: null } }).catch(() => {});
    for (const id of made.quotes) if (id) await db.quote.delete({ where: { id } }).catch(() => {});
    await db.purchaseOrder.deleteMany({ where: { number: "PO-2099-997" } }).catch(() => {});
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
