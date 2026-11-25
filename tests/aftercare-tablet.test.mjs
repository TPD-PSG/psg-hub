import { run, BASE } from "./lib.mjs";

// Repairs and aftercare (staff and client reports, open → booked in → done, notifications), and
// tablet mode clocking (on, switch, off → half-day entries; only the workshop's team).
export default () => run("aftercare-tablet", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), f = await login(free.email);
  const json = r => r.json();
  const html = async r => (await r.text()).replace(/<!-- -->/g, "");
  const made = { e: null, co: null, job: null, job2: null };
  const since = new Date();
  try {
    made.e = await db.entity.create({ data: { name: "Care test workshop", slug: "care-test", hasSpace: true } });
    made.co = await db.client.create({ data: { name: "CT Touring Co", type: "promoter" } });
    made.job = await db.job.create({ data: { number: "J-2099-995", title: "CR tour set", jobType: "workshop", entityId: made.e.id, clientId: made.co.id, stage: "delivery" } });
    made.job2 = await db.job.create({ data: { number: "J-2099-996", title: "CR panto", jobType: "workshop", entityId: made.e.id, stage: "build" } });
    const piece = await db.storedPiece.create({ data: { entityId: made.e.id, jobId: made.job.id, name: "Staircase truck", outAt: new Date(), outNote: "On tour" } });
    await db.user.update({ where: { id: member.id }, data: { homeEntityId: made.e.id } });
    await db.user.update({ where: { id: client.id }, data: { clientId: made.co.id } });
    const form = (who, url, fields) => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, String(v)); return fetch(`${BASE}${url}`, { method: "POST", body: fd, headers: { cookie: who.cookie } }); };
    const R = "/api/spaces/care-test/repairs";

    // Staff report
    ok((await form(a, R, { jobId: made.job.id, title: "" })).status === 400, "a repair needs to say what's wrong");
    ok((await form(f, R, { jobId: made.job.id, title: "x" })).status === 403, "freelancers can't report here");
    let r = await form(a, R, { jobId: made.job.id, pieceId: piece.id, title: "Castor snapped", whereAt: "Theatre Royal Plymouth", urgency: "urgent" });
    const rep1 = await json(r);
    ok(r.status === 201 && rep1.status === "open" && rep1.urgency === "urgent" && rep1.piece.name === "Staircase truck", "staff report an urgent repair on a piece that's out on tour");
    ok((await db.notification.count({ where: { userId: member.id, createdAt: { gte: since }, title: { contains: "URGENT repair" } } })) === 1, "the workshop team is told");

    // Client report
    let c = await login(client.email);
    let mb = await json(await c("/api/my-builds"));
    ok(mb.builds.find(b => b.title === "CR tour set").storedPieces.some(p => p.name === "Staircase truck"), "the client can pick the piece, even though it's gone out on tour");
    r = await form(c, "/api/my-builds/repairs", { jobId: made.job2.id, title: "Not mine" });
    ok(r.status === 400, "a client can't report on another company's build");
    r = await form(c, "/api/my-builds/repairs", { jobId: made.job.id, title: "Door sticks", urgency: "soon", whereAt: "Plymouth" });
    mb = await json(r);
    const mine = mb.builds.find(b => b.title === "CR tour set").repairs;
    ok(r.status === 201 && mine.length === 2 && mine.some(x => x.title === "Door sticks" && x.status === "open"), "the client reports a problem and sees it in their builds");
    const rep2 = await db.repair.findFirst({ where: { title: "Door sticks" } });
    ok(rep2.fromClient === true && rep2.reportedByName.includes("CT Touring Co"), "it's marked as from the client");

    // Progress
    const P = id => `/api/repairs/${id}`;
    ok((await a(P(rep2.id), { method: "PATCH", body: JSON.stringify({ status: "scheduled" }) })).status === 400, "booking it in needs a date");
    r = await a(P(rep2.id), { method: "PATCH", body: JSON.stringify({ status: "scheduled", scheduledFor: "2099-06-02", resolution: "Dan to visit" }) });
    ok(r.status === 200 && (await json(r)).status === "scheduled", "booked in for a date");
    ok((await db.notification.count({ where: { userId: client.id, createdAt: { gte: since }, title: { contains: "Repair booked in" } } })) === 1, "the client is told it's booked in");
    ok((await a(P(rep2.id), { method: "PATCH", body: JSON.stringify({ status: "done", resolution: "" }) })).status === 200, "done keeps the earlier plan as what was done if nothing new is said");
    ok((await db.notification.count({ where: { userId: client.id, createdAt: { gte: since }, title: { contains: "Repair done" } } })) === 1, "the client is told it's done");
    const list = await json(await a(R));
    ok(list.repairs.length === 2 && list.jobs.length === 2, "the Aftercare list has both repairs");
    const page = await html(await a("/spaces/care-test/aftercare", { headers: { accept: "text/html" } }));
    ok(page.includes("Repairs &amp; aftercare") && page.includes("Castor snapped") && page.includes('href="/spaces/care-test/aftercare"'), "the Aftercare page and its menu link");

    // Tablet clocking
    const T = "/api/spaces/care-test/tablet";
    let t = await json(await a(T));
    ok(t.team.some(p => p.id === member.id) && t.jobs.length === 2, "the tablet lists the team and live builds");
    ok((await a(T, { method: "POST", body: JSON.stringify({ userId: free.id, action: "on", jobId: made.job.id }) })).status === 403, "only the workshop's team can be clocked on here");
    t = await json(await a(T, { method: "POST", body: JSON.stringify({ userId: member.id, action: "on", jobId: made.job.id }) }));
    ok(t.team.find(p => p.id === member.id).on?.jobId === made.job.id, "clocked on to the tour set");
    // Pretend it started 4h10m ago, then switch build: logs half a day on the first
    await db.clockEntry.updateMany({ where: { userId: member.id, endAt: null }, data: { startAt: new Date(Date.now() - (4 * 60 + 10) * 60e3) } });
    t = await json(await a(T, { method: "POST", body: JSON.stringify({ userId: member.id, action: "on", jobId: made.job2.id }) }));
    ok(t.logged?.days === 0.5 && t.team.find(p => p.id === member.id).on?.jobId === made.job2.id, "switching build logs half a day on the first and starts the second");
    await db.clockEntry.updateMany({ where: { userId: member.id, endAt: null }, data: { startAt: new Date(Date.now() - 7.9 * 3600e3) } });
    t = await json(await a(T, { method: "POST", body: JSON.stringify({ userId: member.id, action: "off" }) }));
    ok(t.logged?.days === 1 && !t.team.find(p => p.id === member.id).on, "clocking off after 7.9 hours logs a day");
    const entries = await db.timeEntry.findMany({ where: { userId: member.id, jobId: { in: [made.job.id, made.job2.id] } } });
    ok(entries.length === 2 && entries.every(e => /^Clocked \d\d:\d\d–\d\d:\d\d \(/.test(e.note)), "both are day entries on the builds, with the times in the note");
    ok((await a(T, { method: "POST", body: JSON.stringify({ userId: member.id, action: "off" }) })).status === 400, "can't clock off twice");
    await a(T, { method: "POST", body: JSON.stringify({ userId: member.id, action: "on", jobId: made.job.id }) });
    t = await json(await a(T, { method: "POST", body: JSON.stringify({ userId: member.id, action: "off" }) }));
    ok(t.logged?.days === 0, "a few seconds on is treated as a mistake and not logged");
    const tab = await html(await a("/spaces/care-test/tablet", { headers: { accept: "text/html" } }));
    ok(tab.includes("Who are you?"), "the tablet page");
  } finally {
    await db.user.update({ where: { id: member.id }, data: { homeEntityId: null } }).catch(() => {});
    await db.user.update({ where: { id: client.id }, data: { clientId: null } }).catch(() => {});
    await db.notification.deleteMany({ where: { createdAt: { gte: since }, OR: [{ title: { contains: "repair" } }, { title: { contains: "Repair" } }] } }).catch(() => {});
    for (const j of [made.job, made.job2]) if (j) await db.job.delete({ where: { id: j.id } }).catch(() => {});
    if (made.co) await db.client.delete({ where: { id: made.co.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
