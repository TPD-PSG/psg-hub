// PM fee payment stages. Default (decided 24 Nov 2026): deposit / fit-up / opening, 30/40/30.
// Editable per production.

export const DEFAULT_FEE_SPLIT = [
  { label: "Deposit", pct: 30 },
  { label: "Fit-up", pct: 40 },
  { label: "Opening", pct: 30 },
] as const;

export type FeeStageInput = { label: string; amount: number; dueDate: string | null };
export type FeeStageRow = { id: number; label: string; amount: number; dueDate: string | null; invoicedAt: string | null; paidAt: string | null; sortOrder: number };

/** Split a fee into the default stages, in whole pounds; any rounding lands on the last stage. */
export function splitFee(total: number, opts: { today?: string; startDate?: string | null } = {}): FeeStageInput[] {
  const amounts = DEFAULT_FEE_SPLIT.map(s => Math.round((total * s.pct) / 100));
  amounts[amounts.length - 1] += Math.round(total) - amounts.reduce((a, b) => a + b, 0);
  // Deposit due now; fit-up and opening default to the production's start date when known
  const due = [opts.today ?? null, opts.startDate ?? null, opts.startDate ?? null];
  return DEFAULT_FEE_SPLIT.map((s, i) => ({ label: s.label, amount: amounts[i], dueDate: due[i] }));
}

/** Clean a stages list from a request body. Returns an error message for anything unusable. */
export type ParsedStage = FeeStageInput & { invoicedAt: string | null; paidAt: string | null };
export function parseStages(raw: unknown): { stages: ParsedStage[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "Stages must be a list" };
  if (raw.length > 20) return { error: "Too many stages" };
  const stages: ParsedStage[] = [];
  for (const s of raw) {
    const label = typeof s?.label === "string" ? s.label.trim() : "";
    const amount = Number(s?.amount);
    if (!label) return { error: "Every stage needs a name" };
    if (!Number.isFinite(amount) || amount < 0) return { error: `"${label}" needs an amount` };
    const d = (v: unknown) => (typeof v === "string" && v ? v : null);
    stages.push({ label: label.slice(0, 60), amount, dueDate: d(s.dueDate), invoicedAt: d(s.invoicedAt), paidAt: d(s.paidAt) });
  }
  return { stages };
}
