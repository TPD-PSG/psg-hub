// The workshop calendar's starting disciplines and how a quote's labour line is matched to one
// (28 Nov 2026). Self-contained so the tests can load it.

export const DEFAULT_DISCIPLINES: { name: string; color: string; also: string[] }[] = [
  { name: "Pre-production", color: "#8a8f96", also: ["preproduction", "pre production", "prep", "planning"] },
  { name: "Technical drawing", color: "#5b7fa6", also: ["drawing", "drawings", "cad", "draughting", "drafting", "technical design"] },
  { name: "CNC", color: "#7a5ea8", also: ["router", "cnc cutting", "cnc routing"] },
  { name: "Carpentry", color: "#c49a6c", also: ["carpenter", "carpenters", "joinery", "joiner"] },
  { name: "Fabrication", color: "#5f6b73", also: ["fabricator", "metalwork", "welding", "welder", "steel", "steelwork"] },
  { name: "Scenic", color: "#3f8f6b", also: ["scenic artist", "scenic art", "paint", "painting", "painter", "finishing"] },
];

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** The discipline a quote's labour line is for, from its description ("Carpenter", "CNC cutting"…). */
export function disciplineFor<D extends { id: number; name: string }>(description: string, disciplines: D[]): D | null {
  const d = key(description);
  const exact = disciplines.find(x => key(x.name) === d);
  if (exact) return exact;
  for (const x of disciplines) {
    const also = DEFAULT_DISCIPLINES.find(dd => key(dd.name) === key(x.name))?.also ?? [];
    if (also.some(a => d === a || d.startsWith(`${a} `) || d.includes(` ${a}`) || d.startsWith(a))) return x;
    if (d.includes(key(x.name))) return x;
  }
  return null;
}

