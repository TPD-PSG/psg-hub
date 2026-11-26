import { run } from "./lib.mjs";

// Accident & near-miss reports on a workshop floor (a company space, e.g. The Workshop Stoke):
// anyone in the space reports, the workshop's own staff and the H&S leads follow up, others see only
// their own; the floor's QR form; and they show on the central H&S page.
export default () => run("workshop-incidents", async ({ db, users, login, anon, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const made = { e: null };
  const since = new Date();
  const body = (o = {}) => JSON.stringify({ kind: "accident", occurredAt: new Date(Date.now() - 86400e3).toISOString(), description: "Kickback on the table saw", reporterName: "Bench hand", treatment: "first_aid", ...o });
  try {
    made.e = await db.entity.create({ data: { name: "ZZ Test Workshop", hasSpace: true, slug: "zz-test-ws", color: "#d9480f" } });
    const slug = made.e.slug, api = `/api/spaces/${slug}`;
    await db.user.update({ where: { id: free.id }, data: { homeEntityId: made.e.id } });
    const a = await login(admin.email), m = await login(member.email), f = await login(free.email), c = await login(client.email);

    let r = await f(`${api}/incidents`, { method: "POST", body: body() });
    const mine = await r.json();
    ok(r.status === 201 && mine.entityId === made.e.id && mine.productionId === null, "a freelancer on the workshop floor files a report");
    ok((await c(`${api}/incidents`)).status === 403, "someone outside the space can't");
    const other = await (await a(`${api}/incidents`, { method: "POST", body: body({ kind: "near_miss", description: "Offcut flew from the bandsaw" }) })).json();
    let list = await (await f(`${api}/incidents`)).json();
    ok(!list.manage && list.incidents.length === 1 && list.incidents[0].id === mine.id, "the freelancer sees only their own report");
    ok((await f(`/api/incidents/${other.id}`)).status === 404, "and can't open anyone else's");

    // A Hub member who isn't the workshop's own staff can open the space but not manage its reports
    list = await (await m(`${api}/incidents`)).json();
    ok(!list.manage && list.incidents.length === 0, "PSG staff from another company don't see the workshop's reports");
    await db.user.update({ where: { id: member.id }, data: { homeEntityId: made.e.id } });
    list = await (await m(`${api}/incidents`)).json();
    ok(list.manage && list.incidents.length === 2 && list.people.some(p => p.id === member.id), "the workshop's own staff see every report and can be given actions");
    r = await m(`/api/incidents/${mine.id}`, { method: "PATCH", body: JSON.stringify({ investigation: "Riving knife not refitted", riddor: "no" }) });
    ok(r.status === 200 && (await r.json()).status === "investigating", "they follow one up");
    r = await m(`/api/incidents/${mine.id}/actions`, { method: "POST", body: JSON.stringify({ text: "Refit the riving knife", ownerId: member.id }) });
    ok(r.status === 201, "and add an action for themselves");
    ok((await m(`/api/incidents/${mine.id}/actions`, { method: "POST", body: JSON.stringify({ text: "x", ownerId: free.id }) })).status === 400, "not for a freelancer who can't manage reports");

    // Notices go to the workshop's own staff
    const n = await db.notification.findMany({ where: { userId: member.id, createdAt: { gte: since }, link: `/spaces/${slug}/safety?incident=${other.id}` } });
    ok(n.length === 0, "a report filed before they joined the workshop didn't reach them");
    const third = await (await f(`${api}/incidents`, { method: "POST", body: body({ description: "Splinter from pallet" }) })).json();
    ok((await db.notification.count({ where: { userId: member.id, link: `/spaces/${slug}/safety?incident=${third.id}` } })) === 1, "a new report is sent to the workshop's staff, linking to its Safety page");

    // The floor's QR form
    ok((await f(`${api}/incident-qr`, { method: "POST", body: "{}" })).status === 403, "only the workshop's staff make the floor's QR code");
    const q = await (await m(`${api}/incident-qr`, { method: "POST", body: "{}" })).json();
    const info = await (await anon(`/api/report-incident/${q.token}`)).json();
    ok(info.name === "ZZ Test Workshop", "the QR form names the workshop");
    r = await anon(`/api/report-incident/${q.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body({ reporterName: "Visitor", description: "Tripped on an air line" }) });
    ok(r.status === 201 && (await db.incident.count({ where: { entityId: made.e.id, viaQr: true } })) === 1, "a report through it lands on the workshop");

    // The central page and the space page
    const hs = await (await a("/api/health-safety")).json();
    ok(hs.incidents.some(i => i.id === mine.id && i.entity?.slug === slug), "workshop reports appear on the central H&S page");
    const hsm = await (await m("/api/health-safety")).json();
    ok(hsm.incidents.some(i => i.id === mine.id) && hsm.openActions.some(x => x.incident.path === `/spaces/${slug}/safety?incident=${mine.id}`), "including for the workshop's own staff, with its actions");
    const page = await m(`/spaces/${slug}/safety`);
    ok(page.status === 200 && (await page.text()).includes("Accidents &amp; near misses"), "the workshop's Safety page opens");
  } finally {
    if (made.e) {
      await db.notification.deleteMany({ where: { createdAt: { gte: since }, link: { contains: "/spaces/zz-test-ws/" } } }).catch(() => {});
      await db.user.updateMany({ where: { homeEntityId: made.e.id }, data: { homeEntityId: null } }).catch(() => {});
      await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
    }
  }
});
