import { run } from "./lib.mjs";

// Workshop calendar part 2 (28 Nov 2026): the person on a stage (or staff) reports it running late
// (noted straight away, managers told) or asks to reschedule (a workshop manager approves or
// declines; approving moves it). Workshop managers default to admins until ticked. The calendar
// carries each build's references (drawings, design files, scenic reference links).
export default () => run("stage-requests", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  let e = null;
  const json = r => r.json();
  const since = new Date();
  const told = async (uid, re) => (await db.notification.findMany({ where: { userId: uid, createdAt: { gte: since } } })).filter(n => re.test(n.title)).length;
  try {
    e = await db.entity.create({ data: { name: "SR test workshop", slug: "sr-test", hasSpace: true } });
    await db.user.updateMany({ where: { id: { in: [free.id, member.id] } }, data: { homeEntityId: e.id } });
    const a = await login(admin.email), f = await login(free.email), m = await login(member.email), c = await login(client.email);
    await a("/api/spaces/sr-test/calendar"); // makes the default disciplines
    const cnc = await db.workshopDiscipline.findFirst({ where: { entityId: e.id, name: "CNC" } });
    const job = await db.job.create({ data: { number: "J-SR-1", title: "SR build", jobType: "workshop", entityId: e.id, stage: "build" } });
    const part = await db.buildPart.create({ data: { jobId: job.id, label: "SR flat" } });
    const st = await db.partStage.create({ data: { partId: part.id, disciplineId: cnc.id, startDate: new Date("2099-05-04"), days: 2, userId: free.id } });
    const other = await db.partStage.create({ data: { partId: part.id, disciplineId: cnc.id + 1, startDate: new Date("2099-05-06"), days: 1 } });
    const req = (who, id, body) => who(`/api/spaces/sr-test/stages/${id}/requests`, { method: "POST", body: JSON.stringify(body) });

    // Running late
    let r = await req(f, st.id, { kind: "late", newEnd: "2099-05-08", reason: "Router bit broke" });
    ok(r.status === 201 && (await db.partStage.findUnique({ where: { id: st.id } })).lateUntil?.toISOString().startsWith("2099-05-08"), "the person on a stage reports it running late; it shows late straight away");
    ok(await told(admin.id, /^Running late: CNC · SR flat/) === 1, "with no managers chosen, the admins are told");
    ok((await req(f, st.id, { kind: "late", newEnd: "2099-05-01", reason: "x" })).status === 400, "it can't finish before it starts");
    ok((await req(f, other.id, { kind: "late", newEnd: "2099-05-09", reason: "x" })).status === 403, "a freelancer can't report on someone else's stage");
    ok((await req(c, st.id, { kind: "late", newEnd: "2099-05-09", reason: "x" })).status === 403, "people outside the workshop can't");

    // Reschedule
    r = await req(f, st.id, { kind: "reschedule", newStart: "2099-05-11", newDays: 3, reason: "Steel late" });
    const rq = await json(r);
    ok(r.status === 201 && rq.status === "open", "they can ask to reschedule");
    ok((await req(f, st.id, { kind: "reschedule", newStart: "2099-05-12", newDays: 1, reason: "again" })).status === 409, "one waiting request per stage");
    const decide = (who, id, decision) => who(`/api/spaces/sr-test/stage-requests/${id}`, { method: "PATCH", body: JSON.stringify({ decision }) });
    ok((await decide(f, rq.id, "approved")).status === 403 && (await decide(m, rq.id, "approved")).status === 403, "only a workshop manager decides (admins until managers are chosen)");
    r = await decide(a, rq.id, "approved");
    const moved = await db.partStage.findUnique({ where: { id: st.id } });
    ok(r.status === 200 && moved.startDate.toISOString().startsWith("2099-05-11") && moved.days === 3 && moved.lateUntil === null, "approving moves the stage and clears the late flag");
    ok(await told(free.id, /^Reschedule approved/) === 1, "the person who asked is told");
    ok((await decide(a, rq.id, "declined")).status === 409, "a request is decided once");

    // Choosing managers
    ok((await m("/api/spaces/sr-test/managers", { method: "PATCH", body: JSON.stringify({ userId: member.id, manager: true }) })).status === 403, "only admins choose managers");
    await a("/api/spaces/sr-test/managers", { method: "PATCH", body: JSON.stringify({ userId: member.id, manager: true }) });
    const rq2 = await json(await req(f, st.id, { kind: "reschedule", newStart: "2099-05-18", newDays: 2, reason: "Holiday" }));
    ok(await told(member.id, /^Reschedule asked/) === 1, "once chosen, the workshop manager is told");
    ok((await decide(m, rq2.id, "declined")).status === 200 && (await db.partStage.findUnique({ where: { id: st.id } })).startDate.toISOString().startsWith("2099-05-11"), "the manager can decline; the stage stays put");

    // Done clears a late flag
    await req(f, st.id, { kind: "late", newEnd: "2099-05-20", reason: "Still waiting" });
    await a(`/api/spaces/sr-test/stages/${st.id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) });
    ok((await db.partStage.findUnique({ where: { id: st.id } })).lateUntil === null, "ticking a stage done clears its late flag");

    // My work and the calendar
    const mw = await json(await f("/api/spaces/sr-test/my-work"));
    ok(mw.me === free.id && mw.parts.some(p => p.label === "SR flat" && p.stages.some(s => s.id === st.id)), "a freelancer sees the pieces they have a stage on, with the stages, in My work");
    await a(`/api/jobs/${job.id}/links`, { method: "POST", body: JSON.stringify({ label: "Paint refs", url: "https://example.com/refs", kind: "scenic" }) });
    const cal = await json(await a("/api/spaces/sr-test/calendar?from=2099-05-04"));
    const cj = cal.jobs.find(j => j.id === job.id);
    ok(cal.canDecide && cj.links.some(l => l.kind === "scenic" && l.label === "Paint refs"), "the calendar carries each build's references, scenic links included");
    ok(cj.parts[0].stages.find(s => s.id === st.id).requests.length >= 1, "and each stage's requests");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    await db.user.updateMany({ where: { id: { in: [free.id, member.id] } }, data: { homeEntityId: null, workshopManager: false } }).catch(() => {});
    if (e) {
      await db.job.deleteMany({ where: { entityId: e.id } });
      await db.entity.delete({ where: { id: e.id } }).catch(() => {});
    }
  }
});
