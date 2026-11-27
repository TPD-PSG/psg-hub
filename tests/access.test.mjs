import { run } from "./lib.mjs";

export default () => run("access", async ({ db, users, login, anon, check }) => {
  const f = await login(users[0].email), c = await login(users[1].email), m = await login(users[2].email), a = await login(users[3].email);
  await check("freelancer", "open own production (1)", f("/api/productions/1"), 200);
  await check("freelancer", "open other production (2)", f("/api/productions/2"), 403);
  await check("freelancer", "other production's show reports", f("/api/productions/2/show-reports"), 403);
  await check("freelancer", "other production's hotel bookings", f("/api/productions/2/hotel-bookings"), 403);
  await check("freelancer", "add self to production 2 team", f("/api/productions/2/team", { method: "POST", body: JSON.stringify({ userId: users[0].id }) }), 403);
  await check("freelancer", "remove someone from own team", f(`/api/productions/1/team/${users[3].id}`, { method: "DELETE" }), 403);
  await check("freelancer", "delete production 2", f("/api/productions/2", { method: "DELETE" }), 403);
  await check("client", "open production 1", c("/api/productions/1"), 403);
  await check("client", "productions list is empty", c("/api/productions").then(async r => ({ status: (await r.json()).length === 0 ? 200 : 500 })), 200);
  await check("member", "open production 1 (no all-access)", m("/api/productions/1"), 403);
  await check("admin", "open production 2", a("/api/productions/2"), 200);
  await check("admin", "add test client to team 2", a("/api/productions/2/team", { method: "POST", body: JSON.stringify({ userId: users[1].id }) }), 201);
  await check("client", "open production 2 once on team", c("/api/productions/2"), 200);
  await check("client", "remove self from team 2", c(`/api/productions/2/team/${users[1].id}`, { method: "DELETE" }), 403);
  const p2 = await db.production.findUnique({ where: { id: 2 }, select: { status: true, announcementStatus: true, archived: true } });
  await db.production.update({ where: { id: 2 }, data: { status: "in-production", announcementStatus: "open", archived: false } }); // old numeric toolbox links only open live shows
  const restoreP2 = () => db.production.update({ where: { id: 2 }, data: p2 }).catch(() => {});
  await check("public", "toolbox info, old numeric link to a show in production (no login)", anon("/api/productions/2/toolbox-info"), 200);
  await check("public", "toolbox info for a planning / NDA show by number (no login)", anon("/api/productions/1/toolbox-info"), 404);
  await check("public", "full production (no login)", anon("/api/productions/1"), 307);
  await restoreP2();
});
