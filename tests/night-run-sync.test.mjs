// Night Run venue sync (contract: night-run/docs/HUB_SYNC.md). Needs NIGHT_RUN_SYNC_TOKEN set to the
// same value for the dev server and for `npm test`.
import crypto from "crypto";
import { run, BASE } from "./lib.mjs";

const TOKEN = process.env.NIGHT_RUN_SYNC_TOKEN ?? "";
const API = "/api/integrations/night-run";
const pause = ms => new Promise(r => setTimeout(r, ms));

export default () => run("night-run-sync", async ({ db, users, login, anon, check, results }) => {
  if (TOKEN.length < 32) {
    results.push("FAIL  night-run-sync needs NIGHT_RUN_SYNC_TOKEN (32+ chars) set for the dev server and the tests");
    return;
  }
  // Each run gets its own client address so the per-IP limits don't carry over between runs
  const ip = `test-${crypto.randomBytes(6).toString("hex")}`;
  const nr = (path, init = {}, token = TOKEN) => fetch(BASE + API + path, {
    ...init, redirect: "manual",
    headers: { "x-forwarded-for": ip, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const json = (label, p, test) => check("nightrun", label, p.then(async r => ({ status: r.status === 200 || r.status === 201 ? (test(await r.json()) ? 200 : 500) : r.status })), 200);
  const created = [];

  try {
    const venue = await db.venue.create({ data: { name: "Test Night Run Venue", type: "theatre", postcode: "ZZ1 1ZZ" } });
    created.push(venue.id);

    // ---- auth ----
    await check("nightrun", "no token", nr("/venues", {}, ""), 401);
    await check("nightrun", "wrong token (same length)", nr("/venues", {}, "x".repeat(TOKEN.length)), 401);
    await check("nightrun", "wrong token (prefix of real one)", nr("/venues", {}, TOKEN.slice(0, -1)), 401);
    await check("nightrun", "Basic instead of Bearer", nr("/venues", { headers: { Authorization: `Basic ${TOKEN}` } }, ""), 401);
    await check("nightrun", "PUT drop-off, no token", nr(`/venues/${venue.id}/drop-off`, { method: "PUT", body: "{}" }, ""), 401);
    await check("nightrun", "POST venue, no token", nr("/venues", { method: "POST", body: JSON.stringify({ name: "x" }) }, ""), 401);
    const admin = await login(users[3].email);
    await check("admin", "session alone can't use sync API", admin(`${API}/venues`), 401);
    await check("nightrun", "right token", nr("/venues"), 200);
    await check("public", "sync API skips the login redirect", anon(`${API}/venues`), 401);

    // ---- updatedSince ----
    await check("nightrun", "bad updatedSince", nr("/venues?updatedSince=yesterday"), 400);
    const all = await (await nr("/venues")).json();
    await check("nightrun", "full pull lists the venue", Promise.resolve({ status: all.venues.some(v => v.id === venue.id) ? 200 : 500 }), 200);
    const listed = all.venues.find(v => v.id === venue.id);
    await check("nightrun", "dropOff is null before any push", Promise.resolve({ status: listed?.dropOff === null ? 200 : 500 }), 200);

    await pause(20);
    let since = all.serverTime;
    const has = body => body.venues.some(v => v.id === venue.id);
    await json("unchanged venue not in pull", nr(`/venues?updatedSince=${encodeURIComponent(since)}`), b => !has(b));

    // Contact added through the normal (session) venue API bumps the venue
    await pause(20);
    const addContact = await admin(`/api/venues/${venue.id}/contacts`, { method: "POST", body: JSON.stringify({ name: "Sam Stage", role: "Stage door", phone: "0100" }) });
    const contact = await addContact.json();
    await json("new contact shows in pull", nr(`/venues?updatedSince=${encodeURIComponent(since)}`),
      b => b.venues.find(v => v.id === venue.id)?.contacts.some(c => c.id === contact.id && c.name === "Sam Stage" && !("notes" in c)));

    since = (await (await nr("/venues")).json()).serverTime;
    await pause(20);
    await admin(`/api/venue-contacts/${contact.id}`, { method: "PUT", body: JSON.stringify({ role: "Stage manager" }) });
    await json("edited contact shows in pull", nr(`/venues?updatedSince=${encodeURIComponent(since)}`),
      b => b.venues.find(v => v.id === venue.id)?.contacts[0]?.role === "Stage manager");

    since = (await (await nr("/venues")).json()).serverTime;
    await pause(20);
    await admin(`/api/venue-contacts/${contact.id}`, { method: "DELETE" });
    await json("deleted contact shows in pull", nr(`/venues?updatedSince=${encodeURIComponent(since)}`),
      b => b.venues.find(v => v.id === venue.id)?.contacts.length === 0);

    // ---- drop-off round trip ----
    const dropOff = {
      loadingAddress: "Stage door, Back Lane", loadingPostcode: "ZZ1 2ZZ", what3words: "///index.home.raft",
      accessTimes: "08:00–18:00", maxVehicle: "13.6m artic", heightLimitMm: 4300, widthLimitMm: 2550,
      dockNotes: "Dock level", unloadingNotes: "Push 40m to stage", forkliftOnSite: true,
      parkingNotes: "Park on Back Lane after tip", emissionZone: "Clean Air Zone D",
    };
    since = (await (await nr("/venues")).json()).serverTime;
    await pause(20);
    await json("PUT drop-off returns updatedAt", nr(`/venues/${venue.id}/drop-off`, { method: "PUT", body: JSON.stringify(dropOff) }),
      b => !isNaN(Date.parse(b.updatedAt)));
    await json("drop-off change shows in pull, all fields", nr(`/venues?updatedSince=${encodeURIComponent(since)}`),
      b => JSON.stringify(b.venues.find(v => v.id === venue.id)?.dropOff) === JSON.stringify(dropOff));
    await json("PUT with fields missing nulls them", nr(`/venues/${venue.id}/drop-off`, { method: "PUT", body: JSON.stringify({ maxVehicle: "7.5t" }) }), () => true);
    await json("…and the pull shows nulls", nr("/venues"), b => {
      const d = b.venues.find(v => v.id === venue.id)?.dropOff;
      return d?.maxVehicle === "7.5t" && d.heightLimitMm === null && d.forkliftOnSite === null && d.loadingAddress === null;
    });
    await json("venue page API includes drop-off", admin("/api/venues"), b => b.find(v => v.id === venue.id)?.dropOff?.maxVehicle === "7.5t");

    // ---- validation ----
    const put = body => nr(`/venues/${venue.id}/drop-off`, { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) });
    await check("nightrun", "height as text", put({ heightLimitMm: "4300" }), 400);
    await check("nightrun", "height not whole", put({ heightLimitMm: 4300.5 }), 400);
    await check("nightrun", "negative width", put({ widthLimitMm: -1 }), 400);
    await check("nightrun", "forklift as string", put({ forkliftOnSite: "yes" }), 400);
    await check("nightrun", "notes too long", put({ dockNotes: "x".repeat(4001) }), 400);
    await check("nightrun", "postcode as number", put({ loadingPostcode: 12345 }), 400);
    await check("nightrun", "body not JSON", put("not json"), 400);
    await check("nightrun", "body is an array", put([]), 400);
    await check("nightrun", "unknown venue", nr("/venues/999999999/drop-off", { method: "PUT", body: "{}" }), 404);
    await check("nightrun", "non-numeric venue id", nr("/venues/abc/drop-off", { method: "PUT", body: "{}" }), 404);

    // ---- create ----
    await check("nightrun", "POST without name", nr("/venues", { method: "POST", body: JSON.stringify({ city: "Bristol" }) }), 400);
    await check("nightrun", "POST bad dropOff", nr("/venues", { method: "POST", body: JSON.stringify({ name: "x", dropOff: "big" }) }), 400);
    const post = await nr("/venues", { method: "POST", body: JSON.stringify({
      name: "Test Night Run Barn", type: "Barn", address: "1 Farm Road", city: "Testville", postcode: "ZZ9 9ZZ",
      phone: null, email: null, website: null, dropOff: { maxVehicle: "18t rigid", forkliftOnSite: false },
    }) });
    const made = post.status === 201 ? await post.json() : null;
    if (made?.id) created.push(made.id);
    await check("nightrun", "POST venue creates it", Promise.resolve({ status: post.status }), 201);
    const row = made?.id ? await db.venue.findUnique({ where: { id: made.id }, include: { dropOff: true } }) : null;
    await check("nightrun", "unknown type stored as other", Promise.resolve({ status: row?.type === "other" ? 200 : 500 }), 200);
    await check("nightrun", "POST stores its drop-off", Promise.resolve({ status: row?.dropOff?.maxVehicle === "18t rigid" && row.dropOff.forkliftOnSite === false ? 200 : 500 }), 200);

    // ---- rate limit on bad tokens ----
    for (let i = 0; i < 20; i++) await nr("/venues", {}, "wrong-token");
    await check("nightrun", "locked out after 20 bad tokens", nr("/venues"), 429);
  } finally {
    await db.venue.deleteMany({ where: { id: { in: created } } });
  }
});
