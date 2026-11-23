import { run, BASE } from "./lib.mjs";

export default () => run("permissions", async ({ db, users, login, anon, check, results }) => {
  const f = await login(users[0].email), c = await login(users[1].email), m = await login(users[2].email), a = await login(users[3].email);
  await db.productionTeam.upsert({ where: { productionId_userId: { productionId: 1, userId: users[2].id } }, create: { productionId: 1, userId: users[2].id }, update: {} });
  const otherStop = await db.tourStop.findFirst({ where: { productionId: { not: 1 } }, select: { id: true, venueId: true } });
  const otherReport = await db.showReport.findFirst({ where: { productionId: { not: 1 } }, select: { id: true } });
  const ownLine = await db.budgetLine.findFirst({ where: { productionId: 1 }, select: { id: true } });
  const otherLine = await db.budgetLine.findFirst({ where: { productionId: { not: 1 } }, select: { id: true } });
  const json = async p => { const r = await p; return { r, d: await r.json().catch(() => null) }; };

  // users list
  { const { d } = await json(f("/api/users")); results.push(`${Array.isArray(d) && !("email" in d[0]) && !("role" in d[0]) ? "PASS" : "FAIL"}  freelancer users list has no email/role`); }
  { const { d } = await json(m("/api/users")); results.push(`${Array.isArray(d) && ("email" in d[0]) && !("permissions" in d[0]) ? "PASS" : "FAIL"}  member     users list: email, no permissions`); }
  { const { d } = await json(a("/api/users")); results.push(`${Array.isArray(d) && ("permissions" in d[0]) ? "PASS" : "FAIL"}  admin      users list full`); }
  // self-guarded routes reachable without login
  await check("public", "invite page", anon("/invite/not-a-token"), 200);
  await check("public", "invite token api (bad token)", anon("/api/invites/not-a-token"), 404);
  await check("public", "notify/daily without secret", anon("/api/notify/daily", { method: "POST" }), 401);
  await check("public", "backup without secret", anon("/api/backup", { method: "POST" }), 401);
  await check("public", "productions still need login", anon("/api/productions"), 307);
  // module gating
  await check("member", "finance invoices (no finance module)", m("/api/invoices"), 403);
  await check("member", "bd opportunities (no bd module)", m("/api/opportunities"), 403);
  await check("member", "read clients via productions", m("/api/clients"), 200);
  await check("member", "create client (no bd module)", m("/api/clients", { method: "POST", body: "{}" }), 403);
  await check("member", "venues read via productions", m("/api/venues"), 200);
  await check("freelancer", "crew database (staff only)", f("/api/crew"), 403);
  await check("freelancer", "haulage list (staff only)", f("/api/haulage"), 403);
  await check("freelancer", "property (no module)", f("/api/property"), 403);
  await check("admin", "finance invoices", a("/api/invoices"), 200);
  // hidden sections
  { const { d } = await json(f("/api/productions/1")); results.push(`${d && Array.isArray(d.budgetLines) && d.budgetLines.length === 0 && d.crew.length === 0 ? "PASS" : "FAIL"}  freelancer production 1 payload has no budget/crew`); }
  { const { d } = await json(a("/api/productions/1")); results.push(`${d && d.budgetLines.length > 0 ? "PASS" : "WARN"}  admin production 1 payload keeps budget (${d?.budgetLines?.length} lines)`); }
  await check("freelancer", "own production crew tab", f("/api/productions/1/crew", { method: "POST", body: "{}" }), 403);
  await check("freelancer", "own production show reports", f("/api/productions/1/show-reports"), 200);
  // record-level team checks
  if (otherReport) await check("freelancer", "other prod's show report pdf", f(`/api/show-reports/${otherReport.id}/pdf`), 403);
  if (otherStop) await check("freelancer", "edit other prod's tour stop", f(`/api/tour-stops/${otherStop.id}`, { method: "PUT", body: "{}" }), 403);
  if (otherLine) await check("member", "edit other prod's budget line", m(`/api/budget-lines/${otherLine.id}`, { method: "PUT", body: "{}" }), 403);
  if (ownLine) await check("member", "edit missing budget line 404", m(`/api/budget-lines/99999999`, { method: "PUT", body: "{}" }), 404);
  await check("freelancer", "create task on other production", f("/api/tasks", { method: "POST", body: JSON.stringify({ title: "x", productionId: 2 }) }), 403);
  await check("member", "reallocations other production", m("/api/budget-reallocation?productionId=2"), 403);
  // venue delete with tour stops
  if (otherStop) await check("admin", "delete venue that has tour stops", a(`/api/venues/${otherStop.venueId}`, { method: "DELETE" }), 409);
  results.push(`info: otherStop=${!!otherStop} otherReport=${!!otherReport} ownLine=${!!ownLine} otherLine=${!!otherLine}`);
});
