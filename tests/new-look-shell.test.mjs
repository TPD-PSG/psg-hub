import { run } from "./lib.mjs";

// New look stage 3 checks (build brief): every tile in the navigation map is reachable in two
// clicks or fewer; every old URL still opens the right page with the new look on; search finds
// things and shows nothing a person can't see.
const MAP_ROUTES = [
  "/", "/tasks", "/productions?mine=1", "/productions", "/venues", "/hotels", "/haulage", "/calendar", "/schedule", "/jobs",
  "/bd", "/sales", "/sales?tab=tasks", "/finance", "/finance?tab=purchase", "/finance?tab=expenses", "/property", "/suppliers",
  "/health-safety", "/compliance", "/marketing", "/marketing?view=list", "/roadmap", "/helpdesk", "/ask", "/fun",
  "/director", "/admin/users", "/admin/settings",
];

export default () => run("new-look-shell", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const nav = await import("../lib/newLookNav.ts");
  const groups = nav.navFor({ role: "admin" });
  const clicks = href => {
    for (const g of groups) for (const i of g.items) {
      if (i.href === href) return 1;
      if (i.subs?.some(s => s.href === href)) return 2;
    }
    return 99;
  };
  const far = MAP_ROUTES.filter(r => clicks(r) > 2);
  ok(far.length === 0, `every tile in the navigation map is two clicks or fewer${far.length ? ` (not: ${far.join(", ")})` : ""}`);
  ok(groups.map(g => `${g.label ?? "top"}:${g.items.length}`).join() === "top:3,Work:4,Money:1,Company:5", "the brief's table: Home, My tasks, My productions, then Work, Money and Company (Spaces added per person)");
  const fl = nav.navFor({ role: "freelancer" }).flatMap(g => g.items.map(i => i.key));
  ok(!fl.includes("finance") && !fl.includes("admin") && !fl.includes("jobs") && fl.includes("home"), "items a role can't use are hidden, not greyed out");
  ok(nav.activeKey(groups, "/productions", "mine=1") === "mine" && nav.activeKey(groups, "/productions", "") === "productions" && nav.activeKey(groups, "/bd/quotes") === "jobs", "the right item is marked for each page");
  ok(nav.navPages(groups).some(p => p.label === "Finance › Expenses" && p.words.includes("expenses")), "search knows the menu's pages ('expenses' → Finance › Expenses)");

  try {
    await db.user.update({ where: { id: admin.id }, data: { preferences: JSON.stringify({ newLook: true }) } });
    const a = await login(admin.email);
    const broken = [];
    for (const r of [...MAP_ROUTES, "/productions/1?section=schedule", "/productions/1?section=budget", "/productions/new", "/bd/quotes"]) {
      const res = await a(r, { headers: { accept: "text/html" } });
      if (res.status !== 200) broken.push(`${r} ${res.status}`);
    }
    ok(broken.length === 0, `with the new look on, every old URL still opens${broken.length ? ` (not: ${broken.join(", ")})` : ""}`);
    const html = await (await a("/productions/1?section=budget", { headers: { accept: "text/html" } })).text();
    ok(html.includes("data-new-look") && html.includes('aria-label="Main"'), "the page is in the new shell");

    // Search
    const prod = await db.production.findUnique({ where: { id: 1 }, select: { name: true } });
    const q = prod.name.slice(0, 6);
    const hits = (await (await a(`/api/search?q=${encodeURIComponent(q)}`)).json()).results;
    ok(hits.some(h => h.type === "Productions" && h.href === "/productions/1"), "search finds productions");
    ok((await (await a("/api/search?q=a")).json()).results.length === 0, "one letter finds nothing (two or more)");
    await db.companyInvoice.create({ data: { type: "sales", description: "NLS test invoice", party: "NLS client", netAmount: 10 } }).catch(() => null);
    const f = await login(free.email);
    const fh = (await (await f("/api/search?q=NLS")).json()).results;
    ok(!fh.some(h => h.type === "Invoices" || h.type === "Deals" || h.type === "People"), "freelancers don't find invoices, deals or people");
    ok((await (await a("/api/search?q=NLS")).json()).results.some(h => h.type === "Invoices"), "finance people do find invoices");
    const counts = await (await login(member.email))("/api/nav-counts").then(r => r.json());
    ok(typeof counts.productions === "number" && counts.finance === null && counts.deals === null, "sidebar counts only for areas a person can use");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    await db.user.update({ where: { id: admin.id }, data: { preferences: null } }).catch(() => {});
    await db.companyInvoice.deleteMany({ where: { description: "NLS test invoice" } }).catch(() => {});
  }
});
