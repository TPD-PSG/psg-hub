import { run } from "./lib.mjs";

// Handing over a leaver's work (27 Nov 2026): open work moves, finished work stays, crew bookings
// only when asked, the new person is told, and only admins can do it.
export default () => run("handover", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const leaver = free, taker = member;
  const T = "Handover test";
  const made = {};
  try {
    made.open = await db.task.create({ data: { title: `${T} open`, assigneeUserId: leaver.id, status: "todo" } });
    made.done = await db.task.create({ data: { title: `${T} done`, assigneeUserId: leaver.id, status: "done" } });
    made.sign = await db.task.create({ data: { title: `${T} signoff`, signoffUserId: leaver.id, requiresSignoff: true, status: "awaiting_signoff" } });
    made.deal = await db.opportunity.create({ data: { title: `${T} deal`, type: "other", ownerUserId: leaver.id } });
    made.won = await db.opportunity.create({ data: { title: `${T} won`, type: "other", ownerUserId: leaver.id, stage: "won" } });
    made.ticket = await db.helpTicket.create({ data: { title: `${T} ticket`, assignedToUserId: leaver.id } });
    made.comp = await db.complianceItem.create({ data: { name: `${T} policy`, category: "policy", ownerId: leaver.id } });
    const soon = new Date(Date.now() + 7 * 864e5);
    made.booking = await db.staffAssignment.create({ data: { userId: leaver.id, productionId: 1, startDate: soon, endDate: soon } });

    const a = await login(admin.email);
    const f = await login(free.email);
    ok((await f(`/api/users/${leaver.id}/handover`)).status === 403, "only admins can see or hand over someone's work");
    const sum = await (await a(`/api/users/${leaver.id}/handover`)).json();
    const k = Object.fromEntries(sum.kinds.map(x => [x.key, x]));
    ok(k.tasks?.count >= 1 && k.signoffs?.count >= 1 && k.deals?.count >= 1 && k.tickets?.count >= 1 && k.compliance?.count >= 1 && k.shows?.count >= 1, "the summary counts their open work, kind by kind");
    ok(k.bookings?.count >= 1 && k.bookings.byDefault === false, "crew bookings are listed but not ticked by default");

    let r = await a(`/api/users/${leaver.id}/handover`, { method: "POST", body: JSON.stringify({ toUserId: client.id, kinds: ["tasks"] }) });
    ok(r.status === 400, "work can't go to a client login");
    r = await a(`/api/users/${leaver.id}/handover`, { method: "POST", body: JSON.stringify({ toUserId: leaver.id, kinds: ["tasks"] }) });
    ok(r.status === 400, "nor back to the leaver");

    const kinds = sum.kinds.filter(x => x.byDefault).map(x => x.key);
    r = await a(`/api/users/${leaver.id}/handover`, { method: "POST", body: JSON.stringify({ toUserId: taker.id, kinds, deactivate: true }) });
    const d = await r.json();
    ok(r.ok && d.deactivated && d.moved.length >= 5, "the handover moves the chosen kinds and deactivates them");
    const get = (m, id) => db[m].findUnique({ where: { id } });
    ok((await get("task", made.open.id)).assigneeUserId === taker.id && (await get("task", made.sign.id)).signoffUserId === taker.id, "open tasks and sign-offs move");
    ok((await get("task", made.done.id)).assigneeUserId === leaver.id && (await get("opportunity", made.won.id)).ownerUserId === leaver.id, "finished work stays under the leaver's name");
    ok((await get("opportunity", made.deal.id)).ownerUserId === taker.id && (await get("helpTicket", made.ticket.id)).assignedToUserId === taker.id && (await get("complianceItem", made.comp.id)).ownerId === taker.id, "open deals, tickets and compliance items move");
    ok((await get("staffAssignment", made.booking.id)).userId === leaver.id, "crew bookings stay unless ticked");
    ok(!!(await db.productionTeam.findUnique({ where: { productionId_userId: { productionId: 1, userId: taker.id } } })) && !!(await db.productionTeam.findUnique({ where: { productionId_userId: { productionId: 1, userId: leaver.id } } })), "the new person joins the leaver's show teams; the leaver stays listed");
    ok((await db.user.findUnique({ where: { id: leaver.id } })).deactivatedAt !== null, "the leaver is deactivated");
    const n = await db.notification.findFirst({ where: { userId: taker.id, title: { contains: "handed to you" } }, orderBy: { id: "desc" } });
    ok(!!n && /Open tasks/.test(n.body ?? ""), "the new person is told what they've been given");
    // Bookings on request
    r = await a(`/api/users/${leaver.id}/handover`, { method: "POST", body: JSON.stringify({ toUserId: taker.id, kinds: ["bookings"] }) });
    ok(r.ok && (await get("staffAssignment", made.booking.id)).userId === taker.id, "crew bookings move when ticked");
  } finally {
    await db.user.update({ where: { id: leaver.id }, data: { deactivatedAt: null } }).catch(() => {});
    await db.productionTeam.deleteMany({ where: { userId: taker.id, productionId: 1 } }).catch(() => {});
    await db.task.deleteMany({ where: { title: { startsWith: T } } });
    await db.opportunity.deleteMany({ where: { title: { startsWith: T } } });
    await db.helpTicket.deleteMany({ where: { title: { startsWith: T } } });
    await db.complianceItem.deleteMany({ where: { name: { startsWith: T } } });
    if (made.booking) await db.staffAssignment.delete({ where: { id: made.booking.id } }).catch(() => {});
    await db.notification.deleteMany({ where: { userId: taker.id, title: { contains: "handed to you" } } });
  }
});
