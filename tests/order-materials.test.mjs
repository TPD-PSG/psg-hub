import { run } from "./lib.mjs";

// Ordering a build's estimated materials: ticked part materials become one PO for the build
// (draft or submitted with the usual approval limit); ordered lines are locked and can't be
// ordered twice; cancelling the PO frees them.
export default () => run("order-materials", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , , admin] = users;
  const a = await login(admin.email), f = await login(free.email);
  const json = r => r.json();
  const made = { e: null, job: null };
  const oldLimit = await db.setting.findUnique({ where: { key: "poApprovalLimit" } });
  try {
    if (oldLimit) await db.setting.delete({ where: { key: "poApprovalLimit" } }); // default £250
    made.e = await db.entity.create({ data: { name: "OM test workshop", slug: "om-test", hasSpace: true } });
    made.job = await db.job.create({ data: { number: "J-2099-998", title: "OM flats", jobType: "workshop", entityId: made.e.id, stage: "confirmation" } });
    const J = made.job.id;
    const part = await db.buildPart.create({ data: { jobId: J, label: "Flats", days: 2 } });
    const mk = (description, quantity, unitCost) => db.buildPartMaterial.create({ data: { partId: part.id, description, quantity, unit: "sheets", unitCost } });
    const ply = await mk("18mm ply", 12, 31.5), mdf = await mk("9mm MDF", 6, 14), glue = await mk("Glue", 2, 8);
    const O = `/api/jobs/${J}/order-materials`;
    const order = (who, body) => who(O, { method: "POST", body: JSON.stringify(body) });

    ok((await order(a, { materialIds: [] })).status === 400, "tick at least one");
    ok((await order(f, { materialIds: [ply.id] })).status === 403, "freelancers can't raise POs");
    ok((await order(a, { materialIds: [ply.id], submit: true })).status === 400, "submitting needs a supplier");
    let r = await order(a, { materialIds: [ply.id, mdf.id], submit: true, supplierName: "Stoke Timber" });
    let d = await json(r);
    ok(r.status === 201 && d.po.total === 462 && d.po.status === "awaiting_approval", "ply + MDF on one PO (£462), over the £250 limit so it waits for approval");
    const po = await db.purchaseOrder.findUnique({ where: { id: d.po.id }, include: { lines: true } });
    ok(po.jobId === J && po.lines.length === 2 && po.lines[0].description === "18mm ply" && po.lines[0].quantity === 12 && po.lines[0].stockItemId === null, "the PO is for the build, with the estimated lines");
    ok(d.parts[0].materials.filter(m => m.po?.number === d.po.number).length === 2, "those lines now say which PO they're on");
    ok((await order(a, { materialIds: [ply.id, glue.id], supplierName: "X" })).status === 409, "a line can't be ordered twice");
    d = await json(await order(a, { materialIds: [glue.id] }));
    ok(d.po.status === "draft", "the glue is saved as a draft PO");

    // Cancelling frees the lines
    await db.purchaseOrder.update({ where: { id: po.id }, data: { status: "cancelled" } });
    r = await order(a, { materialIds: [ply.id], submit: true, supplierName: "Other Timber" });
    d = await json(r);
    ok(r.status === 201 && d.po.status === "awaiting_approval" && d.po.total === 378, "after cancelling, the ply can be ordered again");
    ok((await a(`/api/jobs/${J}/parts/${part.id}/materials/${mdf.id}`, { method: "PATCH", body: JSON.stringify({ quantity: 7 }) })).status === 200, "lines on a cancelled PO can be edited again");
    // Normal PO route still works after the refactor
    r = await a("/api/spaces/om-test/purchase-orders", { method: "POST", body: JSON.stringify({ submit: true, supplierName: "Castors Ltd", jobId: J, lines: [{ description: "Castors", quantity: 4, unitCost: 10 }] }) });
    d = await json(r);
    ok(r.status === 201 && d.status === "approved" && d.total === 40, "raising a PO the usual way still works");
  } finally {
    if (oldLimit) await db.setting.upsert({ where: { key: "poApprovalLimit" }, update: { value: oldLimit.value }, create: oldLimit }).catch(() => {});
    if (made.e) await db.purchaseOrder.deleteMany({ where: { entityId: made.e.id } }).catch(() => {});
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
