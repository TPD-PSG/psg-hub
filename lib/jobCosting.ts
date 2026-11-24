// Job costing: what a job is worth and what it actually cost us (decided 24 Nov 2026).
//   Price  = the accepted quote's price (ex VAT); else the job's agreed price; else, for a PM
//            job, its production's PM fee.
//   Actual = staff days × each person's day rate when logged
//            + costs logged against the job
//            + for a PM job, items marked "PSG expense" on its show's budget (spent, else committed).
//   Margin = price − actual. Quoted cost/margin come from the accepted quote, to compare.
import { quoteTotals } from "@/lib/quotes";

type QuoteLike = { status: string; vatRate: number; lines: { quantity: number; unitCost: number; unitPrice: number }[] };
export type JobFiguresInput = {
  price: number | null;
  productionPmFee?: number | null;
  quotes: QuoteLike[];
  time: { days: number; dayRate: number | null }[];
  costs: { amount: number }[];
  psgExpenses: { spent: number; committed: number }[];
};
export type JobFigures = {
  price: number | null; priceFrom: "quote" | "agreed" | "pm fee" | null;
  quotedCost: number | null; quotedMargin: number | null;
  days: number; timeCost: number; unratedDays: number; costs: number; psgExpenses: number; actual: number;
  margin: number | null; marginPct: number | null;
};

export function jobFigures(j: JobFiguresInput): JobFigures {
  const accepted = j.quotes.find(q => q.status === "accepted");
  const qt = accepted ? quoteTotals(accepted.lines, accepted.vatRate) : null;
  const price = qt ? qt.net : j.price ?? j.productionPmFee ?? null;
  const priceFrom = qt ? "quote" : j.price != null ? "agreed" : j.productionPmFee != null ? "pm fee" : null;
  const days = j.time.reduce((s, t) => s + t.days, 0);
  const timeCost = j.time.reduce((s, t) => s + t.days * (t.dayRate ?? 0), 0);
  const unratedDays = j.time.filter(t => t.dayRate == null).reduce((s, t) => s + t.days, 0);
  const costs = j.costs.reduce((s, c) => s + c.amount, 0);
  const psgExpenses = j.psgExpenses.reduce((s, e) => s + (e.spent || e.committed || 0), 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const actual = r2(timeCost + costs + psgExpenses);
  const margin = price == null ? null : r2(price - actual);
  return {
    price, priceFrom, quotedCost: qt?.cost ?? null, quotedMargin: qt?.margin ?? null,
    days, timeCost: r2(timeCost), unratedDays, costs: r2(costs), psgExpenses: r2(psgExpenses), actual,
    margin, marginPct: price ? ((margin ?? 0) / price) * 100 : null,
  };
}

export const COST_CATEGORIES = ["Materials", "Hire", "Transport", "Subcontract", "Travel & subsistence", "Other"];

export type MarginGroup = { key: string; label: string; jobs: number; price: number; actual: number; margin: number; marginPct: number | null };
type GroupableJob = { status: string; jobType: string; entity: { name: string } | null; client: { name: string } | null; figures: JobFigures | null };

/** Margin by company, client or type of work, over jobs that have a price (cancelled jobs left out). */
export function marginBy(jobs: GroupableJob[], by: "entity" | "client" | "type", typeLabel: (k: string) => string): MarginGroup[] {
  const groups = new Map<string, MarginGroup>();
  for (const j of jobs) {
    if (j.status === "cancelled" || !j.figures || j.figures.price == null) continue;
    const label = by === "entity" ? j.entity?.name ?? "No company" : by === "client" ? j.client?.name ?? "No client" : typeLabel(j.jobType);
    const g = groups.get(label) ?? { key: label, label, jobs: 0, price: 0, actual: 0, margin: 0, marginPct: null };
    g.jobs++; g.price += j.figures.price; g.actual += j.figures.actual; g.margin += j.figures.price - j.figures.actual;
    groups.set(label, g);
  }
  return [...groups.values()].map(g => ({ ...g, marginPct: g.price ? (g.margin / g.price) * 100 : null })).sort((a, b) => b.price - a.price);
}
