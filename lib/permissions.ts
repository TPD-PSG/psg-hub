// spaceEntityIds: the company spaces this person may open (missing = all). Admins ignore it. (25 Nov 2026)
export type UserPerms = { modules: string[]; allProductions: boolean; hiddenSections?: string[]; spaceEntityIds?: number[] };

// Modules a client can access regardless of stored permissions
const CLIENT_MODULES = new Set(["productions", "venues"]);
// Modules a freelancer can access regardless of stored permissions
const FREELANCER_MODULES = new Set(["productions", "venues", "tasks", "suppliers", "fun", "ask"]);

export function parsePerms(raw: string | null | undefined): UserPerms {
  if (!raw) return { modules: ["bd", "productions", "venues", "tasks", "property", "finance", "sales", "marketing", "roadmap", "suppliers", "fun", "ask"], allProductions: true };
  try { return JSON.parse(raw); } catch { return { modules: [], allProductions: false }; }
}

// Production sections hidden by default for restricted roles (can be overridden per-user via permissions)
export const DEFAULT_HIDDEN_SECTIONS: Record<string, string[]> = {
  client: ["budget", "crew", "advancing", "links"],
  freelancer: ["budget", "crew", "advancing", "links"],
};

export function hiddenSectionsFor(role: string, rawPerms: string | null | undefined): Set<string> {
  if (role === "admin") return new Set();
  return new Set(parsePerms(rawPerms).hiddenSections ?? DEFAULT_HIDDEN_SECTIONS[role] ?? []);
}

export function canAccess(perms: UserPerms | null, module: string, role: string): boolean {
  if (role === "admin") return true;
  if (role === "client") return CLIENT_MODULES.has(module);
  if (role === "freelancer") return FREELANCER_MODULES.has(module);
  if (!perms) return false;
  return perms.modules.includes(module);
}
