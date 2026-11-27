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
