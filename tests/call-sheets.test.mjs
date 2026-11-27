import { run } from "./lib.mjs";

// Call sheets (27 Nov 2026): a new sheet fills in the crew and PSG staff booked that day, shows
// the day's schedule, lists everyone by call time, works out who an email reaches (staff only),
// and a sheet changed after sending says so.
export default () => run("call-sheets", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , , admin] = users;
  const T = "CS test";
  const day = "2099-06-10", D = new Date(`${day}T00:00:00Z`);
  const made = { crew: [], sheets: [] };
  try {
    const t = await import("../lib/callSheetTimes.ts");
    ok(t.callMinutes("08:00") === 480 && t.callMinutes("8.30") === 510 && t.callMinutes("0745") === 465 && t.callMinutes("TBC") === null && t.callMinutes("25:00") === null, "call times read as 08:00, 8.30 or 0745");
    const order = t.byCallTime([{ callTime: null, name: "Zed", discipline: "x" }, { callTime: "14:00", name: "B", discipline: "x" }, { callTime: "8:00", name: "A", discipline: "x" }]).map(r => r.name).join("");
    ok(order === "ABZed", "one list by call time, no time last");

    const crewIn = await db.crew.create({ data: { name: `${T} Ana`, discipline: "Lighting", email: "cs-ana@example.test" } });
    const crewNoMail = await db.crew.create({ data: { name: `${T} Bo`, discipline: "Sound" } });
    const crewOut = await db.crew.create({ data: { name: `${T} Cy`, discipline: "Stage" } });
    const crewLate = await db.crew.create({ data: { name: `${T} Di`, discipline: "Stage", email: "cs-di@example.test" } });
    made.crew.push(crewIn.id, crewNoMail.id, crewOut.id, crewLate.id);
    await db.productionCrew.createMany({ data: [
      { productionId: 1, crewId: crewIn.id, role: "Head of LX", startDate: new Date("2099-06-01"), endDate: new Date("2099-06-20") },
      { productionId: 1, crewId: crewNoMail.id }, // no dates = the whole run
      { productionId: 1, crewId: crewOut.id, startDate: new Date("2099-07-01"), endDate: new Date("2099-07-05") },
    ] });
    await db.staffAssignment.create({ data: { userId: admin.id, productionId: 1, startDate: D, endDate: D, activityType: "TECH" } });
    await db.event.create({ data: { productionId: 1, title: `${T} Get in`, type: "load_in", startAt: new Date(`${day}T08:00:00Z`), endAt: new Date(`${day}T12:00:00Z`) } });
    await db.event.create({ data: { productionId: 1, title: `${T} Next day`, type: "other", startAt: new Date("2099-06-11T08:00:00Z"), endAt: new Date("2099-06-11T09:00:00Z") } });

    const a = await login(admin.email);
    let r = await a("/api/productions/1/call-sheets", { method: "POST", body: JSON.stringify({ date: day, title: `${T} sheet` }) });
    const sheet = await r.json();
    made.sheets.push(sheet.id);
    const names = sheet.entries.map(e => e.name);
    ok(r.status === 201 && names.includes(`${T} Ana`) && names.includes(`${T} Bo`) && names.some(n => n === admin.name || n), "a new sheet fills in crew booked that day and PSG staff assigned");
    ok(!names.includes(`${T} Cy`), "crew booked on other days aren't added");
    ok(sheet.entries.some(e => e.userId === admin.id && e.discipline === "PSG" && e.role === "TECH"), "PSG staff come in under PSG with their day's activity");
    r = await a("/api/productions/1/call-sheets", { method: "POST", body: JSON.stringify({ date: day, title: `${T} empty`, fill: false }) });
    const empty = await r.json(); made.sheets.push(empty.id);
    ok(empty.entries.length === 0, "filling in can be turned off");

    // Call times and a hand-added person
    const ana = sheet.entries.find(e => e.name === `${T} Ana`);
    await a(`/api/call-sheet-entries/${ana.id}`, { method: "PUT", body: JSON.stringify({ callTime: "07:30" }) });
    await a(`/api/call-sheets/${sheet.id}/entries`, { method: "POST", body: JSON.stringify({ discipline: "Wardrobe", name: `${T} Ed`, callTime: "06:45", email: "cs-ed@example.test" }) });
    const list = await (await a("/api/productions/1/call-sheets")).json();
    const s = list.find(x => x.id === sheet.id);
    ok(s.entries[0].name === `${T} Ed` && s.entries[1].name === `${T} Ana`, "the sheet lists everyone by call time");
    ok(s.schedule.length === 1 && s.schedule[0].title === `${T} Get in`, "the day's schedule shows only that day's events");
    ok(s.entries.find(e => e.name === `${T} Bo`).hasEmail === false && s.entries.find(e => e.name === `${T} Ana`).hasEmail === true, "rows say whether there's an email to send to");
    ok(!JSON.stringify(list).includes("cs-ana@example.test"), "crew email addresses aren't sent to the page");

    // Who an email reaches
    const pv = await (await a(`/api/call-sheets/${sheet.id}/send`)).json();
    const to = pv.to.map(x => x.email);
    ok(to.includes("cs-ana@example.test") && to.includes("cs-ed@example.test") && pv.noEmail.includes(`${T} Bo`), "an email reaches crew and hand-added people; those with no email are listed");
    const f = await login(free.email);
    ok((await f(`/api/call-sheets/${sheet.id}/send`)).status === 403, "freelancers on the show can't email call sheets");
    r = await a(`/api/call-sheets/${sheet.id}/send`, { method: "POST", body: JSON.stringify({ pdf: "bm90IGEgcGRm" }) });
    ok(r.status === 400, "something that isn't a PDF isn't sent");
    if (!pv.mailReady) {
      r = await a(`/api/call-sheets/${sheet.id}/send`, { method: "POST", body: JSON.stringify({ pdf: Buffer.from("%PDF-1.4 test").toString("base64") }) });
      ok(r.status === 503, "with email not set up, sending says so instead of failing silently");
    }

    // Changed since sent
    await db.callSheet.update({ where: { id: sheet.id }, data: { sentAt: new Date(Date.now() - 60_000), changedAt: new Date(Date.now() - 120_000) } });
    let again = (await (await a("/api/productions/1/call-sheets")).json()).find(x => x.id === sheet.id);
    ok(again.changedSinceSent === false, "a sheet unchanged since sending isn't flagged");
    await a(`/api/call-sheet-entries/${ana.id}`, { method: "PUT", body: JSON.stringify({ callTime: "07:00" }) });
    again = (await (await a("/api/productions/1/call-sheets")).json()).find(x => x.id === sheet.id);
    ok(again.changedSinceSent === true, "changing a sent sheet flags it 'changed since sent'");

    // Someone booked after the sheet was made
    await db.productionCrew.create({ data: { productionId: 1, crewId: crewLate.id, startDate: D, endDate: D } });
    r = await (await a(`/api/call-sheets/${sheet.id}/fill`, { method: "POST" })).json();
    ok(r.added === 1, "'Add people booked that day' adds only who's missing");
    r = await (await a(`/api/call-sheets/${sheet.id}/fill`, { method: "POST" })).json();
    ok(r.added === 0, "and nobody twice");
  } finally {
    for (const id of made.sheets) await db.callSheet.delete({ where: { id } }).catch(() => {});
    await db.productionCrew.deleteMany({ where: { crewId: { in: made.crew } } });
    await db.crew.deleteMany({ where: { id: { in: made.crew } } });
    await db.staffAssignment.deleteMany({ where: { userId: admin.id, productionId: 1, startDate: D } });
    await db.event.deleteMany({ where: { title: { startsWith: T } } });
  }
});
