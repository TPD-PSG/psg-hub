export type UserPerms = { modules: string[]; allProductions: boolean };

// Modules a client can access regardless of stored permissions
const CLIENT_MODULES = new Set(["productions", "venues"]);
// Modules a freelancer can access regardless of stored permissions
const FREELANCER_MODULES = new Set(["productions", "venues", "tasks", "suppliers", "fun", "ask"]);

export function parsePerms(raw: string | null | undefined): UserPerms {
  if (!raw) return { modules: ["bd", "productions", "venues", "tasks", "property", "finance", "sales", "marketing", "suppliers", "fun", "ask"], allProductions: true };
  try { return JSON.parse(raw); } catch { return { modules: [], allProductions: false }; }
}

export function canAccess(perms: UserPerms | null, module: string, role: string): boolean {
  if (role === "admin") return true;
  if (role === "client") return CLIENT_MODULES.has(module);
  if (role === "freelancer") return FREELANCER_MODULES.has(module);
  if (!perms) return false;
  return perms.modules.includes(module);
}
