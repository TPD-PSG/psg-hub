import { run } from "./lib.mjs";

// New look stage 4 checks (build brief): a director, a PM and an office user each see their own
// panels; Needs you disappears when nothing needs the person; no cash or bank figure appears.
// Plus: admins set Home roles; pinned shortcuts are the Hub's own pages, six at most.
export default () => run("new-look-home", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  let task = null;
  try {
    await db.user.updateMany({ where: { id: { in: [member.id, admin.id] } }, data: { preferences: JSON.stringify({ newLook: true }) } });
    const a = await login(admin.email), m = await login(member.email);
    const home = async who => (await (await who("/?all=1", { headers: { accept: "text/html" } })).text()).replace(/<!-- -->/g, "");

    let h = await home(a);
    ok(h.includes("Weighted pipeline") && h.includes("Live shows") && h.includes("Next key date") && h.includes(">Companies<"), "an admin (director by default) sees the director panels and Companies");
    ok(!/\b(cash|bank balance)\b/i.test(h.replace(/<script[\s\S]*?<\/script>/g, "")), "no cash or bank figures on the home");
    ok(h.includes("Rentals &amp; Crew") && h.includes("Coming"), "the Rentals & Crew card shows as coming");

    h = await home(m);
    ok(h.includes('aria-label="My productions"') && h.includes('aria-label="My tasks"') && !h.includes("Weighted pipeline"), "a member (PM by default) sees My productions and My tasks, not the director panels");
    ok(!h.includes('aria-label="Needs you"'), "Needs you is hidden when nothing needs them");

    ok((await m(`/api/users/${member.id}/home-role`, { method: "PUT", body: JSON.stringify({ homeRole: "office" }) })).status === 403, "only admins set Home roles");
    ok((await a(`/api/users/${member.id}/home-role`, { method: "PUT", body: JSON.stringify({ homeRole: "boss" }) })).status === 400, "Director, PM or office only");
    await a(`/api/users/${member.id}/home-role`, { method: "PUT", body: JSON.stringify({ homeRole: "office" }) });
    h = await home(m);
    ok(h.includes("Expenses to approve") && h.includes("Invoices to chase") && h.includes("Cockshute issues") && h.includes("H&amp;S reports") && !h.includes('aria-label="My productions"'), "an office user sees the office panel");

    // (the member test user doesn't have the Tasks area, so use the admin)
    task = await db.task.create({ data: { title: "NLH overdue task", assigneeUserId: admin.id, dueDate: new Date(Date.now() - 2 * 86400e3) } });
    h = await home(a);
    ok(h.includes('aria-label="Needs you"') && h.includes("Task overdue: NLH overdue task"), "an overdue task puts Needs you back, linking to the task");

    ok((await m("/api/me/pinned", { method: "PUT", body: JSON.stringify({ hrefs: ["https://evil.example/x"] }) })).status === 400, "pins are the Hub's own pages only");
    ok((await m("/api/me/pinned", { method: "PUT", body: JSON.stringify({ hrefs: ["/a", "/b", "/c", "/d", "/e", "/f", "/g"] }) })).status === 400, "six pins at most");
    ok((await m("/api/me/pinned", { method: "PUT", body: JSON.stringify({ hrefs: ["/productions", "/calendar"] }) })).status === 200, "a person can choose their pins");
    const prefs = JSON.parse((await db.user.findUnique({ where: { id: member.id } })).preferences);
    ok(prefs.newLook === true && prefs.pinned.join() === "/productions,/calendar", "pins are kept with their other preferences");
    void free;
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    if (task) await db.task.delete({ where: { id: task.id } }).catch(() => {});
    await db.user.updateMany({ where: { id: { in: [member.id, admin.id] } }, data: { preferences: null, homeRole: null } }).catch(() => {});
  }
});
