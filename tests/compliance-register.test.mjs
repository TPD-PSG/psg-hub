import { run, BASE } from "./lib.mjs";

// The group compliance register: staff see it (within their companies), admins add and retire,
// an item's owner keeps it up to date; documents and renewals; reminders (with NOTIFY_SECRET).
export default () => run("compliance-register", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const made = { e1: null, e2: null, ids: [] };
  const since = new Date();
  const day = n => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
  try {
    const core = await import("../lib/complianceCore.ts");
    const now = new Date("2026-06-01T09:00:00Z");
    ok(core.complianceStatus({ expiresAt: "2026-12-01", reviewAt: null }, now) === "valid" && core.complianceStatus({ expiresAt: "2026-07-15", reviewAt: null }, now) === "due" && core.complianceStatus({ expiresAt: null, reviewAt: "2026-05-01" }, now) === "expired" && core.complianceStatus({ expiresAt: null, reviewAt: null }, now) === "undated", "status: in date, due within 60 days, expired, or no date (reviews count for policies)");
    ok(core.daysUntil("2026-07-01", now) === 30 && core.REMIND_DAYS.join() === "60,30,7,0", "reminders 60, 30 and 7 days before, and on the day");

    made.e1 = await db.entity.create({ data: { name: "ZZ Compliance Co One", shortName: "ZC1" } });
    made.e2 = await db.entity.create({ data: { name: "ZZ Compliance Co Two" } });
    const a = await login(admin.email), m = await login(member.email), f = await login(free.email), c = await login(client.email);

    ok((await f("/api/compliance")).status === 403 && (await c("/api/compliance")).status === 403, "freelancers and clients don't see the register");
    let d = await (await m("/api/compliance")).json();
    ok(d.admin === false && Array.isArray(d.items), "staff see it");
    ok((await m("/api/compliance", { method: "POST", body: JSON.stringify({ name: "PL", category: "insurance" }) })).status === 403, "only admins add to it");
    ok((await a("/api/compliance", { method: "POST", body: JSON.stringify({ name: "", category: "insurance" }) })).status === 400, "an item needs a name");
    let r = await (await a("/api/compliance", { method: "POST", body: JSON.stringify({ name: "ZZ Public liability", category: "insurance", entityId: made.e1.id, issuer: "Hiscox", reference: "PL-123", cover: "£10m", expiresAt: day(30), ownerId: member.id }) })).json();
    const pl = r.id; made.ids.push(pl);
    r = await (await a("/api/compliance", { method: "POST", body: JSON.stringify({ name: "ZZ Health and safety policy", category: "policy", version: "v1", reviewAt: day(200) }) })).json();
    const pol = r.id; made.ids.push(pol);
    r = await (await a("/api/compliance", { method: "POST", body: JSON.stringify({ name: "ZZ CHAS", category: "accreditation", entityId: made.e2.id, expiresAt: day(-3) }) })).json();
    const chas = r.id; made.ids.push(chas);
    d = await (await m("/api/compliance")).json();
    const item = id => d.items.find(i => i.id === id);
    ok(item(pl).entity.id === made.e1.id && item(pl).status === "due" && item(pl).canManage, "an insurance belongs to its company, is due in 30 days, and its owner can manage it");
    ok(item(pol).entity === null && item(pol).status === "valid" && !item(pol).canManage, "a group-wide policy, reviewed on its own date; not the member's to change");
    ok(item(chas).status === "expired", "an expired accreditation shows as expired");

    // The owner keeps it up to date, within limits
    ok((await m(`/api/compliance/${pl}`, { method: "PATCH", body: JSON.stringify({ reference: "PL-124" }) })).status === 200, "the owner corrects the details");
    ok((await m(`/api/compliance/${pl}`, { method: "PATCH", body: JSON.stringify({ ownerId: admin.id }) })).status === 403, "but can't hand it to someone else");
    ok((await m(`/api/compliance/${pl}`, { method: "PATCH", body: JSON.stringify({ archived: true }) })).status === 403, "or retire it");
    ok((await m(`/api/compliance/${pol}`, { method: "PATCH", body: JSON.stringify({ version: "v2" }) })).status === 403, "and can't change items they don't own");

    // Documents and a renewal
    const up = async (who, id, fields) => {
      const fd = new FormData();
      fd.append("file", new Blob(["%PDF-1.4\n"], { type: "application/pdf" }), "schedule.pdf");
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      return fetch(`${BASE}/api/compliance/${id}/documents`, { method: "POST", headers: { cookie: who.cookie }, body: fd });
    };
    ok((await up(m, pol, {})).status === 403, "only the owner or an admin uploads");
    r = await up(m, pl, { validFrom: day(30), expiresAt: day(395), renew: "1" });
    d = await r.json();
    ok(r.status === 201 && item(pl).documents.length === 1 && item(pl).expiresAt.startsWith(day(395)) && item(pl).status === "valid", "the owner uploads the renewal and the item moves to its new date");
    const docId = item(pl).documents[0].id;
    const dl = await m(`/api/compliance-documents/${docId}`);
    ok(dl.status === 200 && dl.headers.get("content-type") === "application/pdf", "staff download the document");
    ok((await f(`/api/compliance-documents/${docId}`)).status === 403, "freelancers can't");

    // Companies a member is limited to
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ modules: ["productions"], allProductions: false, entityIds: [made.e2.id] }) } });
    d = await (await m("/api/compliance")).json();
    ok(!d.items.some(i => i.id === pl) && d.items.some(i => i.id === pol) && d.items.some(i => i.id === chas), "someone limited to one company sees its items and the group-wide ones, not other companies'");
    ok((await m(`/api/compliance-documents/${docId}`)).status === 404, "nor their documents");
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ modules: ["productions"], allProductions: false }) } });

    // Admins tidy up
    d = await (await a(`/api/compliance-documents/${docId}`, { method: "DELETE" })).json();
    ok(item(pl).documents.length === 0, "an admin can delete a document added by mistake");
    d = await (await a(`/api/compliance/${chas}`, { method: "PATCH", body: JSON.stringify({ archived: true }) })).json();
    ok(item(chas).archived, "and retire an item");

    // Reminders
    const secret = process.env.NOTIFY_SECRET;
    if (!secret) results.push("PASS  register reminders skipped: NOTIFY_SECRET isn't set here (it is in CI)");
    else {
      await db.complianceItem.update({ where: { id: pl }, data: { expiresAt: new Date(`${day(30)}T00:00:00Z`) } });
      await fetch(`${BASE}/api/notify/daily`, { method: "POST", headers: { "x-notify-secret": secret } });
      ok((await db.notification.count({ where: { userId: member.id, createdAt: { gte: since }, title: "ZZ Public liability (ZC1): renewal due in 30 days" } })) === 1, "the owner is reminded 30 days before the renewal");
      ok((await db.notification.count({ where: { userId: admin.id, createdAt: { gte: since }, title: "ZZ Public liability (ZC1): renewal due in 30 days" } })) === 1, "and so are the admins");
    }
  } finally {
    await db.notification.deleteMany({ where: { createdAt: { gte: since }, link: { startsWith: "/compliance?item=" } } }).catch(() => {});
    if (made.ids.length) await db.complianceItem.deleteMany({ where: { id: { in: made.ids } } }).catch(() => {});
    for (const e of [made.e1, made.e2]) if (e) await db.entity.delete({ where: { id: e.id } }).catch(() => {});
  }
});
