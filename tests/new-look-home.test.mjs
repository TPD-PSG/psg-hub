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
    // Until a rentals space exists the card says it's coming; after that the space shows in its place
    const rentalsSpace = await db.entity.findFirst({ where: { hasSpace: true, archived: false, spaceKind: "rentals" }, select: { name: true } });
    ok(rentalsSpace ? h.includes(rentalsSpace.name.replace(/&/g, "&amp;")) && !h.includes('aria-label="Rentals and Crew: coming"') : h.includes("Rentals &amp; Crew") && h.includes("Coming"),
      rentalsSpace ? "the rentals space shows in place of the coming card" : "the Rentals & Crew card shows as coming");

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
    ok(h.includes("Hide from Needs you: Task overdue: NLH overdue task"), "each line has a hide button");

    // ── Hiding things from Needs you ─────────────────────────────────────────
    const key = `task:${task.id}`, version = `${task.dueDate.toISOString()}:late`;
    ok((await a("/api/me/needs", { method: "PUT", body: JSON.stringify({ key: "<script>", version }) })).status === 400, "only real item keys can be hidden");
    ok((await a("/api/me/needs", { method: "PUT", body: JSON.stringify({ key, version: "" }) })).status === 400, "…with the version of it that was seen");
    ok((await a("/api/me/needs", { method: "PUT", body: JSON.stringify({ key, version }) })).status === 200, "a person hides the overdue task");
    h = await home(a);
    ok(!h.includes("Task overdue: NLH overdue task") && /1 hidden/.test(h) && h.includes("Show them again"), "it's gone from Needs you, with '1 hidden' and a way to show it again");
    ok((await db.task.findUnique({ where: { id: task.id } })).status !== "done", "hiding doesn't complete the task");
    await db.task.update({ where: { id: task.id }, data: { dueDate: new Date(Date.now() - 1 * 86400e3) } });
    h = await home(a);
    ok(h.includes("Task overdue: NLH overdue task"), "it comes back by itself when it changes (a new due date)");
    const v2 = `${(await db.task.findUnique({ where: { id: task.id } })).dueDate.toISOString()}:late`;
    await a("/api/me/needs", { method: "PUT", body: JSON.stringify({ key, version: v2 }) });
    ok((await a("/api/me/needs", { method: "DELETE" })).status === 200 && (await home(a)).includes("Task overdue: NLH overdue task"), "'Show them again' brings everything back");
    const anonStatus = (await fetch(new URL("/api/me/needs", (await import("./lib.mjs")).BASE), { method: "DELETE", redirect: "manual" })).status;
    ok(anonStatus === 401 || anonStatus === 307, "signed-out people can't (sent to sign in)");
    await a("/api/me/needs", { method: "PUT", body: JSON.stringify({ key, version: v2 }) });
    await db.task.delete({ where: { id: task.id } }); task = null;
    await home(a);
    const left = JSON.parse((await db.user.findUnique({ where: { id: admin.id } })).preferences).needsHidden;
    ok(!left || !(key in left), "once the thing's gone, the hidden note is forgotten too");

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
