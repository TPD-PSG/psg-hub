import { run } from "./lib.mjs";

// "Quote this build": a quote attached to the job, drafted from its parts (labour at the person's
// day rate, else the standard workshop rate) and materials (POs, stock), at cost + markup.
// Accepting it sets the job's price and moves a build at Quote on to Confirmation.
export default () => run("build-quote", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email);
  const json = r => r.json();
  const before = await db.user.findUnique({ where: { id: member.id }, select: { costDayRate: true } });
  const oldRate = await db.setting.findUnique({ where: { key: "workshopDayRate" } });
  const made = { e: null, job: null, quotes: [] };
  try {
    if (oldRate) await db.setting.delete({ where: { key: "workshopDayRate" } });
    await db.user.update({ where: { id: member.id }, data: { costDayRate: 240 } });
    made.e = await db.entity.create({ data: { name: "Build quote co", slug: "bq-test", hasSpace: true } });
    made.job = await db.job.create({ data: { number: "J-2099-995", title: "BQ revolve", jobType: "workshop", entityId: made.e.id, stage: "quote" } });
    const J = made.job.id;
    await db.buildPart.createMany({ data: [
      { jobId: J, label: "Revolve frame", userId: member.id, days: 2, hours: 16 },
      { jobId: J, label: "Paint", days: 2 },
    ] });
    await db.purchaseOrder.create({ data: { number: "PO-2099-995", entityId: made.e.id, jobId: J, supplierName: "Steel Co", status: "ordered", lines: { create: [{ description: "Box steel", quantity: 10, unit: "lengths", unitCost: 20 }] } } });
    const item = await db.stockItem.create({ data: { entityId: made.e.id, name: "18mm ply", unit: "sheets", quantity: 20, unitCost: 30 } });
    await db.stockMove.createMany({ data: [{ itemId: item.id, change: -5, kind: "book_out", jobId: J, unitCost: 30 }, { itemId: item.id, change: 1, kind: "return", jobId: J, unitCost: 30 }] });

    ok((await m(`/api/jobs/${J}/quote`, { method: "POST", body: JSON.stringify({ markupPct: 25 }) })).status === 403, "quoting a build is for people who see money");
    ok((await a(`/api/jobs/${J}/quote`, { method: "POST", body: JSON.stringify({ markupPct: -5 }) })).status === 400, "markup must be a percentage");
    let r = await a(`/api/jobs/${J}/quote`, { method: "POST", body: JSON.stringify({ markupPct: 25 }) });
    let d = await json(r); made.quotes.push(d.id);
    ok(r.status === 201 && d.lines === 4 && d.notes.some(n => n.includes("Paint")), "drafted 4 lines; the part with no rate is flagged");
    let q = await json(await a(`/api/quotes/${d.id}`));
    const line = t => q.lines.find(l => l.description.startsWith(t));
    ok(line("Revolve frame")?.unit === "hrs" && line("Revolve frame").quantity === 16 && line("Revolve frame").unitCost === 30 && line("Revolve frame").unitPrice === 37.5, "labour by hours at the person's day rate ÷ 8, plus markup");
    ok(line("Paint")?.unit === "days" && line("Paint").unitCost === 0, "no person and no standard rate: costed at £0");
    ok(line("Box steel")?.quantity === 10 && line("Box steel").unitCost === 20 && line("Box steel").unitPrice === 25 && line("Box steel").section === "Materials", "PO lines as materials at cost + markup");
    ok(line("18mm ply")?.quantity === 4 && line("18mm ply").unitCost === 30, "stock booked out, less returns");
    ok(q.job?.id === J && q.entity?.id === made.e.id, "the quote is attached to the build, for its company");

    // Standard workshop rate
    ok((await m("/api/spaces/bq-test/materials", { method: "PUT", body: JSON.stringify({ workshopDayRate: 200 }) })).status === 403, "only admins set the standard workshop day rate");
    ok((await json(await a("/api/spaces/bq-test/materials", { method: "PUT", body: JSON.stringify({ workshopDayRate: 200 }) }))).workshopDayRate === 200, "admin sets it to £200 a day");
    d = await json(await a(`/api/jobs/${J}/quote`, { method: "POST", body: JSON.stringify({ markupPct: 25 }) })); made.quotes.push(d.id);
    q = await json(await a(`/api/quotes/${d.id}`));
    ok(q.lines.find(l => l.description.startsWith("Paint"))?.unitCost === 200 && d.notes.length === 0, "parts with no person now use the standard rate");

    // Accepting it
    await a(`/api/quotes/${d.id}`, { method: "PUT", body: JSON.stringify({ status: "accepted" }) });
    const jd = (await json(await a(`/api/jobs/${J}`))).job;
    const net = q.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), cost = q.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
    ok(jd.figures.price === net && jd.figures.priceFrom === "quote" && Math.abs(jd.figures.quotedCost - cost) < 0.01, "accepted: the build's price and quoted cost come from it");
    ok(jd.stage === "confirmation", "the build moves from Quote to Confirmation");

    // A quote started from the Quotes page for a build
    r = await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "BQ extra", jobId: J }) });
    const qx = await json(r); made.quotes.push(qx.id);
    ok(r.status === 201 && qx.job?.id === J && qx.entity?.id === made.e.id, "a quote started 'for build' is attached to it and takes its company");
  } finally {
    await db.user.update({ where: { id: member.id }, data: { costDayRate: before.costDayRate } }).catch(() => {});
    await db.setting.deleteMany({ where: { key: "workshopDayRate" } }).catch(() => {});
    if (oldRate) await db.setting.create({ data: oldRate }).catch(() => {});
    for (const id of made.quotes) if (id) await db.quote.delete({ where: { id } }).catch(() => {});
    if (made.e) { await db.purchaseOrder.deleteMany({ where: { entityId: made.e.id } }).catch(() => {}); await db.stockItem.deleteMany({ where: { entityId: made.e.id } }).catch(() => {}); }
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
