// Quote line sections and the units that make sense for each (workshop feedback, 27 Nov 2026):
// picking a section narrows the unit list, e.g. Timber offers metres and lengths, Labour offers
// hours and days. Anyone can still type their own unit.
// (Self-contained so tests can load it; tests/quote-builder checks it lists every stock section.)

const MATERIAL = ["m", "m²", "m³", "lengths", "sheets", "each", "kg", "L", "rolls", "packs", "boxes"];
const BY_SECTION: Record<string, string[]> = {
  "Timber": ["m", "lengths", "m²", "m³", "each"],
  "Sheet materials": ["sheets", "m²", "each"],
  "Steel & metal": ["m", "lengths", "kg", "each"],
  "Paint & finishes": ["L", "tins", "m²", "each"],
  "Fixings & hardware": ["each", "boxes", "packs", "kg"],
  "Fabric & soft goods": ["m", "m²", "rolls", "each"],
  "Consumables": ["each", "rolls", "packs", "boxes", "L"],
  "Tools & kit": ["day", "week", "each"],
  "Materials": MATERIAL,
  "Labour": ["hour", "hours", "day", "days", "week", "weeks"],
  "Design": ["hour", "hours", "day", "days", "each"],
  "Transport": ["load", "loads", "mile", "miles", "day", "days"],
  "Pre-production": ["day", "days", "week", "weeks", "each"],
  "Fit-up": ["day", "days", "hour", "hours", "each"],
  "Running": ["day", "days", "week", "weeks", "show", "shows"],
  "Get-out": ["day", "days", "hour", "hours", "each"],
};
const ALL = ["each", "hour", "hours", "day", "days", "week", "weeks", "m", "m²", "m³", "lengths", "sheets", "kg", "L", "rolls", "load", "mile"];

export const QUOTE_SECTIONS = ["Labour", "Design", "Timber", "Sheet materials", "Steel & metal", "Paint & finishes", "Fixings & hardware", "Fabric & soft goods", "Consumables", "Tools & kit", "Materials", "Transport", "Pre-production", "Fit-up", "Running", "Get-out"];

/** Units offered for a line in this section (case-insensitive match). A section that's a quote item
 *  (e.g. "Coffin Refit") falls back to the line's type: labour gets time, material gets material units. */
export function unitsFor(section: string | null | undefined, kind?: string | null): string[] {
  const key = Object.keys(BY_SECTION).find(k => k.toLowerCase() === (section ?? "").trim().toLowerCase());
  if (key) return BY_SECTION[key];
  if (kind === "labour") return BY_SECTION["Labour"];
  if (kind === "material") return MATERIAL;
  return ALL;
}
