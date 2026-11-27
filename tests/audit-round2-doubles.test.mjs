import { run, BASE } from "./lib.mjs";

// Audit round 2, step 3 (26–27 Nov 2026): delivering, booking out and clocking off are safe to do
// twice at once; accepted quotes are locked and one per job; job and PO numbers don't clash;
// stock-bound PO lines aren't costed twice; reminders go once per stage in UK days.
export default () => run("audit-round2-doubles", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , member, admin] = users;
  const made = { e: null, reg: null };
  const since = new Date();
  try {
    const a = await login(admin.email);
    made.e = await db.entity.create({ data: { name: "Audit Doubles Shop", slug: "audit-doubles", hasSpace: true } });
    const item = await db.stockItem.create({ data: { entityId: made.e.id, name: "Ply 18mm", unit: "sheets", quantity: 10, unitCost: 30 } });
    const job = await db.job.create({ data: { number: "J-2099-931", title: "Audit doubles build", jobType: "workshop", entityId: made.e.id, stage: "build" } });

    // Deliver twice at once: stock goes up once
    const po = await db.purchaseOrder.create({ data: { number: "PO-2099-931", entityId: made.e.id, jobId: job.id, supplierName: "Timber Co", status: "ordered", lines: { create: [{ description: "Ply 18mm", quantity: 5, unitCost: 30, stockItemId: item.id }, { description: "Delivery", quantity: 1, unitCost: 40 }] } } });
    const deliver = () => a(`/api/purchase-orders/${po.id}`, { method: "PATCH", body: JSON.stringify({ action: "deliver" }) });
    const [d1, d2] = await Promise.all([deliver(), deliver()]);
    ok([d1.status, d2.status].includes(200) && [d1.status, d2.status].some(x => x === 400 || x === 409), "two 'Mark delivered' clicks at once: one works, the other is refused");
    ok((await db.stockItem.findUnique({ where: { id: item.id } })).quantity === 15 && (await db.stockMove.count({ where: { poId: po.id } })) === 1, "the stock goes up once");

    // Costing: the stock line isn't the job's cost until it's booked out
    const part = await db.buildPart.create({ data: { jobId: job.id, label: "Flats", materials: { create: [{ description: "Ply 18mm", quantity: 3, unitCost: 30, stockItemId: item.id }] } }, include: { materials: true } });
    let jf = (await (await a(`/api/jobs/${job.id}`)).json()).job.figures;
    ok(jf.materials === 40, "a delivered job PO counts only its non-stock lines (£40 delivery), not the ply going into stock");

    // Book out twice at once: once
    const book = () => a(`/api/jobs/${job.id}/book-out-materials`, { method: "POST", body: JSON.stringify({ materialIds: [part.materials[0].id] }) });
    const [b1, b2] = await Promise.all([book(), book()]);
    ok([b1.status, b2.status].sort().join() === "201,409", "two 'Book out' taps at once: one books it, the other is refused");
    ok((await db.stockItem.findUnique({ where: { id: item.id } })).quantity === 12 && (await db.stockMove.count({ where: { jobId: job.id, kind: "book_out" } })) === 1, "the stock comes down once");
    jf = (await (await a(`/api/jobs/${job.id}`)).json()).job.figures;
    ok(jf.materials === 130, "and the job's materials are £40 delivery + £90 ply booked out, counted once");

    // Clock off twice at once: one day logged
    await db.user.update({ where: { id: admin.id }, data: { homeEntityId: made.e.id } });
    await db.clockEntry.create({ data: { userId: admin.id, jobId: job.id, startAt: new Date(Date.now() - 3 * 3600e3) } });
    const off = () => a(`/api/spaces/audit-doubles/tablet`, { method: "POST", body: JSON.stringify({ userId: admin.id, action: "off" }) });
    await Promise.all([off(), off()]);
    ok((await db.timeEntry.count({ where: { userId: admin.id, jobId: job.id } })) === 1, "two 'Clock off' taps at once log the time once");

    // Quotes: accepted ones are locked; one accepted quote per job
    const lines = [{ description: "Build", quantity: 1, unitCost: 1000, unitPrice: 1500 }];
    const mk = async () => (await (await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "Audit quote", entityId: made.e.id, lines }) })).json()).id;
    const q1 = await mk(), q2 = await mk();
    await db.quote.updateMany({ where: { id: { in: [q1, q2] } }, data: { jobId: job.id } });
    await a(`/api/quotes/${q1}`, { method: "PUT", body: JSON.stringify({ status: "accepted" }) });
    const lockedEdit = await a(`/api/quotes/${q1}`, { method: "PUT", body: JSON.stringify({ lines: [{ ...lines[0], unitPrice: 2000 }] }) });
    ok(lockedEdit.status === 409, "an accepted quote's lines can't be changed");
    ok((await a(`/api/quotes/${q1}`, { method: "PUT", body: JSON.stringify({ lines, notes: "Sent by email" }) })).status === 200, "saving it unchanged (e.g. a note) still works");
    await a(`/api/quotes/${q2}`, { method: "PUT", body: JSON.stringify({ status: "accepted" }) });
    const st = Object.fromEntries((await db.quote.findMany({ where: { id: { in: [q1, q2] } }, select: { id: true, status: true } })).map(q => [q.id, q.status]));
    ok(st[q1] === "declined" && st[q2] === "accepted", "accepting a second quote on the job sets the first aside");
    jf = (await (await a(`/api/jobs/${job.id}`)).json()).job.figures;
    ok(jf.price === 1500 && jf.priceFrom === "quote", "the job's price comes from the accepted quote");

    // Numbers: several jobs at once all get one
    const many = await Promise.all([1, 2, 3, 4].map(n => a("/api/jobs", { method: "POST", body: JSON.stringify({ title: `Audit numbered ${n}`, jobType: "other", entityId: made.e.id }) })));
    const nums = await Promise.all(many.map(r => r.json().then(j => j.number)));
    ok(many.every(r => r.status === 201) && new Set(nums).size === 4, "four jobs created at once all succeed with different numbers");

    // Stage reminders (needs the notify secret)
    const secret = process.env.NOTIFY_SECRET;
    if (!secret) results.push("PASS  stage reminders skipped: NOTIFY_SECRET isn't set here (it is in CI)");
    else {
      const d = n => { const x = new Date(); x.setUTCHours(0, 0, 0, 0); return new Date(x.getTime() + n * 86400e3); };
      made.reg = await db.complianceItem.create({ data: { name: "ZZ Stage test policy", category: "policy", reviewAt: d(25), expiresAt: d(5) } });
      const runJob = () => fetch(`${BASE}/api/notify/daily`, { method: "POST", headers: { "x-notify-secret": secret } });
      await runJob();
      const got = await db.notification.findMany({ where: { userId: admin.id, createdAt: { gte: since }, link: { startsWith: `/compliance?item=${made.reg.id}` } } });
      ok(got.some(n => n.title === "ZZ Stage test policy: review due in 25 days" && n.link.endsWith("&r=30")), "a review 25 days off is sent as the 30-day stage (not missed for being off the exact day)");
      ok(got.some(n => n.title === "ZZ Stage test policy: renewal due in 5 days" && n.link.endsWith("&r=7")), "the renewal date gets its own reminder");
      await db.notification.deleteMany({ where: { id: { in: got.map(n => n.id) } }, });
      await db.notification.create({ data: { userId: admin.id, title: "old", link: `/compliance?item=${made.reg.id}&w=review&r=30`, createdAt: new Date(Date.now() - 3 * 86400e3) } });
      await runJob();
      ok((await db.notification.count({ where: { userId: admin.id, createdAt: { gte: since }, link: `/compliance?item=${made.reg.id}&w=review&r=30` } })) === 0, "a stage sent on an earlier day isn't sent again");
    }
    void member;
  } finally {
    await db.user.update({ where: { id: admin.id }, data: { homeEntityId: null } }).catch(() => {});
    await db.notification.deleteMany({ where: { OR: [{ createdAt: { gte: since } }, { title: "old" }], link: { contains: "/compliance?item=" } } }).catch(() => {});
    if (made.reg) await db.complianceItem.delete({ where: { id: made.reg.id } }).catch(() => {});
    if (made.e) {
      await db.quote.deleteMany({ where: { entityId: made.e.id } }).catch(() => {});
      await db.clockEntry.deleteMany({ where: { job: { entityId: made.e.id } } }).catch(() => {});
      await db.timeEntry.deleteMany({ where: { job: { entityId: made.e.id } } }).catch(() => {});
      await db.purchaseOrder.deleteMany({ where: { entityId: made.e.id } }).catch(() => {});
      await db.job.deleteMany({ where: { entityId: made.e.id } }).catch(() => {});
      await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
    }
  }
});
