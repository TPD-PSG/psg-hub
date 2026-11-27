import { run } from "./lib.mjs";

// Audit round 2, step 2 (26 Nov 2026): budget variations move the budget exactly once and come
// back off when un-approved or deleted; shows and companies with safety records can't be deleted;
// people with time logged are deactivated, not deleted; the daily job names a failed section.
export default () => run("audit-round2-records", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , , admin] = users;
  const made = { prod: null, ent: null, job: null, temp: null };
  try {
    const a = await login(admin.email);
    const { summariseDaily } = await import("../lib/jobSummaries.ts");
    const fake = { ok: true, status: 200 };
    ok(summariseDaily(fake, { created: 3, failed: ["tenders"] }).ok === false && summariseDaily(fake, { created: 3, failed: ["tenders"] }).summary.includes("failed: tenders") && summariseDaily(fake, { created: 3, failed: [] }).ok, "a daily run with a failed section is marked failed and names it");

    // Budget variations
    made.prod = await db.production.create({ data: { name: "Audit variations show", type: "Other" } });
    const line = await db.budgetLine.create({ data: { productionId: made.prod.id, department: "LX", description: "Hire", budgeted: 1000 } });
    const v = await db.budgetVariation.create({ data: { productionId: made.prod.id, type: "additional_spend", status: "pending_approval", title: "More lamps", items: { create: [{ budgetLineId: line.id, amount: 200 }] } } });
    const put = body => a(`/api/budget-reallocation/${v.id}`, { method: "PUT", body: JSON.stringify(body) });
    const budget = async () => (await db.budgetLine.findUnique({ where: { id: line.id } })).budgeted;
    const [r1, r2] = await Promise.all([put({ status: "approved" }), put({ status: "approved" })]);
    ok(r1.status === 200 && r2.status === 200 && (await budget()) === 1200, "approving twice at once adds the amount once");
    await put({ status: "approved", notes: "edited" });
    ok((await budget()) === 1200, "editing an approved variation doesn't add it again");
    await put({ status: "pending_approval" });
    ok((await budget()) === 1000, "moving it back from approved takes the amount off");
    await put({ status: "approved" });
    ok((await budget()) === 1200, "approving again puts it back once");
    ok((await a(`/api/budget-reallocation/${v.id}`, { method: "DELETE" })).status === 200 && (await budget()) === 1000, "deleting an approved variation takes it off the budget");

    // A show with an incident report can't be deleted
    await db.incident.create({ data: { productionId: made.prod.id, year: 1996, number: 1, kind: "near_miss", occurredAt: new Date(), description: "x", reporterName: "x" } });
    const del = await a(`/api/productions/${made.prod.id}`, { method: "DELETE" });
    ok(del.status === 409 && (await del.json()).error.includes("accident/incident report"), "a show with accident reports can't be deleted");
    ok(!!(await db.production.findUnique({ where: { id: made.prod.id } })), "and it's still there");

    // Nor a company with machines (inductions and checks)
    made.ent = await db.entity.create({ data: { name: "Audit Records Co", slug: "audit-records", hasSpace: true } });
    await db.machine.create({ data: { entityId: made.ent.id, name: "Saw" } });
    const de = await a(`/api/entities/${made.ent.id}`, { method: "DELETE" });
    ok(de.status === 409 && (await de.json()).error.includes("machine"), "a company with machines can't be deleted");

    // People with time logged: deactivate, not delete
    made.temp = await db.user.create({ data: { email: "audit-temp@example.test", name: "Audit Temp", role: "member", passwordHash: (await db.user.findUnique({ where: { id: free.id } })).passwordHash } });
    made.job = await db.job.create({ data: { number: "J-2099-941", title: "Audit time job", jobType: "workshop", entityId: made.ent.id } });
    await db.timeEntry.create({ data: { jobId: made.job.id, userId: made.temp.id, date: new Date(), days: 1 } });
    const du = await a(`/api/users/${made.temp.id}`, { method: "DELETE" });
    const dj = await du.json();
    ok(du.status === 409 && dj.canDeactivate, "someone with days logged can't be deleted; deactivating is offered");
    ok((await db.timeEntry.count({ where: { userId: made.temp.id } })) === 1, "their days are kept");
    ok((await a(`/api/users/${admin.id}`, { method: "PATCH", body: JSON.stringify({ deactivated: true }) })).status === 400, "an admin can't deactivate themselves");
    ok((await a(`/api/users/${made.temp.id}`, { method: "PATCH", body: JSON.stringify({ deactivated: true }) })).status === 200, "an admin deactivates them");
    // The temp user shares the test password (its hash was copied), so the runner's login works for it
    const signedIn = async () => { try { const s = await login("audit-temp@example.test"); return !!(await (await s("/api/auth/session")).json())?.user; } catch { return false; } };
    ok(!(await signedIn()), "a deactivated person can't sign in");
    const list = await (await a("/api/users")).json();
    ok(list.find(u => u.id === made.temp.id)?.deactivatedAt, "admins see them marked deactivated");
    const fl = await (await (await login(free.email))("/api/users")).json();
    ok(!fl.some(u => u.id === made.temp.id), "and they drop out of everyone else's pickers");
    await a(`/api/users/${made.temp.id}`, { method: "PATCH", body: JSON.stringify({ deactivated: false }) });
    ok(await signedIn(), "reactivated, they can sign in again");
  } finally {
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    if (made.temp) await db.user.delete({ where: { id: made.temp.id } }).catch(() => {});
    await db.incident.deleteMany({ where: { year: 1996 } }).catch(() => {});
    if (made.prod) await db.production.delete({ where: { id: made.prod.id } }).catch(() => {});
    if (made.ent) await db.entity.delete({ where: { id: made.ent.id } }).catch(() => {});
  }
});
