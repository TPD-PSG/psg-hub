import { run, BASE } from "./lib.mjs";

// Audit round 2, step 4 (27 Nov 2026): a bad date or an empty request gets an answer, not a server
// error; the shared date rules (incl. the clocks changing); AI use is recorded by feature.
export default () => run("audit-round2-tidy", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , , admin] = users;
  const made = { todo: null, job: null };
  try {
    const r = await import("../lib/dateRules.ts");
    ok(r.addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString().startsWith("2026-02-28") && r.addMonths(new Date(), 0) === null, "one addMonths: end-of-month safe, none for 0");
    // Clocks go forward 29 Mar 2026 and back 25 Oct 2026: still whole UK days
    ok(r.daysUntilUk("2026-03-30T00:00:00Z", new Date("2026-03-28T23:30:00Z")) === 2 && r.daysUntilUk("2026-10-26T00:00:00Z", new Date("2026-10-24T23:30:00Z")) === 1, "UK days count correctly across the clocks changing");
    ok(r.daysUntilUk(new Date("2026-06-10T23:30:00Z"), new Date("2026-06-10T08:00:00Z")) === 1, "a late-evening UTC time is the next UK day in summer");
    ok(r.dueState("2026-06-20", 30, new Date("2026-06-01")) === "due" && r.dueState(null, 30) === "undated", "one due/expired rule");
    const core = await import("../lib/equipmentCore.ts");
    ok(core.addMonths === r.addMonths, "equipment checks use the same addMonths");

    const a = await login(admin.email);
    // A bad date no longer crashes a save
    let res = await a("/api/invoice-todos", { method: "POST", body: JSON.stringify({ client: "Audit tidy client", description: "x", dueDate: "not a date" }) });
    ok(res.status < 500, `a bad date on an invoice to-do gets an answer, not a server error (${res.status})`);
    if (res.ok) made.todo = (await res.json()).id;
    made.job = await db.job.create({ data: { number: "J-2099-921", title: "Audit tidy job", jobType: "other" } });
    res = await a(`/api/jobs/${made.job.id}/time`, { method: "POST", body: JSON.stringify({ date: "31/31/2026", days: 1 }) });
    ok(res.status === 400 && (await res.json()).error === "Pick the day worked", "a bad day on logged time asks for the day");
    // An empty request body gets an answer too
    res = await fetch(`${BASE}/api/invoice-todos`, { method: "POST", headers: { cookie: a.cookie } });
    ok(res.status < 500, `an empty request gets an answer, not a server error (${res.status})`);

    // AI use by feature on the status panel (no Claude call made here)
    const st = await (await a("/api/admin/status")).json();
    ok(Array.isArray(st.aiUsage), "the status panel reports AI use by feature");
  } finally {
    if (made.todo) await db.invoiceTodo.delete({ where: { id: made.todo } }).catch(() => {});
    await db.invoiceTodo.deleteMany({ where: { client: "Audit tidy client" } }).catch(() => {});
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
  }
});
