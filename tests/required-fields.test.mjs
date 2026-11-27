import { run } from "./lib.mjs";

// Required fields (27 Nov 2026): an empty form or a blanked-out field gets a plain answer saying
// what's needed, never a server error or a half-empty record; an upload with no file likewise.
export default () => run("required-fields", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const a = await login(users[3].email);
  const empty = ["crew", "expenses", "help-tickets", "hotels", "invoices", "marketing", "productions/2/budget", "productions/2/contacts", "productions/2/crew", "productions/2/links", "productions/2/notes", "productions/2/task-lists", "productions/2/team", "productions/2/tour-stops", "productions", "property/alarms", "property/contacts", "property/keys", "property/maintenance", "property/documents", "quicklinks", "roadmap", "sales/brands", "sales/tasks", "suppliers", "tasks", "venues"];
  const bad = [];
  for (const path of empty) {
    const r = await a(`/api/${path}`, { method: "POST", body: "{}" });
    const d = await r.json().catch(() => ({}));
    if (r.status !== 400 || typeof d.error !== "string") bad.push(`${path} ${r.status}`);
  }
  ok(bad.length === 0, `an empty form on ${empty.length} create screens says what's missing${bad.length ? ` (not: ${bad.join(", ")})` : ""}`);
  let r = await a("/api/tasks", { method: "POST", body: JSON.stringify({ title: "   " }) });
  ok(r.status === 400 && (await r.json()).field === "title", "spaces alone don't count as filled in");

  // Edits: a blank required field is refused, other changes still save
  const before = await db.production.findUnique({ where: { id: 2 }, select: { name: true } });
  r = await a("/api/productions/2", { method: "PUT", body: JSON.stringify({ name: "" }) });
  ok(r.status === 400 && (await db.production.findUnique({ where: { id: 2 }, select: { name: true } })).name === before.name, "a show's name can't be blanked");
  const venue = await db.venue.create({ data: { name: "Required test venue", type: "theatre" } });
  try {
    r = await a(`/api/venues/${venue.id}`, { method: "PUT", body: JSON.stringify({ name: " " }) });
    ok(r.status === 400 && (await db.venue.findUnique({ where: { id: venue.id } })).name === "Required test venue", "nor a venue's");
  } finally { await db.venue.delete({ where: { id: venue.id } }).catch(() => {}); }

  // Uploads with no file
  const up = ["productions/2/documents", "productions/2/hs-documents", "fun/submissions"];
  const crashed = [];
  for (const path of up) { const x = await a(`/api/${path}`, { method: "POST", body: "{}" }); if (x.status >= 500) crashed.push(`${path} ${x.status}`); }
  ok(crashed.length === 0, `an upload with no file gets an answer, not a server error${crashed.length ? ` (${crashed.join(", ")})` : ""}`);
});
