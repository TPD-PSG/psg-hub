import { run } from "./lib.mjs";

// TWS materials & kit: stock levels, booking out to builds, and purchase orders through
// approval and delivery, feeding job costing.
export default () => run("materials", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const send = (who, url, method, body) => who(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const made = { entity: null, job: null, other: null };
  const oldLimit = await db.setting.findUnique({ where: { key: "poApprovalLimit" } });
  try {
    if (oldLimit) await db.setting.delete({ where: { key: "poApprovalLimit" } });
    made.entity = await db.entity.create({ data: { name: "Materials test co", slug: "materials-test", hasSpace: true } });
    made.other = await db.entity.create({ data: { name: "Materials other co" } });
    made.job = await db.job.create({ data: { number: "J-2099-970", title: "Materials test build", jobType: "workshop", entityId: made.entity.id, price: 5000 } });
    const S = "/api/spaces/materials-test";

    // Stock
    ok((await send(f, `${S}/stock`, "POST", { name: "Ply" })).status === 403, "a freelancer can't add stock");
    ok((await send(m, `${S}/stock`, "POST", { name: "" })).status === 400, "a stock item needs a name");
    let r = await send(m, `${S}/stock`, "POST", { name: "18mm ply", unit: "sheets", quantity: 10, reorderLevel: 12, unitCost: 30 });
    const ply = await json(r);
    ok(r.status === 201 && ply.quantity === 10, "member adds 18mm ply with 10 sheets in stock");
    let mat = await json(await m(`${S}/materials`));
    ok(mat.items.find(i => i.id === ply.id)?.low === true, "at or below the reorder level shows as low");
    ok((await send(m, `/api/stock/${ply.id}/moves`, "POST", { kind: "book_out", quantity: 2 })).status === 400, "booking out needs a build");
    ok((await send(m, `/api/stock/${ply.id}/moves`, "POST", { kind: "book_out", quantity: 50, jobId: made.job.id })).status === 400, "can't book out more than is in stock");
    r = await send(m, `/api/stock/${ply.id}/moves`, "POST", { kind: "book_out", quantity: 4, jobId: made.job.id });
    ok(r.status === 201 && (await json(r)).item.quantity === 6, "4 sheets booked out to the build (6 left)");
    r = await send(m, `/api/stock/${ply.id}/moves`, "POST", { kind: "count", quantity: 7 });
    ok((await json(r)).item.quantity === 7, "a stock count sets the level");

    // POs
    const P = `${S}/purchase-orders`;
    ok((await send(f, P, "POST", { lines: [{ description: "x", quantity: 1, unitCost: 1 }] })).status === 403, "a freelancer can't raise a PO");
    ok((await send(m, P, "POST", { lines: [] })).status === 400, "a PO needs a line");
    ok((await send(m, P, "POST", { submit: true, lines: [{ description: "Ply", quantity: 1, unitCost: 10 }] })).status === 400, "submitting needs a supplier");
    r = await send(m, P, "POST", { submit: true, supplierName: "Stoke Timber", jobId: made.job.id, lines: [{ description: "18mm ply", quantity: 5, unit: "sheets", unitCost: 30, stockItemId: ply.id }] });
    const small = await json(r);
    ok(r.status === 201 && /^PO-\d{4}-\d{3}$/.test(small.number) && small.status === "approved" && small.total === 150, `£150 PO approved straight away (${small.number})`);
    r = await send(m, P, "POST", { submit: true, supplierName: "Steel Co", jobId: made.job.id, lines: [{ description: "Box steel", quantity: 20, unitCost: 25 }] });
    const big = await json(r);
    ok(big.status === "awaiting_approval" && big.total === 500, "£500 PO waits for approval");
    ok((await send(m, `/api/purchase-orders/${big.id}`, "PATCH", { action: "approve" })).status === 403, "a member without Finance can't approve");
    ok((await json(await send(a, `/api/purchase-orders/${big.id}`, "PATCH", { action: "approve" }))).status === "approved", "admin approves it");
    ok((await send(m, P, "POST", { lines: [{ description: "x", quantity: 1, unitCost: 1, stockItemId: 999999 }] })).status === 400, "stock items must be this company's");

    let jd = (await json(await a(`/api/jobs/${made.job.id}`))).job;
    ok(jd.figures.committed === 650 && jd.figures.materials === 120, "job: £650 committed on open POs, £120 of stock used");
    ok((await json(await send(m, `/api/purchase-orders/${small.id}`, "PATCH", { action: "order" }))).status === "ordered", "PO marked ordered");
    ok((await json(await send(m, `/api/purchase-orders/${small.id}`, "PATCH", { action: "deliver" }))).status === "delivered", "PO marked delivered");
    mat = await json(await m(`${S}/materials`));
    ok(mat.items.find(i => i.id === ply.id)?.quantity === 12, "delivered ply goes into stock (7 + 5)");
    jd = (await json(await a(`/api/jobs/${made.job.id}`))).job;
    ok(jd.figures.materials === 270 && jd.figures.committed === 500, "delivered PO moves from committed into the job's actual cost");
    ok((await send(m, `/api/purchase-orders/${small.id}`, "PATCH", { action: "sage", inSage: true })).status === 403, "only Finance/admin tick 'in Sage'");
    ok((await json(await send(a, `/api/purchase-orders/${small.id}`, "PATCH", { action: "sage", inSage: true }))).inSage === true, "admin ticks 'in Sage'");
    ok((await send(m, `/api/purchase-orders/${small.id}`, "PATCH", { action: "cancel" })).status === 400, "a delivered PO can't be cancelled");
    ok((await send(m, `/api/purchase-orders/${big.id}`, "DELETE")).status === 400, "only drafts can be deleted");
    const draft = await json(await send(m, P, "POST", { lines: [{ description: "Castors", quantity: 8, unitCost: 12 }] }));
    ok(draft.status === "draft", "saved as a draft");
    ok((await send(m, `/api/purchase-orders/${draft.id}`, "DELETE")).status === 200, "a draft is deleted");

    // Limit, build page, pages
    ok((await send(m, `${S}/materials`, "PUT", { poApprovalLimit: 1000 })).status === 403, "only admins change the approval limit");
    ok((await json(await send(a, `${S}/materials`, "PUT", { poApprovalLimit: 1000 }))).limit === 1000, "admin changes the approval limit");
    const jm = await json(await m(`/api/jobs/${made.job.id}/materials`));
    ok(jm.pos?.length === 2 && jm.moves?.length === 1 && jm.items?.some(i => i.id === ply.id), "the build's materials: its POs, stock booked out, and stock to add");
    const page = await (await m("/spaces/materials-test/materials", { headers: { accept: "text/html" } })).text();
    ok(page.includes("Materials &amp; kit") && page.includes("18mm ply") && page.includes(small.number), "materials page renders");
    const jp = await (await m(`/spaces/materials-test/jobs/${made.job.id}`, { headers: { accept: "text/html" } })).text();
    ok(jp.includes("Materials &amp; purchase orders") && jp.includes("Box steel"), "build page shows its materials");
  } finally {
    await db.setting.deleteMany({ where: { key: "poApprovalLimit" } }).catch(() => {});
    if (oldLimit) await db.setting.create({ data: oldLimit }).catch(() => {});
    if (made.entity) {
      await db.purchaseOrder.deleteMany({ where: { entityId: made.entity.id } }).catch(() => {});
      await db.stockItem.deleteMany({ where: { entityId: made.entity.id } }).catch(() => {});
    }
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    for (const e of [made.entity, made.other]) if (e) await db.entity.delete({ where: { id: e.id } }).catch(() => {});
  }
});
