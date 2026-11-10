export type UserPerms = { modules: string[]; allProductions: boolean };

export function parsePerms(raw: string | null | undefined): UserPerms {
  if (!raw) return { modules: ["bd", "productions", "venues", "tasks", "property", "finance", "sales"], allProductions: true };
  try { return JSON.parse(raw); } catch { return { modules: [], allProductions: false }; }
}

export function canAccess(perms: UserPerms | null, module: string, role: string): boolean {
  if (role === "admin") return true;
  if (!perms) return false;
  return perms.modules.includes(module);
}
