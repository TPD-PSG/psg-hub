// x-over venue sync (lib/xover-sync.ts). Needs XOVER_SYNC_TOKEN set to the same value for the dev server
// and for `npm test`.
import crypto from "crypto";
import { run, BASE } from "./lib.mjs";

const TOKEN = process.env.XOVER_SYNC_TOKEN ?? "";
const API = "/api/integrations/x-over";
const pause = ms => new Promise(r => setTimeout(r, ms));

export default () => run("xover-sync", async ({ db, users, login, anon, check, results }) => {
  if (TOKEN.length < 32) {
    results.push("FAIL  xover-sync needs XOVER_SYNC_TOKEN (32+ chars) set for the dev server and the tests");
    return;
  }
  const ip = `test-${crypto.randomBytes(6).toString("hex")}`;
  const xo = (path, init = {}, token = TOKEN) => fetch(BASE + API + path, {
    ...init, redirect: "manual",
    headers: { "x-forwarded-for": ip, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const ok = (label, cond) => check("xover", label, Promise.resolve({ status: cond ? 200 : 500 }), 200);
  const created = [];

  try {
    const venue = await db.venue.create({ data: {
      name: "Test x-over Venue", type: "theatre", postcode: "ZZ1 1ZZ", capacity: 900, techNotes: "Flat stage",
      techSpecs: JSON.stringify({ stage: { proscWidthM: "9m", rake: null }, sound: { desk: "" } }),
      techSpecFile: Buffer.from("%PDF-1.4 test").toString("base64"), techSpecName: "Spec.pdf", techSpecMime: "application/pdf",
    } });
    created.push(venue.id);

    // ---- auth ----
    await check("xover", "no token", xo("/venues", {}, ""), 401);
    await check("xover", "wrong token (same length)", xo("/venues", {}, "x".repeat(TOKEN.length)), 401);
    if (process.env.NIGHT_RUN_SYNC_TOKEN) await check("xover", "Night Run's token doesn't work here", xo("/venues", {}, process.env.NIGHT_RUN_SYNC_TOKEN), 401);
    await check("xover", "PATCH, no token", xo(`/venues/${venue.id}`, { method: "PATCH", body: "{}" }, ""), 401);
    await check("xover", "tech spec, no token", xo(`/venues/${venue.id}/tech-spec`, {}, ""), 401);
    const admin = await login(users[3].email);
    await check("admin", "session alone can't use x-over sync", admin(`${API}/venues`), 401);
    await check("public", "x-over sync skips the login redirect", anon(`${API}/venues`), 401);

    // ---- pull ----
    const all = await (await xo("/venues")).json();
    const listed = all.venues.find(v => v.id === venue.id);
    await ok("full pull lists the venue", !!listed);
    await ok("ids lists every venue", all.ids.includes(venue.id) && all.ids.length === all.venues.length);
    await ok("capacity and tech notes come across", listed?.capacity === 900 && listed.techNotes === "Flat stage");
    await ok("tech specs keep only filled-in values", JSON.stringify(listed?.techSpecs) === JSON.stringify({ stage: { proscWidthM: "9m" } }));
    await ok("tech spec file named, not inlined", listed?.techSpecFile?.name === "Spec.pdf" && !("techSpecFileKey" in listed));
    await check("xover", "bad updatedSince", xo("/venues?updatedSince=yesterday"), 400);
    await pause(20);
    let since = all.serverTime;
    let pull = await (await xo(`/venues?updatedSince=${encodeURIComponent(since)}`)).json();
    await ok("unchanged venue not in pull, still in ids", !pull.venues.some(v => v.id === venue.id) && pull.ids.includes(venue.id));

    const file = await xo(`/venues/${venue.id}/tech-spec`);
    await ok("tech spec file downloads", file.status === 200 && (await file.text()).startsWith("%PDF") && file.headers.get("content-type") === "application/pdf");
    await check("xover", "no file → 404", xo("/venues/999999999/tech-spec"), 404);

    // ---- approved change ----
    await pause(20);
    const patch = await xo(`/venues/${venue.id}`, { method: "PATCH", body: JSON.stringify({ phone: "0100 000", capacity: 950, techNotes: null }) });
    await ok("PATCH applies", patch.status === 200);
    const row = await db.venue.findUnique({ where: { id: venue.id } });
    await ok("only sent fields change", row.phone === "0100 000" && row.capacity === 950 && row.techNotes === null && row.name === "Test x-over Venue" && row.postcode === "ZZ1 1ZZ");
    pull = await (await xo(`/venues?updatedSince=${encodeURIComponent(since)}`)).json();
    await ok("change shows in next pull", pull.venues.some(v => v.id === venue.id && v.phone === "0100 000"));

    // ---- validation ----
    const p = body => xo(`/venues/${venue.id}`, { method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body) });
    await check("xover", "unknown field refused", p({ stageDoor: "x" }), 400);
    await check("xover", "empty name refused", p({ name: "" }), 400);
    await check("xover", "capacity as text", p({ capacity: "900" }), 400);
    await check("xover", "notes too long", p({ techNotes: "x".repeat(8001) }), 400);
    await check("xover", "nothing to change", p({}), 400);
    await check("xover", "body not JSON", p("nope"), 400);
    await check("xover", "unknown venue", xo("/venues/999999999", { method: "PATCH", body: JSON.stringify({ phone: "1" }) }), 404);
    await check("xover", "non-numeric id", xo("/venues/abc", { method: "PATCH", body: JSON.stringify({ phone: "1" }) }), 404);

    // ---- create ----
    await check("xover", "POST without name", xo("/venues", { method: "POST", body: JSON.stringify({ city: "Bristol" }) }), 400);
    const post = await xo("/venues", { method: "POST", body: JSON.stringify({ name: "Test x-over New", address: "1 Road, Lane", city: "Testville", postcode: "ZZ9 9ZZ", capacity: 300 }) });
    const made = post.status === 201 ? await post.json() : null;
    if (made?.id) created.push(made.id);
    await ok("POST creates it", post.status === 201);
    const newRow = made?.id ? await db.venue.findUnique({ where: { id: made.id } }) : null;
    await ok("new venue stored as a theatre", newRow?.type === "theatre" && newRow.capacity === 300 && newRow.address === "1 Road, Lane");

    // ---- rate limit on bad tokens ----
    for (let i = 0; i < 20; i++) await xo("/venues", {}, "wrong-token");
    await check("xover", "locked out after 20 bad tokens", xo("/venues"), 429);
  } finally {
    await db.venue.deleteMany({ where: { id: { in: created } } });
  }
});
