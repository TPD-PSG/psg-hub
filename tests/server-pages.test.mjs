import { run } from "./lib.mjs";

// Pages that arrive with their data from the server (no empty flash), with the same access rules as the API
export default () => run("server-pages", async ({ db, users, login, anon, results }) => {
  const anonFetch = anon;
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const a = await login(users[3].email), f = await login(users[0].email);
  const html = async (who, path) => (await who(path, { headers: { accept: "text/html" } })).text();
  const venue = await db.venue.findFirst({ orderBy: { name: "asc" }, select: { name: true } });
  if (venue) ok((await html(a, "/venues")).includes(venue.name.replace(/&/g, "&amp;")), `venues: "${venue.name}" in the first HTML`);

  const prod1 = await db.production.findUnique({ where: { id: 1 }, select: { name: true } });
  const assignment = await db.staffAssignment.create({ data: { userId: users[3].id, productionId: 1, startDate: new Date(), endDate: new Date(), notes: "staff-only-assignment-note" } });
  try {
    const ac = await html(a, "/calendar");
    ok(ac.includes("staff-only-assignment-note") || ac.includes(prod1.name), "calendar (admin): data in the first HTML");
    const fc = await html(f, "/calendar");
    ok(!fc.includes("staff-only-assignment-note"), "calendar (freelancer): no staff assignments in the page");
  } finally {
    await db.staffAssignment.delete({ where: { id: assignment.id } }).catch(() => {});
  }

  // Finance, BD and Sales: data in the admin's first HTML, none of it for a freelancer
  const inv = await db.companyInvoice.create({ data: { type: "sales", party: "SSR Invoice Party", description: "server-pages-test", netAmount: 1, status: "sent" } });
  const client = await db.client.create({ data: { name: "SSR Test Client", type: "other" } });
  const brand = await db.salesBrand.create({ data: { name: "SSR Test Brand" } });
  try {
    for (const [path, marker] of [["/finance", "SSR Invoice Party"], ["/bd", "SSR Test Client"], ["/sales", "SSR Test Brand"]]) {
      ok((await html(a, path)).includes(marker), `${path} (admin): data in the first HTML`);
      ok(!(await html(f, path)).includes(marker), `${path} (freelancer): no data in the page`);
    }
    const ph = await html(a, "/property");
    ok(!/>Loading…</.test(ph), "/property (admin): no Loading… placeholder");
  } finally {
    await db.companyInvoice.delete({ where: { id: inv.id } }).catch(() => {});
    await db.client.delete({ where: { id: client.id } }).catch(() => {});
    await db.salesBrand.delete({ where: { id: brand.id } }).catch(() => {});
  }

  // Pages converted on 24 Nov: data in the first HTML for whoever may see it, and not for others
  const [admin, free] = [users[3], users[0]];
  const ticket = await db.helpTicket.create({ data: { title: "SSR helpdesk ticket", category: "bug", priority: "low", status: "open", createdByUserId: free.id } });
  const task = await db.task.create({ data: { title: "SSR my task", status: "todo", priority: "low", assigneeUserId: admin.id } });
  const signoff = await db.task.create({ data: { title: "SSR signoff task", status: "awaiting_signoff", priority: "low", requiresSignoff: true, signoffUserId: admin.id } });
  const link = await db.quickLink.create({ data: { label: "SSR quick link", url: "https://example.test", icon: "🔗", order: 999 } });
  const post = await db.marketingPost.create({ data: { title: "SSR marketing post", platforms: "instagram", status: "draft", scheduledAt: new Date() } });
  try {
    ok((await html(a, "/helpdesk")).includes("SSR helpdesk ticket"), "/helpdesk (admin): every ticket in the first HTML");
    ok((await html(f, "/helpdesk")).includes("SSR helpdesk ticket"), "/helpdesk (freelancer): own ticket in the first HTML");
    const at = await html(a, "/tasks");
    ok(at.includes("SSR my task") && at.includes("SSR signoff task"), "/tasks (admin): tasks and sign-offs in the first HTML");
    ok(!(await html(f, "/tasks")).includes("SSR my task"), "/tasks (freelancer): no one else's tasks");
    ok((await html(a, "/profile")).includes(admin.email), "/profile: own details in the first HTML");
    const au = await html(a, "/admin/users");
    ok(au.includes(free.email), "/admin/users (admin): users in the first HTML");
    ok(!(await html(f, "/admin/users")).includes(admin.email), "/admin/users (freelancer): no user list");
    ok((await html(a, "/admin/settings")).includes("SSR quick link"), "/admin/settings (admin): settings in the first HTML");
    ok((await html(a, "/marketing")).includes("SSR marketing post"), "/marketing (admin): this month's posts in the first HTML");
    ok(!(await html(f, "/marketing")).includes("SSR marketing post"), "/marketing (freelancer): no posts");
    if (prod1) ok((await html(anonFetch, "/toolbox-talk/1")).includes(prod1.name.replace(/&/g, "&amp;")), "/toolbox-talk (signed out): production name in the first HTML");
  } finally {
    await db.helpTicket.delete({ where: { id: ticket.id } }).catch(() => {});
    await db.task.deleteMany({ where: { id: { in: [task.id, signoff.id] } } }).catch(() => {});
    await db.quickLink.delete({ where: { id: link.id } }).catch(() => {});
    await db.marketingPost.delete({ where: { id: post.id } }).catch(() => {});
  }
});
