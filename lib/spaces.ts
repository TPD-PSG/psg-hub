// Company spaces (e.g. The Workshop Stoke): a company with its own home page, colours and logo
// inside the Hub. People whose home company has a space land on it and see its theme.
import { prisma } from "@/lib/prisma";
import { spaceLogoUrl } from "@/lib/entities";
import { parsePerms } from "@/lib/permissions";

export type SpaceTheme = { id: number; name: string; shortName: string | null; slug: string; color: string | null; logoUrl: string | null };

const THEME_SELECT = { id: true, name: true, shortName: true, slug: true, color: true, logoMime: true, updatedAt: true, hasSpace: true, archived: true };
const toTheme = (e: { id: number; name: string; shortName: string | null; slug: string | null; color: string | null; logoMime: string | null; updatedAt: Date }): SpaceTheme =>
  ({ id: e.id, name: e.name, shortName: e.shortName, slug: e.slug!, color: e.color, logoUrl: spaceLogoUrl(e) });

/** The space of this person's home company, if it has one switched on. */
export async function homeSpaceFor(userId: number): Promise<SpaceTheme | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { homeEntity: { select: THEME_SELECT } } });
  const e = u?.homeEntity;
  if (!(e && e.hasSpace && !e.archived && e.slug)) return null;
  const l = await spaceLimitFor(userId);
  return !l.ids || l.ids.includes(e.id) ? toTheme(e) : null;
}

export async function spaceBySlug(slug: string): Promise<SpaceTheme | null> {
  const e = await prisma.entity.findUnique({ where: { slug }, select: THEME_SELECT });
  return e && e.hasSpace && !e.archived && e.slug ? toTheme(e) : null;
}

/**
 * Which companies' spaces a person may open, read fresh from the database (so a change in
 * Admin → Users applies straight away). null = no limit. Admins are never limited.
 */
export async function spaceLimitFor(userId: number): Promise<{ role: string; homeEntityId: number | null; ids: number[] | null }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, permissions: true, homeEntityId: true } });
  if (!u) return { role: "none", homeEntityId: null, ids: [] };
  const ids = u.role === "admin" ? null : parsePerms(u.permissions).spaceEntityIds;
  return { role: u.role, homeEntityId: u.homeEntityId, ids: Array.isArray(ids) ? ids.map(Number) : null };
}

/**
 * Admins open any space. PSG staff open any space unless limited to some companies in Admin →
 * Users. Anyone else only their own company's (and only if their limit allows it).
 */
export async function canSeeSpace(user: { id: number; role: string }, spaceId: number) {
  if (user.role === "admin") return true;
  const l = await spaceLimitFor(user.id);
  if (l.ids && !l.ids.includes(spaceId)) return false;
  if (l.role === "admin" || l.role === "member") return true;
  return l.homeEntityId === spaceId;
}

/** Same rule for a record that belongs to a company (stock, POs…); untagged records are hidden from limited people. */
export async function canSeeCompanyRecord(user: { id: number; role: string }, entityId: number | null) {
  if (user.role === "admin") return true;
  const l = await spaceLimitFor(user.id);
  if (!l.ids) return true;
  return entityId != null && l.ids.includes(entityId);
}

/** Text that reads well on a background colour */
export function textOn(hex: string | null): "#ffffff" | "#0a193d" {
  if (!hex) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? "#0a193d" : "#ffffff";
}

/** The spaces a person can open: PSG staff see every switched-on space, others their own company's. */
export async function spacesFor(user: { id: number; role: string }): Promise<SpaceTheme[]> {
  const l = await spaceLimitFor(user.id);
  if (user.role === "admin" || user.role === "member") {
    const all = await prisma.entity.findMany({ where: { hasSpace: true, archived: false, slug: { not: null }, ...(l.ids ? { id: { in: l.ids } } : {}) }, select: THEME_SELECT, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    return all.map(toTheme);
  }
  const home = await homeSpaceFor(user.id);
  return home && (!l.ids || l.ids.includes(home.id)) ? [home] : [];
}
