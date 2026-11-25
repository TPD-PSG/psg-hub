import { run } from "./lib.mjs";

// Variations on a build: priced lines, draft → sent → approved/declined by the client (or recorded
// by an admin); approved ones add to the job's price; the client never sees costs.
export default () => run("variations", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const made = { e: null, co: null, other: null, job: null, job2: null, quote: null };
  const since = new Date();
  try {
    made.e = await db.entity.create({ data: { name: "Var test workshop", slug: "var-test", hasSpace: true } });
    made.co = await db.client.create({ data: { name: "VT Theatre", type: "promoter" } });
    made.other = await db.client.create({ data: { name: "VT Other", type: "venue" } });
    made.job = await db.job.create({ data: { number: "J-2099-981", title: "VT coach", jobType: "workshop", entityId: made.e.id, clientId: made.co.id, stage: "build" } });
    made.job2 = await db.job.create({ data: { number: "J-2099-982", title: "VT not yours", jobType: "workshop", entityId: made.e.id, clientId: made.other.id, stage: "build" } });
    made.quote = await db.quote.create({ data: { number: "Q-2099-981", title: "VT quote", entityId: made.e.id, jobId: made.job.id, status: "accepted", vatRate: 20, lines: { create: [{ description: "Coach", quantity: 1, unitCost: 1000, unitPrice: 1500 }] } } });
    await db.user.update({ where: { id: client.id }, data: { clientId: made.co.id } });
    const V = `/api/jobs/${made.job.id}/variations`;

    ok((await m(V)).status === 403, "someone who can't see prices can't open variations");
    ok((await f(V)).status === 403, "freelancers can't either");
    ok((await a(V, { method: "POST", body: JSON.stringify({ title: " " }) })).status === 400, "a variation needs a title");
    let r = await a(V, { method: "POST", body: JSON.stringify({ title: "Extra flats", notes: "Stage left", lines: [
      { section: "Sheet materials", description: "18mm ply", quantity: 4, unit: "sheets", unitCost: 30, unitPrice: 40 },
      { section: "Labour", description: "Carpenter", quantity: 1, unit: "days", unitCost: 200, unitPrice: 300 },
    ] }) });
    const v1 = await json(r);
    ok(r.status === 201 && v1.label === "V1" && v1.status === "draft" && v1.totals.net === 460 && v1.totals.cost === 320 && v1.vatRate === 20, "V1 is drafted with lines, totals and the quote's VAT rate");
    const v2 = await json(await a(V, { method: "POST", body: JSON.stringify({ title: "Gold leaf", lines: [{ description: "Gilding", quantity: 1, unitCost: 50, unitPrice: 120 }] }) }));
    ok(v2.label === "V2", "the next one is V2");

    let job = await json(await a(`/api/jobs/${made.job.id}`));
    ok(job.job.figures.price === 1500 && job.job.figures.variationsApproved === 0, "drafts don't change the price");

    // Client can't see drafts
    let c = await login(client.email);
    let mb = await json(await c("/api/my-builds"));
    ok(mb.builds.find(b => b.title === "VT coach").variations.length === 0, "the client doesn't see drafts");

    // Send V1
    let list = await json(await a(`${V}/${v1.id}`, { method: "PATCH", body: JSON.stringify({ action: "send" }) }));
    ok(list.find(x => x.id === v1.id).status === "sent", "V1 is sent to the client");
    ok((await a(`${V}/${v1.id}`, { method: "PATCH", body: JSON.stringify({ action: "edit", title: "x" }) })).status === 400, "a sent variation can't be edited without withdrawing it");
    ok((await db.notification.count({ where: { userId: client.id, createdAt: { gte: since }, title: { contains: "V1" } } })) === 1, "the client is told");
    mb = await json(await c("/api/my-builds"));
    const cv = mb.builds.find(b => b.title === "VT coach").variations[0];
    ok(cv?.label === "V1" && cv.totals.net === 460 && cv.totals.gross === 552 && cv.lines.every(l => l.unitCost === undefined) && cv.totals.cost === undefined, "the client sees V1's prices and VAT, never our cost");

    // Client decisions
    ok((await c(`/api/my-builds/variations/${v1.id}`, { method: "POST", body: JSON.stringify({ decision: "declined", comment: " " }) })).status === 400, "declining needs a reason");
    ok((await c(`/api/my-builds/variations/${v2.id}`, { method: "POST", body: JSON.stringify({ decision: "approved" }) })).status === 404, "the client can't approve a draft");
    const otherVar = await db.jobVariation.create({ data: { jobId: made.job2.id, number: 1, title: "Not yours", status: "sent", lines: { create: [{ description: "x", quantity: 1, unitPrice: 1 }] } } });
    ok((await c(`/api/my-builds/variations/${otherVar.id}`, { method: "POST", body: JSON.stringify({ decision: "approved" }) })).status === 404, "or another company's");
    r = await c(`/api/my-builds/variations/${v1.id}`, { method: "POST", body: JSON.stringify({ decision: "approved" }) });
    mb = await json(r);
    ok(r.status === 200 && mb.builds.find(b => b.title === "VT coach").variations.find(x => x.id === v1.id).status === "approved", "the client approves V1");
    const row = await db.jobVariation.findUnique({ where: { id: v1.id } });
    const cname = (await db.user.findUnique({ where: { id: client.id }, select: { name: true } })).name;
    ok(row.decidedByName === cname && row.decidedOnBehalf === false, "logged as the client's own decision");
    ok((await db.notification.count({ where: { userId: admin.id, createdAt: { gte: since }, title: { contains: "approved variation V1" } } })) === 1, "PSG is told");
    ok((await c(`/api/my-builds/variations/${v1.id}`, { method: "POST", body: JSON.stringify({ decision: "declined", comment: "changed my mind" }) })).status === 400, "a decision can't be changed afterwards");

    job = await json(await a(`/api/jobs/${made.job.id}`));
    const fg = job.job.figures;
    ok(fg.price === 1960 && fg.basePrice === 1500 && fg.variationsPrice === 460 && fg.quotedCost === 1320 && fg.variationsApproved === 1, "an approved variation adds to the price (1500 + 460) and the quoted cost");
    const listed = (await json(await a("/api/jobs"))).jobs;
    ok(listed.find(j => j.id === made.job.id)?.figures?.price === 1960, "the jobs list uses the same price");

    // Admin records V2 on the client's behalf (send first, then withdraw/record rules)
    ok((await m(`${V}/${v2.id}`, { method: "PATCH", body: JSON.stringify({ action: "record", decision: "approved" }) })).status === 403, "only admins record a client's decision");
    list = await json(await a(`${V}/${v2.id}`, { method: "PATCH", body: JSON.stringify({ action: "record", decision: "declined", comment: "Over budget (phone call)" }) }));
    const d2 = list.find(x => x.id === v2.id);
    ok(d2.status === "declined" && d2.decidedOnBehalf === true && d2.decisionComment === "Over budget (phone call)", "an admin records a decline given by phone");
    job = await json(await a(`/api/jobs/${made.job.id}`));
    ok(job.job.figures.price === 1960, "a declined variation doesn't change the price");
    ok((await a(`${V}/${v1.id}`, { method: "DELETE" })).status === 400, "an approved variation can't be deleted");
    ok((await a(`${V}/${v2.id}`, { method: "DELETE" })).status === 200, "a declined one can");
    const jm = await json(await m(`/api/jobs/${made.job.id}`));
    ok(jm.job.variations === undefined && jm.job.figures === null, "people without prices get no variation figures in the job");
  } finally {
    await db.user.update({ where: { id: client.id }, data: { clientId: null } }).catch(() => {});
    await db.notification.deleteMany({ where: { createdAt: { gte: since }, OR: [{ title: { contains: "VT " } }, { link: "/my-builds" }] } }).catch(() => {});
    if (made.quote) await db.quote.delete({ where: { id: made.quote.id } }).catch(() => {});
    for (const j of [made.job, made.job2]) if (j) await db.job.delete({ where: { id: j.id } }).catch(() => {});
    for (const x of [made.co, made.other]) if (x) await db.client.delete({ where: { id: x.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
