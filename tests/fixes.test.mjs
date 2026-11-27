import { run } from "./lib.mjs";

export default () => run("fixes", async ({ db, users, login, anon, check, results }) => {
  const f = await login(users[0].email), m = await login(users[2].email), a = await login(users[3].email);
  const made = [];
  const p2 = await db.production.findUnique({ where: { id: 2 }, select: { status: true, announcementStatus: true, archived: true } });
  await db.production.update({ where: { id: 2 }, data: { status: "in-production", announcementStatus: "open", archived: false } }); // old numeric toolbox links only open live shows
  const restoreP2 = () => db.production.update({ where: { id: 2 }, data: p2 }).catch(() => {});
  try {
    // money and dates
    let r = await a("/api/productions/1/budget", { method: "POST", body: JSON.stringify({ department: "Test", description: "money test", budgeted: "£1,200.50" }) });
    let d = await r.json(); if (d?.id) made.push(["budgetLine", d.id]);
    results.push(`${d?.budgeted === 1200.5 ? "PASS" : "FAIL"}  budget "£1,200.50" saves as ${d?.budgeted}`);
    if (d?.id) { r = await a(`/api/budget-lines/${d.id}`, { method: "PUT", body: JSON.stringify({ department: "Test", description: "x", budgeted: "2,500" }) }); d = await r.json(); results.push(`${d?.budgeted === 2500 ? "PASS" : "FAIL"}  budget edit "2,500" saves as ${d?.budgeted}`); }
    await check("admin", "hotel booking with no dates", a("/api/productions/1/hotel-bookings", { method: "POST", body: JSON.stringify({ hotelId: 1 }) }), 400);
    await check("admin", "key date with bad date", a("/api/productions/1/key-dates", { method: "POST", body: JSON.stringify({ title: "x", startDate: "not a date" }) }), 400);
    // ingest is staff-only
    await check("freelancer", "run paid report import", f("/api/show-reports/ingest", { method: "POST" }), 403);
    await check("freelancer", "run paid re-parse", f("/api/show-reports/reparse", { method: "POST" }), 403);
    // session update can't grant permissions
    const csrf = (await (await m("/api/auth/csrf")).json()).csrfToken;
    await m("/api/auth/session", { method: "POST", body: JSON.stringify({ csrfToken: csrf, data: { permissions: JSON.stringify({ modules: ["finance"], allProductions: true }) } }) });
    await check("member", "finance after trying to self-grant", m("/api/invoices"), 403);
    // upload cap
    await check("admin", "26 MB upload refused", a("/api/productions/1/show-reports/upload-pdf", { method: "POST", body: "x".repeat(26 * 1024 * 1024) }), 413);
    // toolbox sign-off validation (public)
    const sig = b => anon("/api/productions/2/toolbox-signatures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    await check("public", "sign-off with no signature", sig({ signeeName: "A", signeeDate: "2026-11-23" }), 400);
    await check("public", "sign-off for unknown production", anon("/api/productions/999999/toolbox-signatures", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), 404);
    await check("public", "sign-off with another prod's stop", sig({ signeeName: "A", signeeDate: "2026-11-23", signature: "data:image/png;base64,AAAA", tourStopId: 99999999 }), 400);
    r = await sig({ signeeName: "Test Signee", signeeDate: "2026-11-23", signature: "data:image/png;base64,AAAA" }); d = await r.json(); if (d?.id) made.push(["toolboxTalkSignature", d.id]);
    results.push(`${r.status === 201 ? "PASS" : "FAIL"}  public      valid sign-off accepted (${r.status})`);
    // show report list doesn't carry PDFs
    r = await a("/api/productions/1/show-reports"); d = await r.json();
    results.push(`${r.status === 200 && Array.isArray(d) && d.every(x => typeof x.rawPdf === "boolean") ? "PASS" : "FAIL"}  show-report list has PDF flag only (${d.length} reports)`);
    // sidebar endpoint + prefs
    await check("admin", "preferences read", a("/api/me/preferences"), 200);
  } finally {
    await restoreP2();
    for (const [model, id] of made) await db[model].delete({ where: { id } }).catch(() => {});
  }
});
