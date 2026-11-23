import { run } from "./lib.mjs";

// Productions list: who sees what (API and the server-rendered page), budget hiding, and who may create
export default () => run("production-list", async ({ db, users, login, check, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [f, c, a] = [await login(users[0].email), await login(users[1].email), await login(users[3].email)];
  const line = await db.budgetLine.create({ data: { productionId: 1, department: "Test", description: "secret-budget-line-xyz", budgeted: 1234 } });
  const created = [];
  try {
    const fl = await (await f("/api/productions")).json();
    ok(fl.length >= 1 && fl.every(p => p.team.some(m => m.user.id === users[0].id)), "freelancer list: only productions they're on");
    ok(fl.every(p => p.budgetLines.length === 0), "freelancer list: no budget lines");
    const al = await (await a("/api/productions")).json();
    ok(al.find(p => p.id === 1)?.budgetLines.some(b => b.id === line.id), "admin list: budget lines included");
    const cl = await (await c("/api/productions")).json();
    ok(Array.isArray(cl) && cl.length === 0, "client on no team: empty list");

    const page = async (who, path) => (await who(path, { headers: { accept: "text/html" } })).text();
    const prod1 = (await db.production.findUnique({ where: { id: 1 }, select: { name: true } })).name;
    const fh = await page(f, "/productions");
    ok(fh.includes(prod1) && !fh.includes("secret-budget-line-xyz"), "freelancer page: production listed, budget not in the page data");
    ok(!(await page(c, "/productions")).includes(prod1), "client page: production not listed");

    await check("freelancer", "create a production", f("/api/productions", { method: "POST", body: JSON.stringify({ name: "x", type: "Play" }) }), 403);
    await check("client", "create a production", c("/api/productions", { method: "POST", body: JSON.stringify({ name: "x", type: "Play" }) }), 403);
    const r = await a("/api/productions", { method: "POST", body: JSON.stringify({ name: "Test production (delete me)", type: "Play" }) });
    const p = await r.json(); if (p?.id) created.push(p.id);
    ok(r.status === 201, "admin can still create a production");
  } finally {
    await db.budgetLine.delete({ where: { id: line.id } }).catch(() => {});
    for (const id of created) await db.production.delete({ where: { id } }).catch(() => {});
  }
});
