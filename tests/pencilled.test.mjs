import { run } from "./lib.mjs";

// Pencilled dates in the TWS planner: parts added while a build is at Quote are tentative; they
// become bookings (same person, same days) when the quote's accepted or the build moves on.
export default () => run("pencilled", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , member, admin] = users;
  const a = await login(admin.email);
  const json = r => r.json();
  const made = { e: null, jobs: [], quote: null };
  try {
    made.e = await db.entity.create({ data: { name: "Pencil test co", slug: "pencil-test", hasSpace: true } });
    const j1 = await db.job.create({ data: { number: "J-2099-961", title: "PT quoting build", jobType: "workshop", entityId: made.e.id, stage: "quote" } });
    const j2 = await db.job.create({ data: { number: "J-2099-962", title: "PT confirmed build", jobType: "workshop", entityId: made.e.id, stage: "build" } });
    const j3 = await db.job.create({ data: { number: "J-2099-963", title: "PT moved by hand", jobType: "workshop", entityId: made.e.id, stage: "quote" } });
    made.jobs.push(j1.id, j2.id, j3.id);
    const add = (j, body) => a(`/api/jobs/${j}/parts`, { method: "POST", body: JSON.stringify(body) });

    let p1 = await json(await add(j1.id, { label: "Truck frames", days: 3, userId: member.id, startDate: "2099-03-02" }));
    ok(p1.pencilled === true && p1.startDate.startsWith("2099-03-02") && p1.days === 3, "a part added while quoting is pencilled, with the day and length you chose");
    const p2 = await json(await add(j2.id, { label: "Paint", days: 2 }));
    ok(p2.pencilled === false, "a part on a confirmed build is a booking");
    const p3 = await json(await add(j1.id, { label: "Flats", days: 1, pencilled: false }));
    ok(p3.pencilled === false, "you can add a confirmed part to a build being quoted");
    let r = await a(`/api/jobs/${j2.id}/parts/${p2.id}`, { method: "PATCH", body: JSON.stringify({ pencilled: true }) });
    ok((await json(r)).pencilled === true, "any part can be pencilled by hand");

    const plan = await json(await a("/api/spaces/pencil-test/planner?from=2099-03-02"));
    ok(plan.parts.find(x => x.id === p1.id)?.pencilled === true && plan.jobs.find(j => j.id === j1.id)?.stage === "quote", "the planner knows which parts are pencilled and which builds are quoting");

    // Quote accepted: pencils confirmed, dates unchanged
    made.quote = await db.quote.create({ data: { number: "Q-2099-961", title: "PT quote", entityId: made.e.id, jobId: j1.id, status: "sent", lines: { create: [{ description: "Build", quantity: 1, unitCost: 1, unitPrice: 2 }] } } });
    r = await a(`/api/quotes/${made.quote.id}`, { method: "PUT", body: JSON.stringify({ status: "accepted" }) });
    ok(r.status === 200, "the quote is accepted");
    p1 = await db.buildPart.findUnique({ where: { id: p1.id } });
    const job1 = await db.job.findUnique({ where: { id: j1.id } });
    ok(job1.stage === "confirmation" && p1.pencilled === false && p1.startDate.toISOString().startsWith("2099-03-02") && p1.days === 3 && p1.userId === member.id, "accepting the quote confirms the pencilled part: same person, day and length");
    ok((await db.buildPart.findUnique({ where: { id: p2.id } })).pencilled === true, "other builds' pencils are left alone");

    // Moving a build past Quote by hand also confirms
    const p4 = await json(await add(j3.id, { label: "Rostra", days: 2 }));
    ok(p4.pencilled === true, "pencilled on the second quoting build");
    r = await a(`/api/jobs/${j3.id}/build`, { method: "PATCH", body: JSON.stringify({ stage: "confirmation" }) });
    ok(r.status === 200 && (await db.buildPart.findUnique({ where: { id: p4.id } })).pencilled === false, "moving the build to Confirmation confirms its pencils");
  } finally {
    if (made.quote) await db.quote.delete({ where: { id: made.quote.id } }).catch(() => {});
    for (const id of made.jobs) await db.job.delete({ where: { id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
