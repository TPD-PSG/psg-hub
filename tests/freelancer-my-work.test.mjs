import { run, BASE } from "./lib.mjs";

// Freelancer logins (27 Nov 2026): in a company space a freelancer works from My work: only the
// parts planned for them, and for those builds the drawings, design files, snags and photos. They
// can tick parts done, raise and clear snags and add photos; the build-wide pages and other builds
// are closed to them, and they never see prices.
export default () => run("freelancer-my-work", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const slug = "fl-test";
  let e = null;
  try {
    e = await db.entity.create({ data: { name: "FL test workshop", slug, hasSpace: true } });
    await db.user.updateMany({ where: { id: { in: [free.id, member.id] } }, data: { homeEntityId: e.id } });
    const today = new Date(); const D = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const jobA = await db.job.create({ data: { number: "J-FLT-1", title: "FLT Mine", jobType: "build", entityId: e.id, stage: "build", price: 7777, notes: "Paint it blue" } });
    const jobB = await db.job.create({ data: { number: "J-FLT-2", title: "FLT Not mine", jobType: "build", entityId: e.id, stage: "build", price: 8888 } });
    const jobC = await db.job.create({ data: { number: "J-FLT-3", title: "FLT Cancelled", jobType: "build", entityId: e.id, status: "cancelled" } });
    const pA = await db.buildPart.create({ data: { jobId: jobA.id, label: "FLT flat A", userId: free.id, startDate: D, hours: 8, materials: { create: [{ description: "18mm ply", quantity: 4, unit: "sheets", unitCost: 55 }] } } });
    await db.buildPart.create({ data: { jobId: jobA.id, label: "FLT old part", userId: free.id, startDate: new Date("2020-01-01"), done: true, updatedAt: new Date("2020-01-02") } });
    const pB = await db.buildPart.create({ data: { jobId: jobB.id, label: "FLT member part", userId: member.id, startDate: D } });
    await db.buildPart.create({ data: { jobId: jobC.id, label: "FLT cancelled part", userId: free.id, startDate: D } });
    await db.$executeRawUnsafe(`UPDATE "BuildPart" SET "updatedAt" = '2020-01-02T00:00:00.000Z' WHERE "label" = 'FLT old part'`);
    const file = (jobId, kind, name) => db.jobFile.create({ data: { jobId, kind, name, mime: "application/pdf", size: 4, data: Buffer.from("%PDF").toString("base64") } });
    await file(jobA.id, "design", "flt-design.pdf");
    const cert = await file(jobA.id, "certificate", "flt-cert.pdf");
    const otherFile = await file(jobB.id, "design", "flt-other.pdf");
    const oldRevFile = await file(jobA.id, "design", "flt-ga-A.pdf"), newRevFile = await file(jobA.id, "design", "flt-ga-B.pdf");
    const drawing = await db.drawing.create({ data: { jobId: jobA.id, number: "GA-01", title: "FLT General arrangement" } });
    await db.drawingRevision.create({ data: { drawingId: drawing.id, rev: "A", fileId: oldRevFile.id, status: "superseded", createdAt: new Date(Date.now() - 86400e3) } });
    await db.drawingRevision.create({ data: { drawingId: drawing.id, rev: "B", fileId: newRevFile.id, status: "pending" } });
    const snagB = await db.buildCheck.create({ data: { jobId: jobB.id, kind: "snag", text: "FLT other snag" } });

    const f = await login(free.email);
    const freeName = (await db.user.findUnique({ where: { id: free.id }, select: { name: true } })).name;
    let r = await f(`/api/spaces/${slug}/my-work`);
    const d = await r.json();
    const labels = d.parts?.map(p => p.label) ?? [];
    ok(r.status === 200 && labels.includes("FLT flat A") && !labels.includes("FLT member part"), "My work lists the freelancer's own parts, not other people's");
    ok(!labels.includes("FLT old part") && !labels.includes("FLT cancelled part"), "parts done long ago and on cancelled builds drop off");
    ok(d.jobs.length === 1 && d.jobs[0].title === "FLT Mine", "only builds they have a part on");
    const raw = JSON.stringify(d);
    ok(!raw.includes("7777") && !raw.includes("8888") && !/unitCost|dayRate|price/.test(raw), "no prices or costs");
    ok(d.parts.find(p => p.label === "FLT flat A").materials[0].description === "18mm ply", "materials for the part, without cost");
    const A = d.jobs[0];
    ok(A.drawings.length === 1 && A.drawings[0].rev === "B" && A.files.map(x => x.name).join() === "flt-design.pdf", "the current drawing revision and design files, not old revisions or certificates");

    const get = async p => (await f(p)).status;
    ok(await get(A.files[0].url) === 200 && await get(A.drawings[0].url) === 200, "they can open the design file and current drawing");
    const fileUrl = id => `/api/spaces/${slug}/my-work/files/${id}`;
    ok(await get(fileUrl(oldRevFile.id)) === 404 && await get(fileUrl(cert.id)) === 404 && await get(fileUrl(otherFile.id)) === 404, "not old revisions, certificates or another build's files");

    r = await f(`/api/spaces/${slug}/my-work/jobs/${jobA.id}/snags`, { method: "POST", body: JSON.stringify({ text: "FLT hinge loose" }) });
    const snag = await r.json();
    ok(r.status === 201 && snag.createdBy?.name === freeName, "they can raise a snag, marked as theirs");
    ok((await f(`/api/spaces/${slug}/my-work/jobs/${jobB.id}/snags`, { method: "POST", body: JSON.stringify({ text: "x" }) })).status === 404, "not on another build");
    r = await f(`/api/spaces/${slug}/my-work/snags/${snag.id}`, { method: "PATCH", body: JSON.stringify({ done: true }) });
    ok(r.status === 200 && (await r.json()).doneBy?.name === freeName, "they can mark a snag fixed");
    ok((await f(`/api/spaces/${slug}/my-work/snags/${snagB.id}`, { method: "PATCH", body: JSON.stringify({ done: true }) })).status === 404, "not another build's snags");

    r = await f(`/api/spaces/${slug}/my-work/parts/${pA.id}`, { method: "PATCH", body: JSON.stringify({ done: true }) });
    ok(r.status === 200 && (await db.buildPart.findUnique({ where: { id: pA.id } })).done, "they can tick their part done");
    ok((await f(`/api/spaces/${slug}/my-work/parts/${pB.id}`, { method: "PATCH", body: JSON.stringify({ done: true }) })).status === 404, "not someone else's part");

    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const upload = jobId => { const fd = new FormData(); fd.append("photos", new Blob([png], { type: "image/png" }), "flt.png"); return fetch(`${BASE}/api/spaces/${slug}/my-work/jobs/${jobId}/photos`, { method: "POST", body: fd, headers: { cookie: f.cookie } }); };
    r = await upload(jobA.id);
    const photos = await r.json().catch(() => null);
    ok(r.status === 201 && photos?.length === 1 && (await get(photos[0].url)) === 200, "they can add a build photo and see it");
    ok((await upload(jobB.id)).status === 404, "not to another build");

    // The build-wide pages send them to My work; their APIs say no
    for (const p of ["", "/board", "/jobs", "/planner", "/quotes", "/storage", `/jobs/${jobA.id}`]) {
      const res = await f(`/spaces/${slug}${p}`);
      ok(res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").endsWith(`/spaces/${slug}/my-work`), `/spaces/${slug}${p || "/"} sends a freelancer to My work`);
    }
    ok(await get(`/spaces/${slug}/my-work`) === 200 && await get(`/spaces/${slug}/noticeboard`) === 200 && await get(`/spaces/${slug}/safety`) === 200, "My work, Noticeboard and Safety open");
    ok(await get(`/api/spaces/${slug}`) === 403 && await get(`/api/spaces/${slug}/planner`) === 403 && await get(`/api/spaces/${slug}/storage`) === 403, "the space's build-wide data is staff only");
    const home = await f("/");
    ok((home.headers.get("location") ?? "").endsWith(`/spaces/${slug}/my-work`), "a freelancer signing in lands on My work");

    // Staff keep the space, and get My work for their own parts
    const m = await login(member.email);
    ok((await m(`/api/spaces/${slug}`)).status === 200 && (await m(`/spaces/${slug}/planner`)).status === 200, "staff still see the whole space");
    const md = await (await m(`/api/spaces/${slug}/my-work`)).json();
    ok(md.parts.map(p => p.label).join() === "FLT member part", "staff's My work shows their own parts");

    // The shared tablet records who raised a snag
    const a = await login(admin.email);
    await a(`/api/jobs/${jobB.id}/checks`, { method: "POST", body: JSON.stringify({ kind: "snag", text: "FLT tablet snag", raisedById: member.id }) });
    const ts = await db.buildCheck.findFirst({ where: { jobId: jobB.id, text: "FLT tablet snag" }, select: { createdById: true } });
    ok(ts?.createdById === member.id, "the tablet's snags are put under the person who tapped it");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    await db.user.updateMany({ where: { id: { in: [free.id, member.id] } }, data: { homeEntityId: null } }).catch(() => {});
    if (e) {
      await db.spacePhoto.deleteMany({ where: { entityId: e.id } });
      await db.job.deleteMany({ where: { entityId: e.id } });
      await db.entity.delete({ where: { id: e.id } });
    }
  }
});
