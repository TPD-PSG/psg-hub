import { run, BASE } from "./lib.mjs";

// Accident & incident reporting (26 Nov 2026): who sees what (H&S leads everything, a show's team
// staff their show, everyone else only their own), the no-login QR form, follow-up and RIDDOR,
// sign-off only once it's ready, the central page, and the daily reminders (with NOTIFY_SECRET).
export default () => run("incidents", async ({ db, users, login, anon, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email), c = await login(client.email);
  const made = { prod: null, other: null };
  const since = new Date();
  const leadsBefore = await db.setting.findUnique({ where: { key: "hs_lead_ids" } });
  const body = (o = {}) => JSON.stringify({ kind: "accident", occurredAt: new Date(Date.now() - 3 * 86400e3).toISOString(), description: "Cut hand on a flat edge", reporterName: "Test reporter", injuredName: "Sam Crew", injuredRole: "Crew", treatment: "first_aid", ...o });
  try {
    const core = await import("../lib/incidentsCore.ts");
    const t0 = new Date("2026-11-01T10:00:00Z");
    ok(core.riddorDue("specified", t0).toISOString().startsWith("2026-11-11") && core.riddorDue("over7", t0).toISOString().startsWith("2026-11-16") && core.riddorDue("no", t0) === null && core.riddorDue(null, t0) === null, "RIDDOR deadlines: 10 days, 15 for over-7-day, none if not reportable");
    ok(core.incidentRef({ year: 2026, number: 7 }) === "INC-2026-007", "references read INC-2026-007");
    ok(core.closeBlockers({ riddor: null, riddorReportedAt: null, actions: [{ doneAt: null }] }).length === 2 && core.closeBlockers({ riddor: "no", riddorReportedAt: null, actions: [{ doneAt: new Date() }] }).length === 0, "closing waits for a RIDDOR decision and every action done");
    ok(!!core.riddorHint({ kind: "accident", treatment: "hospital" }) && core.riddorHint({ kind: "near_miss" }) === null, "hospital treatment prompts a RIDDOR check; near misses don't");

    made.prod = await db.production.create({ data: { name: "Incident test show", type: "Other", venue: "Test Theatre" } });
    made.other = await db.production.create({ data: { name: "Incident other show", type: "Other" } });
    const pid = made.prod.id;
    await db.productionTeam.create({ data: { productionId: pid, userId: free.id } });

    // Not on the show: no access; the freelancer on the team can report, but only sees their own
    ok((await m(`/api/productions/${pid}/incidents`)).status === 403, "staff not on the show can't open its reports");
    let r = await f(`/api/productions/${pid}/incidents`, { method: "POST", body: body({ kind: "near_miss", description: "Brace fell from the fly floor", injuredName: "Should be dropped" }) });
    const mine = await r.json();
    ok(r.status === 201 && mine.reportedById === free.id && mine.injuredName === null && /^\d+$/.test(String(mine.number)), "a crew member on the show files a near miss (no injury details kept for a near miss)");
    r = await a(`/api/productions/${pid}/incidents`, { method: "POST", body: body() });
    const acc = await r.json();
    ok(r.status === 201 && acc.injuredName === "Sam Crew" && acc.status === "open", "an admin files an accident with the injured person's details");
    ok((await f(`/api/productions/${pid}/incidents`, { method: "POST", body: body({ description: "" }) })).status === 400, "a report needs to say what happened");
    ok((await f(`/api/productions/${pid}/incidents`, { method: "POST", body: body({ kind: "explosion" }) })).status === 400, "an unknown kind is refused");
    let list = await (await f(`/api/productions/${pid}/incidents`)).json();
    ok(list.manage === false && list.incidents.length === 1 && list.incidents[0].id === mine.id, "the freelancer sees only the report they filed");
    ok((await f(`/api/incidents/${acc.id}`)).status === 404, "and can't open anyone else's");
    ok((await f(`/api/incidents/${mine.id}`, { method: "PATCH", body: JSON.stringify({ investigation: "x" }) })).status === 403, "or follow one up");

    // Team staff manage the show's reports; the new-report notice reached them
    await db.productionTeam.create({ data: { productionId: pid, userId: member.id } });
    list = await (await m(`/api/productions/${pid}/incidents`)).json();
    ok(list.manage === true && list.lead === false && list.incidents.length === 2, "the show's team staff see every report on it");
    r = await m(`/api/incidents/${acc.id}`, { method: "PATCH", body: JSON.stringify({ investigation: "Unprotected edge on flat 4", riddor: "specified", severity: "medium" }) });
    let inc = await r.json();
    const due = new Date(new Date(acc.occurredAt).getTime() + 10 * 86400e3).toISOString();
    ok(r.status === 200 && inc.status === "investigating" && inc.riddorDueDate === due && inc.severity === "medium", "writing up the investigation moves it on; RIDDOR 'specified' is due 10 days after");
    r = await m(`/api/incidents/${acc.id}/actions`, { method: "POST", body: JSON.stringify({ text: "Edge protection on all flats", ownerId: member.id, dueDate: new Date(Date.now() - 86400e3).toISOString().slice(0, 10) }) });
    inc = await r.json();
    ok(r.status === 201 && inc.actions.length === 1 && inc.actions[0].owner.id === member.id, "an action with an owner and due date");
    ok((await m(`/api/incidents/${acc.id}/actions`, { method: "POST", body: JSON.stringify({ text: "x", ownerId: client.id }) })).status === 400, "an action can't go to someone who can't see the report");
    ok((await m(`/api/incidents/${acc.id}/close`, { method: "POST", body: "{}" })).status === 403, "team staff can't sign a report off");

    // Make the member an H&S lead; sign-off waits until it's ready
    ok((await m("/api/health-safety", { method: "PUT", body: JSON.stringify({ leadIds: [member.id] }) })).status === 403, "only admins name the H&S leads");
    ok((await a("/api/health-safety", { method: "PUT", body: JSON.stringify({ leadIds: [member.id, client.id] }) })).status === 200, "an admin names the H&S leads");
    const leads = JSON.parse((await db.setting.findUnique({ where: { key: "hs_lead_ids" } })).value);
    ok(leads.includes(member.id) && !leads.includes(client.id), "only staff can be leads");
    r = await m(`/api/incidents/${acc.id}/close`, { method: "POST", body: "{}" });
    ok(r.status === 409 && (await r.json()).blockers.length === 2, "closing waits: RIDDOR not reported yet, an action open");
    await m(`/api/incidents/${acc.id}`, { method: "PATCH", body: JSON.stringify({ riddorReportedAt: new Date().toISOString().slice(0, 10), riddorRef: "HSE-123" }) });
    await m(`/api/incident-actions/${inc.actions[0].id}`, { method: "PATCH", body: JSON.stringify({ done: true }) });
    r = await m(`/api/incidents/${acc.id}/close`, { method: "POST", body: JSON.stringify({ closeNote: "Edges fixed" }) });
    inc = await r.json();
    ok(r.status === 200 && inc.status === "closed" && inc.closedBy.id === member.id && inc.closeNote === "Edges fixed", "an H&S lead signs it off once it's ready");
    ok((await m(`/api/incidents/${acc.id}`, { method: "PATCH", body: JSON.stringify({ investigation: "changed" }) })).status === 409, "a closed report can't be changed");
    r = await m(`/api/incidents/${acc.id}/close`, { method: "POST", body: JSON.stringify({ reopen: true }) });
    ok(r.status === 200 && (await r.json()).status === "investigating", "a lead can reopen it");
    // A lead reaches a show they're not on
    const otherInc = await (await a(`/api/productions/${made.other.id}/incidents`, { method: "POST", body: body({ kind: "property_damage", description: "Truck reversed into the dock door" }) })).json();
    ok((await m(`/api/incidents/${otherInc.id}`)).status === 200, "an H&S lead opens reports on shows they're not on");

    // Notices
    const notes = await db.notification.findMany({ where: { userId: member.id, createdAt: { gte: since }, link: { contains: `/productions/${made.other.id}?section=hs&incident=${otherInc.id}` } } });
    ok(notes.length === 1 && notes[0].title.includes("Incident other show"), "H&S leads are told about a new report");

    // The no-login QR form
    ok((await f(`/api/productions/${pid}/incident-qr`, { method: "POST", body: "{}" })).status === 403, "only staff and leads make the crew QR code");
    const q = await (await m(`/api/productions/${pid}/incident-qr`, { method: "POST", body: "{}" })).json();
    ok(/^[A-Za-z0-9_-]{16}$/.test(q.token) && q.url.endsWith(`/report-incident/${q.token}`), "the form gets a private link");
    const qr = await m(`/api/productions/${pid}/incident-qr`);
    ok(qr.status === 200 && qr.headers.get("content-type") === "image/png", "and a QR code");
    const info = await (await anon(`/api/report-incident/${q.token}`)).json();
    ok(info.name === "Incident test show" && info.venues[0] === "Test Theatre" && !("id" in info), "anyone with the link sees the show's name and venue, nothing else");
    r = await anon(`/api/report-incident/${q.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body({ reporterName: "Dock crew", description: "Slipped on wet ramp" }) });
    const viaQr = await r.json();
    ok(r.status === 201 && /^INC-\d{4}-\d{3}$/.test(viaQr.ref) && Object.keys(viaQr).length === 1, "a report through the QR form gives back only its reference");
    const saved = await db.incident.findFirst({ where: { productionId: pid, viaQr: true } });
    ok(saved && saved.reportedById === null && saved.reporterName === "Dock crew", "it's saved as a QR report");
    ok((await anon("/api/report-incident/notARealTokenAtAll")).status === 404, "a wrong link finds nothing");
    const page = await anon(`/report-incident/${q.token}`);
    ok(page.status === 200 && (await page.text()).includes("Incident test show"), "the form page opens without logging in");
    const renewed = await (await m(`/api/productions/${pid}/incident-qr`, { method: "POST", body: JSON.stringify({ renew: true }) })).json();
    ok(renewed.token !== q.token && (await anon(`/api/report-incident/${q.token}`)).status === 404, "a new code stops the old one working");

    // The central page
    ok((await c("/api/health-safety")).status === 403 && (await f("/api/health-safety")).status === 403, "clients and freelancers don't get the central page");
    const hs = await (await m("/api/health-safety")).json();
    ok(hs.me.lead && hs.incidents.some(i => i.id === otherInc.id) && hs.docs.some(d => d.id === pid && d.count === 0) && hs.toolbox.some(t => t.id === pid), "a lead's central page covers every show: reports, missing documents, toolbox talks");
    ok(hs.stats.months.length === 12 && hs.stats.byShow.some(s => s.name === "Incident test show"), "with a year of figures");
    await a("/api/health-safety", { method: "PUT", body: JSON.stringify({ leadIds: [] }) });
    const hs2 = await (await m("/api/health-safety")).json();
    ok(!hs2.me.lead && !hs2.incidents.some(i => i.id === otherInc.id) && hs2.incidents.some(i => i.productionId === pid), "without being a lead, only the shows they're on");
    ok(hs2.leads === null, "and no say over the leads");

    // A document's review date
    const doc = await db.hSDocument.create({ data: { productionId: pid, name: "RA.pdf", mime: "application/pdf", data: "" } });
    r = await m(`/api/hs-documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ reviewDate: new Date(Date.now() - 86400e3).toISOString().slice(0, 10) }) });
    ok(r.status === 200, "staff set a risk assessment's review date");
    const hs3 = await (await m("/api/health-safety")).json();
    ok(hs3.docs.find(d => d.id === pid).due.some(d => d.id === doc.id && d.overdue), "a document past its review date is flagged");
    ok((await f(`/api/hs-documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ reviewDate: null }) })).status === 403, "crew can't change review dates");

    // Deleting is for leads only
    ok((await m(`/api/incidents/${mine.id}`, { method: "DELETE" })).status === 403, "team staff can't delete a report");
    ok((await a(`/api/incidents/${mine.id}`, { method: "DELETE" })).status === 200, "a lead (admin) can");

    // The daily job: overdue action to its owner; RIDDOR overdue to leads and the show's staff
    const secret = process.env.NOTIFY_SECRET;
    if (!secret) results.push("PASS  daily reminders skipped: NOTIFY_SECRET isn't set here (it is in CI)");
    else {
      const late = await db.incident.create({ data: { productionId: pid, year: 1999, number: 1, kind: "accident", occurredAt: new Date(Date.now() - 12 * 86400e3), description: "Old one", reporterName: "x", riddor: "specified", riddorDueDate: new Date(Date.now() - 2 * 86400e3) } });
      await db.incidentAction.create({ data: { incidentId: late.id, text: "Retrain the fly crew", ownerId: member.id, dueDate: new Date(Date.now() - 3 * 86400e3) } });
      ok((await fetch(`${BASE}/api/notify/daily`, { method: "POST", headers: { "x-notify-secret": secret } })).status === 200, "the daily job runs");
      const got = await db.notification.findMany({ where: { userId: member.id, createdAt: { gte: since } } });
      ok(got.some(n => n.title === "Overdue incident action: Retrain the fly crew"), "the owner of an overdue action is chased");
      ok(got.some(n => n.title.startsWith("RIDDOR report overdue: INC-1999-001")), "an overdue RIDDOR report is chased with the show's staff");
      ok((await db.notification.count({ where: { userId: admin.id, createdAt: { gte: since }, title: { startsWith: "RIDDOR report overdue: INC-1999-001" } } })) === 1, "and with the H&S leads");
    }
  } finally {
    if (leadsBefore) await db.setting.update({ where: { key: "hs_lead_ids" }, data: { value: leadsBefore.value } }).catch(() => {});
    else await db.setting.deleteMany({ where: { key: "hs_lead_ids" } }).catch(() => {});
    for (const p of [made.prod, made.other]) if (p) {
      await db.notification.deleteMany({ where: { createdAt: { gte: since }, link: { contains: `/productions/${p.id}?` } } }).catch(() => {});
      await db.production.delete({ where: { id: p.id } }).catch(() => {});
    }
  }
});
