import { run } from "./lib.mjs";

// New look (beta), build brief stage 1 (28 Nov 2026): a per-person switch, off by default, kept
// with the person's other preferences. Admins can switch it for anyone. Switched on, the page
// carries the new tokens (data-new-look) and nothing else changes yet; switched off, it's gone.
export default () => run("new-look", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const json = r => r.json();
  try {
    await db.user.update({ where: { id: member.id }, data: { preferences: JSON.stringify({ calendarView: "week" }) } });
    const m = await login(member.email), a = await login(admin.email), f = await login(free.email);
    ok((await json(await m("/api/me/new-look"))).on === false, "off by default");
    const html = async who => (await (await who("/", { headers: { accept: "text/html" } })).text());
    ok(!(await html(m)).includes("data-new-look"), "switched off, the page has no new-look tokens");
    ok((await m("/api/me/new-look", { method: "PUT", body: JSON.stringify({ on: "yes" }) })).status === 400, "on or off only");
    await m("/api/me/new-look", { method: "PUT", body: JSON.stringify({ on: true }) });
    ok((await json(await m("/api/me/new-look"))).on === true, "a person can switch it on for themselves");
    ok(JSON.parse((await db.user.findUnique({ where: { id: member.id } })).preferences).calendarView === "week", "their other preferences are kept");
    ok((await html(m)).includes("data-new-look"), "switched on, the page carries the new tokens");
    await m("/api/me/new-look", { method: "PUT", body: JSON.stringify({ on: false }) });
    ok(!(await html(m)).includes("data-new-look"), "switching off takes effect on the next page");

    ok((await m(`/api/users/${free.id}/new-look`, { method: "PUT", body: JSON.stringify({ on: true }) })).status === 403, "only admins switch it for someone else");
    ok((await a(`/api/users/${free.id}/new-look`, { method: "PUT", body: JSON.stringify({ on: true }) })).status === 200 && (await json(await f("/api/me/new-look"))).on === true, "an admin can switch it on for anyone");
    const list = await json(await a("/api/users"));
    const row = list.find(u => u.id === free.id);
    ok(row?.newLook === true && !("preferences" in row), "the Users list shows who has it on, without their other preferences");
    ok(!(await json(await m("/api/users"))).some(u => "newLook" in u), "only admins see who has it on");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    await db.user.updateMany({ where: { id: { in: [free.id, member.id] } }, data: { preferences: null } }).catch(() => {});
  }
});
