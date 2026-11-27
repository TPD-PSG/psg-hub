import { run } from "./lib.mjs";

// New look stage 5 checks (build brief): all 16 current sections open from the grouped menu;
// ?section= links still land on the right section; a production opens on its Overview in the new
// look (and still on Schedule in the old); the Overview leaves out sections hidden for the person.
const SECTIONS = ["schedule", "tour", "advancing", "callsheets", "crew", "contacts", "accommodation", "budget", "haulage", "documents", "links", "hs", "reports", "tasks", "notes", "meetings"];

export default () => run("new-look-production", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , , admin] = users;
  const nav = await import("../lib/newLookNav.ts");
  const keys = nav.PRODUCTION_GROUPS.flatMap(g => g.sections.map(s => s.key));
  ok(SECTIONS.every(s => keys.includes(s)) && keys.includes("overview") && keys.length === 17, "the grouped menu holds all 16 sections, plus Overview");
  ok(nav.PRODUCTION_GROUPS.map(g => g.label).join() === "Plan,People,Money,Logistics,Records,Work", "grouped as the brief: Plan, People, Money, Logistics, Records, Work");
  try {
    await db.user.update({ where: { id: admin.id }, data: { preferences: JSON.stringify({ newLook: true }) } });
    const a = await login(admin.email);
    const page = async (who, q) => (await (await who(`/productions/1${q}`, { headers: { accept: "text/html" } })).text()).replace(/<!-- -->/g, "");
    const wrong = [];
    for (const s of SECTIONS) {
      const h = await page(a, `?section=${s}`);
      // The menu marks the section the link landed on
      const m = h.match(new RegExp(`href="/productions/1\\?section=${s}"[^>]*aria-current="page"|aria-current="page"[^>]*href="/productions/1\\?section=${s}"`));
      if (!m) wrong.push(s);
    }
    ok(wrong.length === 0, `every ?section= link opens and lands on its section${wrong.length ? ` (not: ${wrong.join(", ")})` : ""}`);
    ok(/aria-current="page"[^>]*href="\/productions\/1\?section=overview"|href="\/productions\/1\?section=overview"[^>]*aria-current="page"/.test(await page(a, "")), "in the new look a production opens on Overview");

    const ov = await (await a("/api/productions/1/overview")).json();
    ok(ov && "now" in ov && "budget" in ov && "tasks" in ov && "week" in ov, "the Overview has its tiles and panels");
    // A freelancer on the team: budget and crew are hidden for them, so the Overview leaves them out
    await db.productionTeam.create({ data: { productionId: 1, userId: free.id } }).catch(() => {});
    const f = await login(free.email);
    const fo = await (await f("/api/productions/1/overview")).json();
    ok(fo.budget === null && fo.crew === null && fo.advancing === null, "the Overview leaves out sections hidden for the person");
    await db.productionTeam.deleteMany({ where: { productionId: 1, userId: free.id } });
    ok((await f("/api/productions/1/overview")).status === 403, "and nothing for a production they're not on");

    await db.user.update({ where: { id: admin.id }, data: { preferences: null } });
    const old = await page(await login(admin.email), "");
    ok(!old.includes("data-new-look"), "in the old look nothing changes (it still opens on Schedule)");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    await db.user.update({ where: { id: admin.id }, data: { preferences: null } }).catch(() => {});
  }
});
