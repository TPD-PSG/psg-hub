// Quote rules shared by the quote API, editor and PDF.

export const JOB_TYPES = [
  { key: "pm", label: "Production management" },
  { key: "workshop", label: "Workshop build" },
  { key: "haulage", label: "Haulage (Night Run)" },
  { key: "other", label: "Other" },
] as const;
export const jobTypeLabel = (k: string) => JOB_TYPES.find(t => t.key === k)?.label ?? k;
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "declined"] as const;

export type LineInput = { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; unitPrice: number };
type LineLike = { quantity: number; unitCost: number; unitPrice: number };

/** Cost, sell (net), VAT, total and margin for a set of lines. */
export function quoteTotals(lines: LineLike[], vatRate: number) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const cost = r2(lines.reduce((s, l) => s + l.quantity * l.unitCost, 0));
  const net = r2(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const vat = r2((net * vatRate) / 100);
  const margin = r2(net - cost);
  return { cost, net, vat, gross: r2(net + vat), margin, marginPct: net ? (margin / net) * 100 : null };
}

/** Clean a list of lines from a request body, or say what's wrong. */
export function parseLines(raw: unknown): { lines: LineInput[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "Lines must be a list" };
  if (raw.length > 300) return { error: "Too many lines" };
  const lines: LineInput[] = [];
  for (const [i, l] of raw.entries()) {
    const description = typeof l?.description === "string" ? l.description.trim() : "";
    if (!description) return { error: `Line ${i + 1} needs a description` };
    const n = (v: unknown, d = 0) => (v === "" || v == null ? d : Number(v));
    const quantity = n(l.quantity, 1), unitCost = n(l.unitCost), unitPrice = n(l.unitPrice);
    if (![quantity, unitCost, unitPrice].every(Number.isFinite)) return { error: `Line ${i + 1}: numbers only for quantity, cost and price` };
    const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);
    lines.push({ section: t(l.section), description: description.slice(0, 500), quantity, unit: t(l.unit), unitCost, unitPrice });
  }
  return { lines };
}

/** Next number like Q-2026-007 / J-2026-007, from the numbers already used this year. */
export function nextNumber(prefix: "Q" | "J" | "PO", year: number, existing: string[]): string {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max = existing.reduce((m, s) => Math.max(m, Number(re.exec(s)?.[1] ?? 0)), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;
}
