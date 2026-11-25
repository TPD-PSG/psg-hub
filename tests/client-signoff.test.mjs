import { run, BASE } from "./lib.mjs";

// Plans sign-off part 2: a client login linked to a client company sees that company's builds and
// drawings, approves one or several latest revisions, or asks for changes with a comment. PSG is
// notified of decisions; clients are notified of new drawings. Nobody else's builds are visible.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

export default () => run("client-signoff", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const html = async r => (await r.text()).replace(/<!-- -->/g, "");
  const form = (who, url, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append("file", new Blob([PDF], { type: "application/pdf" }), "d.pdf");
    return fetch(`${BASE}${url}`, { method: "POST", body: fd, headers: { cookie: who.cookie } });
  };
  const decide = (who, body) => who("/api/my-builds/decide", { method: "POST", body: JSON.stringify(body) });
  const made = { e: null, mine: null, other: null, jobs: [] };
  const since = new Date();
  try {
    made.e = await db.entity.create({ data: { name: "Client test workshop", slug: "client-test", hasSpace: true, shortName: "CTW" } });
    made.mine = await db.client.create({ data: { name: "CT Theatre Co", type: "promoter" } });
    made.other = await db.client.create({ data: { name: "CT Someone Else", type: "venue" } });
    const j1 = await db.job.create({ data: { number: "J-2099-981", title: "CT revolve", jobType: "workshop", entityId: made.e.id, clientId: made.mine.id, stage: "technical_design" } });
    const j2 = await db.job.create({ data: { number: "J-2099-982", title: "CT other build", jobType: "workshop", entityId: made.e.id, clientId: made.other.id, stage: "build" } });
    made.jobs.push(j1.id, j2.id);

    // Not linked yet
    let c = await login(client.email);
    ok((await c("/api/my-builds")).status === 403, "a client login not linked to a company sees nothing");
    ok((await a("/api/users/" + client.id, { method: "PUT", body: JSON.stringify({ name: client.name, email: client.email, role: "client", clientId: 999999 }) })).status === 400, "linking to an unknown company is refused");
    ok((await a("/api/users/" + client.id, { method: "PUT", body: JSON.stringify({ name: client.name, email: client.email, role: "client", clientId: made.mine.id }) })).status === 200, "an admin links the client login to its company");
    ok((await m("/api/my-builds")).status === 403 && (await f("/api/my-builds")).status === 403, "staff and freelancers don't get the client page");

    // Drawings go up; the client is told
    let d = await json(await form(m, `/api/jobs/${j1.id}/drawings`, { number: "GA-01", title: "General arrangement" }));
    d = await json(await form(m, `/api/jobs/${j1.id}/drawings`, { number: "DT-01", title: "Revolve detail" }));
    d = await json(await form(m, `/api/jobs/${j1.id}/drawings`, { number: "DT-02", title: "Truck detail" }));
    await form(m, `/api/jobs/${j2.id}/drawings`, { number: "X-01", title: "Not yours" });
    const told = await db.notification.findMany({ where: { userId: client.id, createdAt: { gte: since } } });
    ok(told.length === 3 && told.every(n => n.link === "/my-builds" && n.title.includes("CT revolve")), "the client is notified of each new drawing on their build");

    c = await login(client.email);
    let mb = await json(await c("/api/my-builds"));
    ok(mb.builds?.length === 1 && mb.builds[0].title === "CT revolve" && mb.builds[0].drawings.length === 3, "the client sees only their company's build and its drawings");
    ok(mb.builds[0].builder?.shortName === "CTW", "the build shows who's building it");
    const rev = n => mb.builds[0].drawings.find(x => x.number === n).revisions[0];
    const ga = rev("GA-01"), dt1 = rev("DT-01"), dt2 = rev("DT-02");
    const otherRev = (await db.drawingRevision.findFirst({ where: { drawing: { jobId: j2.id } } })).id;

    // Files
    let r = await c(ga.url);
    ok(r.status === 200 && r.headers.get("content-type") === "application/pdf", "the client can open their drawing");
    ok((await c(`/api/my-builds/files/${otherRev}`)).status === 404, "but not another company's");
    ok((await c(`/api/job-files/${(await db.drawingRevision.findUnique({ where: { id: ga.id } })).fileId}`)).status === 403, "the staff file route stays closed to clients");

    // Decisions
    ok((await decide(c, { revisionIds: [otherRev], decision: "approved" })).status === 403, "a client can't sign off someone else's drawing");
    ok((await decide(c, { revisionIds: [ga.id], decision: "changes", comment: " " })).status === 400, "asking for changes needs a comment");
    r = await decide(c, { revisionIds: [ga.id], decision: "changes", comment: "Door opens stage left" });
    mb = await json(r);
    ok(r.status === 200 && mb.builds[0].drawings.find(x => x.number === "GA-01").revisions[0].status === "changes", "the client sends one back with a comment");
    const log = await db.drawingDecision.findFirst({ where: { revisionId: ga.id }, orderBy: { id: "desc" } });
    ok(log.onBehalf === false && log.userId === client.id && log.comment === "Door opens stage left", "logged as the client's own decision, not recorded by PSG");
    r = await decide(c, { revisionIds: [dt1.id, dt2.id], decision: "approved" });
    mb = await json(r);
    ok(r.status === 200 && ["DT-01", "DT-02"].every(n => mb.builds[0].drawings.find(x => x.number === n).revisions[0].status === "approved"), "the client approves two at once");
    const psg = await db.notification.findMany({ where: { userId: { in: [member.id, admin.id] }, createdAt: { gte: since }, title: { contains: "CT revolve" } } });
    ok(psg.some(n => n.userId === member.id && n.title.includes("asked for changes") && n.body.includes("Door opens stage left")) && psg.some(n => n.userId === admin.id && n.title.includes("approved 2 drawings")), "PSG (uploader and admins) is notified of each decision");

    // A new revision supersedes; the old one can't be decided
    await form(m, `/api/jobs/${j1.id}/drawings/${mb.builds[0].drawings.find(x => x.number === "GA-01").id}/revisions`, {});
    ok((await decide(c, { revisionIds: [ga.id], decision: "approved" })).status === 400, "an old revision can't be approved once a new one is up");
    mb = await json(await c("/api/my-builds"));
    const gaNow = mb.builds[0].drawings.find(x => x.number === "GA-01");
    ok(gaNow.revisions[0].rev === "B" && gaNow.revisions[0].status === "pending" && gaNow.revisions[1].status === "superseded", "rev B is waiting for sign-off, A is kept in the history");

    // Pages
    const page = await html(await c("/my-builds", { headers: { accept: "text/html" } }));
    ok(page.includes("Your builds") && page.includes("CT revolve") && page.includes("Awaiting your sign-off") && !page.includes("CT other build"), "the My builds page shows their build and what's waiting");
    r = await c("/", { redirect: "manual" });
    ok(r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/my-builds"), "a linked client lands on My builds");
  } finally {
    await db.user.update({ where: { id: client.id }, data: { clientId: null } }).catch(() => {});
    await db.notification.deleteMany({ where: { createdAt: { gte: since }, OR: [{ link: "/my-builds" }, { title: { contains: "CT " } }] } }).catch(() => {});
    for (const id of made.jobs) {
      await db.drawing.deleteMany({ where: { jobId: id } }).catch(() => {});
      await db.jobFile.deleteMany({ where: { jobId: id } }).catch(() => {});
      await db.job.delete({ where: { id } }).catch(() => {});
    }
    for (const x of [made.mine, made.other]) if (x) await db.client.delete({ where: { id: x.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
