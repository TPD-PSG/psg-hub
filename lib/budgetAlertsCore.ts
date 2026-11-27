// Overspend alerts (27 Nov 2026): the shared rule for when a budget line, or a show's whole budget,
// is nearly spent or over. Browser-safe (no prisma), so the Budget tab and the server agree.
//   Net Cost (committed) is what's measured, the same figure the Budget tab turns red on.
//   90 = nearly spent (90% or more of the allocation)   100 = over the allocation   0 = fine
export const NEARLY = 0.9;
export type AlertLevel = 0 | 90 | 100;

export function alertLevel(allocation: number, net: number): AlertLevel {
  const a = Math.round(allocation * 100), n = Math.round(net * 100); // in pence, so £0.001 rounding never trips it
  if (n <= 0) return 0;
  if (n > a) return 100;
  return a > 0 && n >= a * NEARLY ? 90 : 0;
}

type Line = { id: number; department: string; description: string; allocation: number; net: number };
export type BudgetWarning = { lineId: number | null; label: string; allocation: number; net: number; level: 90 | 100 };

/** Lines (and the whole show) that are nearly spent or over, worst first. */
export function budgetWarnings(lines: Line[], totals: { allocation: number; net: number }): BudgetWarning[] {
  const out: BudgetWarning[] = [];
  for (const l of lines) {
    const level = alertLevel(l.allocation, l.net);
    if (level) out.push({ lineId: l.id, label: `${l.department}: ${l.description}`, allocation: l.allocation, net: l.net, level });
  }
  out.sort((x, y) => y.level - x.level || (y.net - y.allocation) - (x.net - x.allocation));
  const total = alertLevel(totals.allocation, totals.net);
  if (total) out.unshift({ lineId: null, label: "Whole budget", allocation: totals.allocation, net: totals.net, level: total });
  return out;
}
