import { run, BASE } from "./lib.mjs";

// Fixes found while writing the guides (28 Nov 2026): alarm codes are admin only; a story approved
// after its month's roundup goes in the next one; Ask Me Anything takes what it can read (PDF, .txt,
// .md) and says why it refuses the rest; the crew directory opens searched for someone (?q=).
export default () => run("guide-fixes", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , member, admin] = users;
  const made = { alarm: null, subs: [], roundups: [], docs: [] };
  try {
    const a = await login(admin.email);
    // Alarm codes
    await a("/api/property"); // makes the property record if there isn't one
    made.alarm = await db.propertyAlarm.create({ data: { propertyId: 1, name: "GF test alarm", code: "1234" } });
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ modules: ["property"], allProductions: false }) } });
    const m = await login(member.email);
    const mp = await (await m("/api/property")).json();
    const ma = mp.alarms?.find(x => x.id === made.alarm.id);
    ok(ma && ma.code === null && ma.codeHidden === true && mp.alarmAdmin === false, "staff with the property area see the alarm without its code");
    ok(!JSON.stringify(mp).includes("1234"), "the code isn't sent to them at all");
    ok((await m(`/api/property/alarms/${made.alarm.id}`, { method: "PUT", body: JSON.stringify({ name: "x", code: "0000" }) })).status === 403 && (await m("/api/property/alarms", { method: "POST", body: JSON.stringify({ name: "x" }) })).status === 403, "only admins add or change alarm records");
    const ap = await (await a("/api/property")).json();
    ok(ap.alarmAdmin === true && ap.alarms.find(x => x.id === made.alarm.id)?.code === "1234", "admins see the code");

    // Fun Corner: a story approved after its month's roundup
    const late = await db.funSubmission.create({ data: { title: "GF late story", story: "x", monthYear: "2099-01", approved: true, authorId: admin.id } });
    const now = await db.funSubmission.create({ data: { title: "GF this month", story: "x", monthYear: "2099-02", approved: true, authorId: admin.id } });
    made.subs.push(late.id, now.id);
    const r = await (await a("/api/fun/roundup", { method: "POST", body: JSON.stringify({ monthYear: "2099-02" }) })).json();
    if (r.roundupId) made.roundups.push(r.roundupId);
    const after = await db.funSubmission.findMany({ where: { id: { in: [late.id, now.id] } } });
    ok(after.every(s => s.roundupId === r.roundupId) && r.count >= 2, "a story approved after its own month's roundup goes in the next one");
    ok((await a("/api/fun/roundup", { method: "POST", body: JSON.stringify({ monthYear: "Feb" }) })).status === 400, "the roundup month must look like 2026-11");

    // Ask Me Anything uploads
    const up = (name, type, text) => { const fd = new FormData(); fd.append("file", new Blob([text], { type }), name); return fetch(`${BASE}/api/knowledge-docs`, { method: "POST", body: fd, headers: { cookie: a.cookie } }); };
    let res = await up("gf-policy.md", "", "# GF policy\nBe kind.");
    const doc = await res.json().catch(() => ({}));
    if (doc.id) made.docs.push(doc.id);
    ok(res.ok && doc.mime === "text/markdown", "a .md policy is accepted (even when the browser gives no type)");
    res = await up("gf.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "x");
    ok(res.status === 400 && /PDF/.test((await res.json()).error), "a Word file is refused, saying to save it as a PDF");

    // Crew directory searched
    const html = (await (await a("/crew?q=GF%20Smith", { headers: { accept: "text/html" } })).text());
    ok(html.includes('value="GF Smith"'), "the crew directory opens searched for someone");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    if (made.alarm) await db.propertyAlarm.delete({ where: { id: made.alarm.id } }).catch(() => {});
    await db.funSubmission.deleteMany({ where: { id: { in: made.subs } } }).catch(() => {});
    await db.funRoundup.deleteMany({ where: { id: { in: made.roundups } } }).catch(() => {});
    await db.notification.deleteMany({ where: { body: { contains: "February 2099" } } }).catch(() => {});
    await db.knowledgeDoc.deleteMany({ where: { id: { in: made.docs } } }).catch(() => {});
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ modules: ["productions"], allProductions: false }) } }).catch(() => {});
  }
});
