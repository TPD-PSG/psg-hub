// What the entities API returns for each entity (with its yearly targets and space settings)
export const ENTITY_SELECT = {
  id: true, name: true, archived: true, sortOrder: true,
  hasSpace: true, slug: true, shortName: true, color: true, logoMime: true, updatedAt: true, address: true, phone: true, spaceKind: true,
  targets: { select: { year: true, amount: true }, orderBy: { year: "asc" as const } },
};
export type EntityRow = {
  id: number; name: string; archived: boolean; sortOrder: number;
  hasSpace: boolean; slug: string | null; shortName: string | null; color: string | null; logoMime: string | null; updatedAt: string; address?: string | null; phone?: string | null; spaceKind?: string;
  targets: { year: number; amount: number }[];
};

// Space web addresses: lowercase letters, digits and dashes; a few words are kept for the app
const RESERVED = new Set(["new", "api", "admin", "settings", "all"]);
export function checkSlug(raw: unknown): { slug: string | null } | { error: string } {
  if (raw === null || raw === "") return { slug: null };
  if (typeof raw !== "string") return { error: "Web address must be text" };
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(slug)) return { error: "Web address: 2–30 lowercase letters, numbers or dashes" };
  if (RESERVED.has(slug)) return { error: `"${slug}" is reserved` };
  return { slug };
}
export const checkColor = (raw: unknown) => (raw === null || raw === "" ? null : typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : undefined);
/** Where a space's logo is served (cache-busted by the entity's last update) */
export const spaceLogoUrl = (e: { slug: string | null; logoMime: string | null; updatedAt: Date | string }) =>
  e.slug && e.logoMime ? `/api/spaces/${e.slug}/logo?v=${new Date(e.updatedAt).getTime()}` : null;
