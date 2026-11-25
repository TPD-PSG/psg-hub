// Stock sections (safe for the browser): the suggestions offered, and how the list is grouped.
export const STOCK_SECTIONS = ["Timber", "Sheet materials", "Steel & metal", "Paint & finishes", "Fixings & hardware", "Fabric & soft goods", "Consumables", "Tools & kit"];
export const NO_SECTION = "Other";

/** Items grouped by section: suggested sections in their usual order, then any the team made up (A–Z), then Other. */
export function groupBySection<T extends { section: string | null; name: string }>(items: T[]): { section: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const i of items) {
    const k = i.section?.trim() || NO_SECTION;
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  const rank = (k: string) => (k === NO_SECTION ? 2 : STOCK_SECTIONS.includes(k) ? 0 : 1);
  return [...map.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || (rank(a) === 0 ? STOCK_SECTIONS.indexOf(a) - STOCK_SECTIONS.indexOf(b) : a.localeCompare(b)))
    .map(([section, list]) => ({ section, items: list.sort((x, y) => x.name.localeCompare(y.name)) }));
}
