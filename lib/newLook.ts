// The "New look (beta)" switch (new-look build brief, stage 1, 28 Nov 2026): a per-person setting,
// off by default, kept in the user's preferences. Both looks run on the same data and routes; the
// switch only changes the shell and the pages the brief lists. Admins can turn it on for anyone.
import { prisma } from "./prisma";
import { safeJson } from "./parse";

export const NEW_LOOK_KEY = "newLook";

export async function newLookFor(userId: number | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  return safeJson<Record<string, unknown>>(u?.preferences ?? null, {})[NEW_LOOK_KEY] === true;
}

/** Turn it on or off, keeping every other preference as it is. */
export async function setNewLook(userId: number, on: boolean) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  if (!u) return false;
  const prefs = safeJson<Record<string, unknown>>(u.preferences, {});
  if (on) prefs[NEW_LOOK_KEY] = true; else delete prefs[NEW_LOOK_KEY];
  await prisma.user.update({ where: { id: userId }, data: { preferences: JSON.stringify(prefs) } });
  return true;
}

// ── Home (stage 4) ───────────────────────────────────────────────────────────

export const HOME_ROLES = ["director", "pm", "office"] as const;
export type HomeRole = (typeof HOME_ROLES)[number];
/** The person's Home role: what an admin set, else director for admins and PM for everyone else. */
export const homeRoleOf = (u: { role: string; homeRole?: string | null }): HomeRole =>
  (HOME_ROLES as readonly string[]).includes(u.homeRole ?? "") ? (u.homeRole as HomeRole) : u.role === "admin" ? "director" : "pm";

/** Pinned shortcuts on Home: six menu pages, chosen per person (default by role). */
export const PIN_DEFAULTS: Record<HomeRole, string[]> = {
  director: ["/productions", "/bd", "/finance", "/director", "/calendar", "/jobs"],
  pm: ["/productions?mine=1", "/tasks", "/calendar", "/schedule", "/hotels", "/haulage"],
  office: ["/finance?tab=expenses", "/finance", "/property", "/health-safety", "/suppliers", "/tasks"],
};
export async function pinsFor(userId: number): Promise<string[] | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  const p = safeJson<Record<string, unknown>>(u?.preferences ?? null, {}).pinned;
  return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string").slice(0, 6) : null;
}
export async function setPins(userId: number, hrefs: string[] | null) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  if (!u) return;
  const prefs = safeJson<Record<string, unknown>>(u.preferences, {});
  if (hrefs) prefs.pinned = hrefs.slice(0, 6); else delete prefs.pinned;
  await prisma.user.update({ where: { id: userId }, data: { preferences: JSON.stringify(prefs) } });
}

// ── Needs you: things a person has hidden from their Home (28 Nov 2026) ─────────────────────
// Kept in their preferences as { key: version }. A hidden item comes back by itself if it changes
// (a new due date, an updated budget line), since its version no longer matches.
export const NEEDS_HIDDEN_KEY = "needsHidden";
export const NEED_KEY = /^[a-z]+:[\w:.\-]{1,120}$/;

export async function hiddenNeedsFor(userId: number): Promise<Record<string, string>> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  const h = safeJson<Record<string, unknown>>(u?.preferences ?? null, {})[NEEDS_HIDDEN_KEY];
  return h && typeof h === "object" && !Array.isArray(h) ? Object.fromEntries(Object.entries(h).filter((e): e is [string, string] => typeof e[1] === "string")) : {};
}
/** Change what's hidden: `change` maps key → version to hide, or null to show again; `all: null` shows everything. */
export async function setHiddenNeeds(userId: number, change: Record<string, string | null> | null, keepOnly?: Set<string>) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  if (!u) return {};
  const prefs = safeJson<Record<string, unknown>>(u.preferences, {});
  let hidden: Record<string, string> = change === null ? {} : { ...(await hiddenNeedsFor(userId)) };
  for (const [k, v] of Object.entries(change ?? {})) { if (v === null) delete hidden[k]; else hidden[k] = v; }
  if (keepOnly) hidden = Object.fromEntries(Object.entries(hidden).filter(([k]) => keepOnly.has(k)));
  // Never let the list grow without end: keep the newest 200
  const entries = Object.entries(hidden).slice(-200);
  if (entries.length) prefs[NEEDS_HIDDEN_KEY] = Object.fromEntries(entries); else delete prefs[NEEDS_HIDDEN_KEY];
  await prisma.user.update({ where: { id: userId }, data: { preferences: JSON.stringify(prefs) } });
  return Object.fromEntries(entries);
}
