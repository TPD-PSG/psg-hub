import { run } from "./lib.mjs";

// Admin → Users "Company spaces": a person can be limited to some companies' spaces. The limit
// covers every way into a space (pages, APIs, stock and PO links, top bar, Home) and applies at
// once; admins are never limited; productions, BD and jobs are unaffected.
export default () => run("space-limits", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const made = { A: null, B: null, item: null, po: null, job: null };
  const before = await db.user.findMany({ where: { id: { in: [member.id, free.id] } }, select: { id: true, permissions: true, homeEntityId: true } });
  const setLimit = async (userId, ids) => {
    const u = await db.user.findUnique({ where: { id: userId }, select: { permissions: true } });
    const p = u.permissions ? JSON.parse(u.permissions) : { modules: ["bd", "productions", "venues", "tasks", "property", "finance", "sales", "marketing", "roadmap", "suppliers", "fun", "ask"], allProductions: true };
    if (ids === undefined) delete p.spaceEntityIds; else p.spaceEntityIds = ids;
    await db.user.update({ where: { id: userId }, data: { permissions: JSON.stringify(p) } });
  };
  try {
    made.A = await db.entity.create({ data: { name: "Limit test A", slug: "limit-a", hasSpace: true, shortName: "LTA" } });
    made.B = await db.entity.create({ data: { name: "Limit test B", slug: "limit-b", hasSpace: true, shortName: "LTB" } });
    made.item = await db.stockItem.create({ data: { entityId: made.A.id, name: "A ply", quantity: 5 } });
    made.po = await db.purchaseOrder.create({ data: { number: "PO-2099-990", entityId: made.A.id, status: "draft", lines: { create: [{ description: "x", quantity: 1, unitCost: 1 }] } } });
    made.job = await db.job.create({ data: { number: "J-2099-990", title: "Limit test job", jobType: "workshop", entityId: made.A.id } });

    ok((await m("/api/spaces/limit-a")).status === 200, "no limit: staff open every space");
    await setLimit(member.id, [made.B.id]);
    ok((await m("/api/spaces/limit-a")).status === 403 && (await m("/api/spaces/limit-b")).status === 200, "limited to B: can't open A, can open B (applies at once)");
    ok((await m("/spaces/limit-a", { headers: { accept: "text/html" } })).status === 404, "A's space page isn't there for them");
    for (const [label, url, opt] of [
      ["planner", "/api/spaces/limit-a/planner"], ["materials", "/api/spaces/limit-a/materials"], ["noticeboard", "/api/spaces/limit-a/noticeboard"],
      ["stock item", `/api/stock/${made.item.id}`, { method: "PATCH", body: JSON.stringify({ name: "hacked" }) }],
      ["stock move", `/api/stock/${made.item.id}/moves`, { method: "POST", body: JSON.stringify({ kind: "count", quantity: 1 }) }],
      ["purchase order", `/api/purchase-orders/${made.po.id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) }],
      ["build materials", `/api/jobs/${made.job.id}/materials`],
    ]) ok((await m(url, opt)).status === 403, `A's ${label} refused`);
    ok((await db.stockItem.findUnique({ where: { id: made.item.id } })).name === "A ply", "A's stock untouched");
    const list = await json(await m("/api/spaces"));
    ok(list.some(s => s.slug === "limit-b") && !list.some(s => s.slug === "limit-a"), "only B in their spaces list (Fun Corner)");
    const page = await (await m("/productions", { headers: { accept: "text/html" } })).text();
    ok(page.includes('href="/spaces/limit-b"') && !page.includes('href="/spaces/limit-a"'), "top bar only offers B");
    const rows = (await json(await m("/api/dashboard/entities"))).rows ?? [];
    ok(rows.find(r => r.entityId === made.A.id)?.spaceSlug === null && rows.find(r => r.entityId === made.B.id)?.spaceSlug === "limit-b", "Home companies table only links B's space");
    ok((await m(`/api/jobs/${made.job.id}`)).status === 200, "jobs themselves are unaffected");

    await setLimit(member.id, []);
    ok((await m("/api/spaces/limit-b")).status === 403, "nothing ticked: no spaces");
    await setLimit(admin.id, []);
    ok((await a("/api/spaces/limit-a")).status === 200, "admins are never limited");

    // Home company outside the limit: no landing there
    await db.user.update({ where: { id: free.id }, data: { homeEntityId: made.A.id } });
    await setLimit(free.id, [made.B.id]);
    ok((await f("/api/spaces/limit-a")).status === 403, "a freelancer whose company is A but limited to B can't open A");
    const home = await f("/", { headers: { accept: "text/html" }, redirect: "manual" });
    ok(!(home.headers.get("location") ?? "").includes("/spaces/limit-a"), "…and doesn't land on it");

    await setLimit(member.id, undefined);
    ok((await m("/api/spaces/limit-a")).status === 200, "back to All: every space again");
  } finally {
    for (const b of before) await db.user.update({ where: { id: b.id }, data: { permissions: b.permissions, homeEntityId: b.homeEntityId } }).catch(() => {});
    await setLimit(admin.id, undefined).catch(() => {});
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    for (const e of [made.A, made.B]) if (e) {
      await db.purchaseOrder.deleteMany({ where: { entityId: e.id } }).catch(() => {});
      await db.entity.delete({ where: { id: e.id } }).catch(() => {});
    }
  }
});
