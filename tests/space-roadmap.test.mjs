import { run, BASE } from "./lib.mjs";

// The roadmap inside a company space: one shared list with the Hub; ideas raised in the space are
// tagged to it and show on PSG's roadmap too; only people who can open the space get in.
export default () => run("space-roadmap", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, client, member, admin] = users;
  const a = await login(admin.email), c = await login(client.email);
  const html = async r => (await r.text()).replace(/<!-- -->/g, "");
  const send = (who, path, method, body) => fetch(`${BASE}${path}`, { method, headers: { cookie: who.cookie, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const made = { e: null, items: [] };
  try {
    made.e = await db.entity.create({ data: { name: "Roadmap test co", slug: "rm-test", hasSpace: true, shortName: "RTC" } });
    const hub = await db.roadmapItem.create({ data: { title: "RM hub idea", createdByUserId: admin.id } });
    made.items.push(hub.id);
    await db.user.update({ where: { id: member.id }, data: { homeEntityId: made.e.id } });
    const m2 = await login(member.email);

    let r = await send(m2, "/api/spaces/rm-test/roadmap", "POST", { title: "RM workshop idea", body: "Saw rack", category: "feature" });
    const it = await r.json(); made.items.push(it.id);
    ok(r.status === 201 && it.entity?.id === made.e.id && it.status === "idea", "staff add an idea from the space and it's tagged to it");
    r = await send(m2, "/api/spaces/rm-test/roadmap", "POST", { title: "  " });
    ok(r.status === 400, "an idea needs a title");

    r = await send(m2, "/api/spaces/rm-test/roadmap", "GET");
    const d = await r.json();
    ok(d.items.some(i => i.id === hub.id) && d.items.some(i => i.id === it.id), "the space sees the Hub's items and its own: fully shared");
    const hubList = await (await send(a, "/api/roadmap", "GET")).json();
    ok(hubList.find(i => i.id === it.id)?.entity?.shortName === "RTC", "PSG's roadmap has the space's idea, tagged with the company");

    r = await send(m2, `/api/spaces/rm-test/roadmap/${it.id}`, "PUT", { status: "planned", pinned: true });
    const moved = await r.json();
    ok(r.status === 200 && moved.status === "planned" && moved.pinned === false, "whoever raised it can move it; only admins pin");
    r = await send(m2, `/api/spaces/rm-test/roadmap/${hub.id}`, "PUT", { status: "done" });
    ok(r.status === 403, "staff can't change someone else's item");
    r = await send(m2, `/api/spaces/rm-test/roadmap/${it.id}`, "PUT", { status: "nonsense" });
    ok(r.status === 400, "unknown stages are refused");
    r = await send(c, "/api/spaces/rm-test/roadmap", "GET");
    ok(r.status === 403, "someone outside the space can't open its roadmap");

    const page = await html(await m2("/spaces/rm-test/roadmap", { headers: { accept: "text/html" } }));
    ok(page.includes("RM workshop idea") && page.includes("RM hub idea") && page.includes("From RTC") && page.includes("From PSG"), "the space's roadmap page shows both, with where each came from");
    ok(page.includes('href="/spaces/rm-test/roadmap"'), "Roadmap is in the space's own menu");
    r = await send(a, `/api/spaces/rm-test/roadmap/${it.id}`, "DELETE");
    ok(r.status === 200 && !(await db.roadmapItem.findUnique({ where: { id: it.id } })), "an admin can delete it");
  } finally {
    await db.user.update({ where: { id: member.id }, data: { homeEntityId: null } }).catch(() => {});
    for (const id of made.items) await db.roadmapItem.delete({ where: { id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
