import { run } from "./lib.mjs";

// Workshop calendar (28 Nov 2026): builds → pieces → discipline stages with dates. A workshop's
// disciplines start with the six defaults; a quote item's labour lines named after a discipline
// become that stage on the item's piece; staff date, size, staff and tick stages; freelancers can't.
export default () => run("workshop-calendar", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , , admin] = users;
  let e = null, other = null;
  const a = await login(admin.email);
  const json = r => r.json();
  try {
    const wc = await import("../lib/workshopDisciplines.ts");
    const D = wc.DEFAULT_DISCIPLINES.map((d, i) => ({ id: i + 1, name: d.name }));
    const name = s => wc.disciplineFor(s, D)?.name ?? null;
    ok(name("Carpenter") === "Carpentry" && name("CNC cutting") === "CNC" && name("Scenic artist") === "Scenic" && name("Technical drawing") === "Technical drawing" && name("Welding") === "Fabrication", "labour lines are matched to disciplines ('Carpenter', 'CNC cutting', 'Welding'…)");
    ok(name("Delivery driver") === null, "a line that isn't a discipline isn't one");

    e = await db.entity.create({ data: { name: "WC test workshop", slug: "wc-test", hasSpace: true } });
    other = await db.entity.create({ data: { name: "WC other workshop", slug: "wc-other", hasSpace: true } });
    let r = await a("/api/spaces/wc-test/calendar");
    const cal = await json(r);
    ok(r.status === 200 && cal.disciplines.map(d => d.name).join() === "Pre-production,Technical drawing,CNC,Carpentry,Fabrication,Scenic", "a workshop starts with Rich's six disciplines");
    await db.user.update({ where: { id: free.id }, data: { homeEntityId: e.id } });
    const f = await login(free.email);
    ok((await f("/api/spaces/wc-test/calendar")).status === 403, "freelancers don't get the whole calendar");

    // A quote item's labour lines become stages on its piece
    const job = await json(await a("/api/jobs", { method: "POST", body: JSON.stringify({ title: "WC build", jobType: "workshop", entityId: e.id }) }));
    const L = (description, quantity, unit) => ({ section: "Throne", description, quantity, unit, unitCost: 25, unitPrice: 40, kind: "labour" });
    const q = await json(await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "WC quote", entityId: e.id, jobId: job.id, lines: [L("Carpentry", 2, "days"), L("CNC cutting", 4, "hours"), L("General labour", 1, "day")] }) }));
    let part = await db.buildPart.findFirst({ where: { jobId: job.id }, include: { stages: { include: { discipline: true }, orderBy: { sortOrder: "asc" } } } });
    ok(part?.stages.map(s => `${s.discipline.name}:${s.hours}`).join() === "CNC:4,Carpentry:16", "the item's piece gets a stage per discipline named on its labour lines, in the workshop's order");
    const cnc = part.stages.find(s => s.discipline.name === "CNC"), carp = part.stages.find(s => s.discipline.name === "Carpentry");
    ok(carp.days === 2 && cnc.days === 1, "each stage's days come from its hours");

    // PM jobs don't get parts
    const pm = await json(await a("/api/jobs", { method: "POST", body: JSON.stringify({ title: "WC PM job", jobType: "pm", entityId: e.id }) }));
    await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "WC PM quote", entityId: e.id, jobId: pm.id, lines: [{ section: "Fee", description: "PM", quantity: 1, unitPrice: 100 }] }) });
    ok((await db.buildPart.count({ where: { jobId: pm.id } })) === 0, "a production-management job's quote makes no parts");

    // Date, size, staff and tick a stage
    r = await a(`/api/spaces/wc-test/stages/${carp.id}`, { method: "PATCH", body: JSON.stringify({ startDate: "2099-03-02", days: 3, userId: admin.id, status: "on" }) });
    const s1 = await json(r);
    ok(r.status === 200 && s1.startDate.startsWith("2099-03-02") && s1.days === 3 && s1.user?.id === admin.id && s1.status === "on", "staff date, lengthen, staff and start a stage");
    ok((await a(`/api/spaces/wc-test/stages/${carp.id}`, { method: "PATCH", body: JSON.stringify({ days: 0 }) })).status === 400, "a stage is at least a day");
    ok((await a(`/api/spaces/wc-other/stages/${carp.id}`, { method: "PATCH", body: JSON.stringify({ days: 2 }) })).status === 404, "a stage can't be changed from another workshop's calendar");
    ok((await f(`/api/spaces/wc-test/stages/${carp.id}`, { method: "PATCH", body: JSON.stringify({ days: 2 }) })).status === 403, "freelancers can't move stages");

    // Re-saving the quote: the dated stage keeps its days; an undated stage no longer quoted goes
    await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ lines: [L("Carpentry", 1, "days")] }) });
    part = await db.buildPart.findFirst({ where: { jobId: job.id }, include: { stages: { include: { discipline: true } } } });
    const carp2 = part.stages.find(s => s.id === carp.id);
    ok(carp2?.days === 3 && carp2.hours === 8 && !part.stages.some(s => s.discipline.name === "CNC"), "a dated stage keeps its days (hours follow the quote); an untouched stage taken off the quote goes");

    // Add one by hand, and the calendar shows it
    const scenic = cal.disciplines.find(d => d.name === "Scenic");
    r = await a("/api/spaces/wc-test/stages", { method: "POST", body: JSON.stringify({ partId: part.id, disciplineId: scenic.id }) });
    ok(r.status === 201, "a stage can be added to a piece by hand");
    const cal2 = await json(await a("/api/spaces/wc-test/calendar?from=2099-03-04&weeks=4"));
    const p2 = cal2.jobs.find(j => j.id === job.id)?.parts[0];
    ok(cal2.from === "2099-03-02" && p2?.stages.length === 2, "the calendar starts on a Monday and shows each piece's stages");
    ok(!cal2.jobs.some(j => j.id === pm.id), "only workshop builds are on it");

    // The workshop's own list
    r = await a("/api/spaces/wc-test/disciplines", { method: "POST", body: JSON.stringify({ name: "Upholstery", color: "#aa3366" }) });
    const up = await json(r);
    ok(r.status === 201 && (await a("/api/spaces/wc-test/disciplines", { method: "POST", body: JSON.stringify({ name: "upholstery" }) })).status === 409, "a discipline can be added (no doubles)");
    await a(`/api/spaces/wc-test/disciplines/${up.id}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
    ok(!(await json(await a("/api/spaces/wc-test/calendar"))).disciplines.find(d => d.id === up.id && !d.archived), "a discipline can be stopped");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    await db.user.update({ where: { id: free.id }, data: { homeEntityId: null } }).catch(() => {});
    for (const x of [e, other]) if (x) {
      await db.quote.deleteMany({ where: { entityId: x.id } });
      await db.job.deleteMany({ where: { entityId: x.id } });
      await db.entity.delete({ where: { id: x.id } }).catch(() => {});
    }
  }
});
