// Contact-sheet sections. Company defaults live in the Setting table under SETTING_KEY;
// each production can add its own list (Production.contactSections). Both are JSON string arrays.
export const BUILTIN_CONTACT_SECTIONS = ["General", "Creative Team", "Production Team", "Show Team", "Cast", "Venue", "Press & Marketing", "Transport & Haulage"];
export const CONTACT_SECTIONS_SETTING = "contact_sections";

export function parseSections(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? cleanSections(v) : [];
  } catch { return []; }
}

export function cleanSections(list: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    if (typeof s !== "string") continue;
    const t = s.trim().slice(0, 60);
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
  }
  return out.slice(0, 50);
}

// Company defaults, falling back to the built-in list until an admin sets one
export function defaultSections(settingValue: string | null | undefined): string[] {
  const list = parseSections(settingValue);
  return list.length ? list : BUILTIN_CONTACT_SECTIONS;
}
