import { run, BASE } from "./lib.mjs";

// Drawing sign-off on a build: revisions A, B…; decisions logged; the build can't move to Build
// until every latest revision is approved; an admin can override with a reason (logged).
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

export default () => run("drawing-signoff", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const form = (who, url, fields, file) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    if (file) fd.append("file", new Blob([file.buf], { type: file.type }), file.name);
    return fetch(`${BASE}${url}`, { method: "POST", body: fd, headers: { cookie: who.cookie } });
  };
  const made = { e: null, job: null };
  try {
    made.e = await db.entity.create({ data: { name: "Signoff test co", slug: "signoff-test", hasSpace: true } });
    made.job = await db.job.create({ data: { number: "J-2099-990", title: "SO revolve", jobType: "workshop", entityId: made.e.id, stage: "technical_design" } });
    const D = `/api/jobs/${made.job.id}/drawings`;
    const pdf = n => ({ buf: PDF, type: "application/pdf", name: n });
    ok((await form(f, D, { title: "GA" }, pdf("ga.pdf"))).status === 403, "a freelancer can't add drawings");
    ok((await form(m, D, { title: "" }, pdf("ga.pdf"))).status === 400, "a drawing needs a title");
    let d = await json(await form(m, D, { number: "GA-01", title: "General arrangement" }, pdf("ga-a.pdf")));
    ok(d.drawings?.[0]?.latest?.rev === "A" && d.drawings[0].latest.status === "pending" && d.blockers.length === 1, "a drawing is added at rev A, awaiting sign-off");
    ok((await form(m, D, { number: "GA-01", title: "Again" }, pdf("x.pdf"))).status === 409, "the same number twice is refused (upload a revision instead)");
    d = await json(await form(m, D, { number: "DT-01", title: "Revolve detail" }, pdf("dt.pdf")));
    const ga = d.drawings.find(x => x.number === "GA-01"), dt = d.drawings.find(x => x.number === "DT-01");

    // The gate
    const move = (who, body) => who(`/api/jobs/${made.job.id}/build`, { method: "PATCH", body: JSON.stringify(body) });
    let r = await move(m, { stage: "build" });
    let g = await json(r);
    ok(r.status === 409 && g.blockers?.length === 2 && g.canOverride === false, "the build can't move to Build with drawings not signed off");
    ok((await move(m, { stage: "build", override: true, overrideReason: "x" })).status === 409, "a member can't override");
    ok((await move(a, { stage: "build", override: true })).status === 409, "an override needs a reason");
    ok((await move(m, { stage: "confirmation" })).status === 200, "moving back is always fine");

    // Decisions (admins record them for the client)
    ok((await m(`${D}/decide`, { method: "POST", body: JSON.stringify({ revisionIds: [ga.latest.id], decision: "approved" }) })).status === 403, "only admins record a sign-off for the client");
    ok((await a(`${D}/decide`, { method: "POST", body: JSON.stringify({ revisionIds: [dt.latest.id], decision: "changes" }) })).status === 400, "asking for changes needs a comment");
    d = await json(await a(`${D}/decide`, { method: "POST", body: JSON.stringify({ revisionIds: [ga.latest.id, dt.latest.id], decision: "approved", comment: "Email from Ann 26 Nov" }) }));
    ok(d.blockers?.length === 0 && d.drawings.every(x => x.latest.status === "approved"), "both approved in one go");
    const log = d.drawings.find(x => x.number === "GA-01").latest.decisions[0];
    ok(log.decision === "approved" && log.onBehalf && log.comment === "Email from Ann 26 Nov" && log.byName, "the log says who, when, which revision and that PSG recorded it");

    // A new revision needs signing off again, and the old one is superseded
    r = await form(m, `${D}/${ga.id}/revisions`, {}, pdf("ga-b.pdf"));
    d = await json(r);
    const ga2 = d.drawings.find(x => x.number === "GA-01");
    ok(r.status === 201 && d.rev === "B" && ga2.latest.rev === "B" && ga2.latest.status === "pending" && ga2.revisions[1].status === "superseded", "rev B awaits sign-off; rev A is superseded");
    ok((await a(`${D}/decide`, { method: "POST", body: JSON.stringify({ revisionIds: [ga2.revisions[1].id], decision: "approved" }) })).status === 400, "a superseded revision can't be signed off");
    ok((await move(m, { stage: "build" })).status === 409, "the gate closes again for rev B");

    // Admin override
    r = await move(a, { stage: "build", override: true, overrideReason: "Client approved on site, rev B to follow" });
    ok(r.status === 200 && (await json(r)).job.stage === "build", "an admin overrides with a reason");
    d = await json(await m(D));
    ok(d.overrides?.[0]?.text.includes("Client approved on site") && d.overrides[0].text.includes("GA-01"), "the override is logged on the build");

    // Files: revision files stay out of the reference list
    const files = await json(await m(`/api/jobs/${made.job.id}/files`));
    ok(Array.isArray(files) && files.length === 0, "drawing revisions aren't listed as reference drawings");
    const page = (await (await a(`/spaces/signoff-test/jobs/${made.job.id}`, { headers: { accept: "text/html" } })).text()).replace(/<!-- -->/g, "");
    ok(page.includes("Drawings &amp; sign-off") && page.includes("GA-01") && page.includes("Awaiting sign-off"), "the build page shows the drawing register");
  } finally {
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
