import { run, BASE } from "./lib.mjs";

// Audit round 2, step 1 (26 Nov 2026): Fun uploads can't be web pages; stored files never run in
// the browser; expense receipts belong to their submitter; the paid AI routes are staff-only and
// capped; day rates and costs hidden from people who can't see money; BD tasks follow company
// limits; set-piece QR codes need the space; sizeless uploads refused. No Claude calls are made.
export default () => run("audit-round2-security", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const made = { sub: null, exp: null, e1: null, e2: null, opp: null, job: null };
  const memberPerms = (await db.user.findUnique({ where: { id: member.id }, select: { permissions: true } })).permissions;
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  try {
    const a = await login(admin.email), f = await login(free.email), c = await login(client.email);
    let m = await login(member.email);
    const form = async (who, path, file, type, name) => {
      const fd = new FormData();
      fd.append("title", "Audit test"); fd.append("story", "x");
      fd.append("media", new Blob([file], { type }), name);
      return fetch(`${BASE}${path}`, { method: "POST", headers: { cookie: who.cookie }, body: fd });
    };

    // 1. Fun Corner: pictures and videos only; old uploads of any type download, never open
    ok((await form(f, "/api/fun/submissions", "<script>alert(1)</script>", "text/html", "page.html")).status === 415, "a web page can't be uploaded as a Fun photo");
    ok((await form(f, "/api/fun/submissions", "<svg onload=alert(1)/>", "image/svg+xml", "x.svg")).status === 415, "nor an SVG");
    const up = await form(f, "/api/fun/submissions", PNG, "image/png", "ok.png");
    ok(up.status === 201 || up.status === 200, "a PNG photo still uploads");
    made.sub = await db.funSubmission.create({ data: { authorId: free.id, title: "Old", story: "x", monthYear: "2026-11", media: { create: [{ name: "evil.html", mime: "text/html", data: Buffer.from("<script>1</script>").toString("base64") }] } }, include: { media: true } });
    const r1 = await a(`/api/fun/media/${made.sub.media[0].id}`);
    ok(r1.headers.get("content-type") === "application/octet-stream" && /^attachment/.test(r1.headers.get("content-disposition") ?? "") && r1.headers.get("x-content-type-options") === "nosniff", "an old upload claiming to be a web page downloads as plain bytes");

    // 2. Expense receipts: only the submitter or an admin
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ modules: ["productions", "finance", "bd"], allProductions: false }) } });
    m = await login(member.email); // a fresh session carries the new permissions
    made.exp = await db.productionExpense.create({ data: { description: "Audit taxi", submittedByUserId: admin.id, documents: { create: [{ type: "receipt", name: "r.pdf", mime: "application/pdf", file: Buffer.from("%PDF-1.4").toString("base64") }] } }, include: { documents: true } });
    const docId = made.exp.documents[0].id;
    ok((await m(`/api/expenses/${made.exp.id}/documents`)).status === 404, "someone else can't list another person's receipts");
    ok((await m(`/api/expenses/${made.exp.id}/documents/${docId}`)).status === 404, "or open one");
    ok((await m(`/api/expenses/${made.exp.id}/documents/${docId}`, { method: "DELETE" })).status === 404, "or delete one");
    ok((await db.productionExpenseDocument.count({ where: { id: docId } })) === 1, "the receipt is still there");
    const own = await a(`/api/expenses/${made.exp.id}/documents/${docId}`);
    ok(own.status === 200 && own.headers.get("content-type") === "application/pdf", "the owner (here an admin) opens it");
    const other = await db.productionExpense.create({ data: { description: "Other", submittedByUserId: member.id } });
    ok((await a(`/api/expenses/${other.id}/documents/${docId}`)).status === 404, "a receipt can't be fetched through a different expense");
    await db.productionExpense.delete({ where: { id: other.id } });

    // 3. Paid AI routes (no call reaches Claude here)
    ok((await c("/api/knowledge-docs/ask", { method: "POST", body: JSON.stringify({ question: "Holiday policy?" }) })).status === 403, "clients can't question the policy documents");
    ok((await c("/api/knowledge-docs")).status === 403, "or list them");
    ok((await f("/api/knowledge-docs/ask", { method: "POST", body: JSON.stringify({ question: "x".repeat(5000) }) })).status === 400, "very long questions are refused before anything is sent");
    ok((await c("/api/meetings/_/generate-minutes", { method: "POST", body: JSON.stringify({ transcript: "hi", productionId: 1 }) })).status === 403, "clients can't write minutes");
    ok((await f("/api/meetings/_/generate-minutes", { method: "POST", body: JSON.stringify({ transcript: "hi", productionId: 1 }) })).status === 403, "nor freelancers");
    const prod = await db.production.create({ data: { name: "Audit minutes show", type: "Other" } });
    ok((await m("/api/meetings/_/generate-minutes", { method: "POST", body: JSON.stringify({ transcript: "hi", productionId: prod.id }) })).status === 403, "staff not on the show can't either");
    ok((await a("/api/meetings/_/generate-minutes", { method: "POST", body: JSON.stringify({ transcript: "x".repeat(200_001), productionId: prod.id }) })).status === 413, "over-long transcripts are refused before anything is sent");
    await db.production.delete({ where: { id: prod.id } });

    // 4. Money on build parts and the planner
    made.e1 = await db.entity.create({ data: { name: "Audit Shop", slug: "audit-shop", hasSpace: true } });
    made.e2 = await db.entity.create({ data: { name: "Audit Other Co" } });
    const co = await db.client.create({ data: { name: "Audit Client Ltd", type: "producer" } });
    made.job = await db.job.create({ data: { number: "J-2099-951", title: "Audit build", jobType: "workshop", entityId: made.e1.id, clientId: co.id, stage: "build" } });
    const lt = await db.labourType.create({ data: { entityId: made.e1.id, name: "Audit carpenter", dayRate: 240 } });
    await db.buildPart.create({ data: { jobId: made.job.id, label: "Flats", labourTypeId: lt.id, materials: { create: [{ description: "Ply", quantity: 4, unitCost: 32 }] } } });
    await db.user.update({ where: { id: free.id }, data: { homeEntityId: made.e1.id } });
    let pl = await (await f("/api/spaces/audit-shop/planner")).json();
    const fp = pl.parts.find(p => p.jobId === made.job.id);
    ok(fp && fp.materials[0].unitCost === null && fp.labourType.dayRate === null && pl.jobs.find(j => j.id === made.job.id).client === null, "a freelancer's planner has no costs, day rates or client names");
    pl = await (await a("/api/spaces/audit-shop/planner")).json();
    ok(pl.parts.find(p => p.jobId === made.job.id).materials[0].unitCost === 32, "an admin still sees them");
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ modules: ["productions"], allProductions: false }) } });
    m = await login(member.email);
    const mp = await (await m(`/api/jobs/${made.job.id}/parts`)).json();
    ok(mp[0].materials[0].unitCost === null && mp[0].labourType.dayRate === null, "staff without BD or finance get parts without money");
    const pid = mp[0].id, mid = mp[0].materials[0].id;
    await m(`/api/jobs/${made.job.id}/parts/${pid}/materials/${mid}`, { method: "PATCH", body: JSON.stringify({ quantity: 5 }) });
    ok((await db.buildPartMaterial.findUnique({ where: { id: mid } })).unitCost === 32, "and changing a quantity leaves the hidden cost alone");
    const ap = await (await a(`/api/jobs/${made.job.id}/parts`)).json();
    ok(ap[0].materials[0].unitCost === 32 && ap[0].labourType.dayRate === 240, "people who can see money still do");
    await db.job.delete({ where: { id: made.job.id } }); made.job = null;
    await db.client.delete({ where: { id: co.id } });

    // 5. BD tasks follow company limits
    made.opp = await db.opportunity.create({ data: { title: "Audit deal", type: "production", entityId: made.e2.id, tasks: { create: [{ description: "Call back" }] } }, include: { tasks: true } });
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ modules: ["productions", "bd"], allProductions: false, entityIds: [made.e1.id] }) } });
    m = await login(member.email);
    const tid = made.opp.tasks[0].id;
    ok((await m(`/api/bd-tasks/${tid}`, { method: "PUT", body: JSON.stringify({ description: "Hijacked" }) })).status === 404, "someone limited to another company can't change a deal's task");
    ok((await m(`/api/bd-tasks/${tid}`, { method: "DELETE" })).status === 404, "or delete it");
    ok((await db.bDTask.findUnique({ where: { id: tid } })).description === "Call back", "the task is untouched");
    ok((await a(`/api/bd-tasks/${tid}`, { method: "PUT", body: JSON.stringify({ description: "Call back Tue", completedAt: null }) })).status === 200, "an admin can still edit it");

    // 6. Set-piece QR codes need the space; sizeless uploads are refused
    const piece = await db.storedPiece.create({ data: { entityId: made.e1.id, name: "Audit flat" } });
    ok((await c(`/api/stored-pieces/${piece.id}/qr`)).status === 403, "a client can't get a stored piece's QR code");
    ok((await a(`/api/stored-pieces/${piece.id}/qr`)).status === 200, "an admin can");
    const stream = new ReadableStream({ start(ctl) { ctl.enqueue(new TextEncoder().encode('{"question":"hi"}')); ctl.close(); } });
    const chunked = await fetch(`${BASE}/api/knowledge-docs/ask`, { method: "POST", headers: { cookie: f.cookie, "Content-Type": "application/json" }, body: stream, duplex: "half" });
    ok(chunked.status === 411, "an upload that doesn't state its size is refused");
  } finally {
    await db.user.update({ where: { id: member.id }, data: { permissions: memberPerms } }).catch(() => {});
    await db.user.updateMany({ where: { id: free.id }, data: { homeEntityId: null } }).catch(() => {});
    if (made.sub) await db.funSubmission.delete({ where: { id: made.sub.id } }).catch(() => {});
    // The test PNG was written to disk too: remove it with its row
    const mine = await db.funMedia.findMany({ where: { submission: { title: "Audit test", authorId: free.id } }, select: { filePath: true } }).catch(() => []);
    const { unlink } = await import("fs/promises");
    for (const x of mine) if (x.filePath) await unlink(`${process.cwd()}/public/fun-media/${x.filePath}`).catch(() => {});
    await db.funSubmission.deleteMany({ where: { title: "Audit test", authorId: free.id } }).catch(() => {});
    if (made.exp) await db.productionExpense.delete({ where: { id: made.exp.id } }).catch(() => {});
    if (made.opp) await db.opportunity.delete({ where: { id: made.opp.id } }).catch(() => {});
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    for (const e of [made.e1, made.e2]) if (e) await db.entity.delete({ where: { id: e.id } }).catch(() => {});
  }
});
