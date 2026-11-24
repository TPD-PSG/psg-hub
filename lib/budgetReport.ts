// One place that works out a production's budget figures, used by the Budget tab and by the
// PDF/Excel exports so they always agree.
//   Allocation = the line's budget (approved variations are already added into it)
//   PM Budget  = estimated      Net Cost = committed      Gross Cost = spent
//   Variance   = Allocation − Net Cost (negative = over budget)
// Haulage movements count towards the line they're linked to (estimate → PM, actual → Net);
// unlinked movements and venue contra get their own rows. Neither has a gross figure.

export type ReportExpense = {
  id?: number;
  phase: string;
  description: string;
  estimated: number;
  committed: number;
  spent: number;
  supplier: string | null;
  poNumber: string | null;
  paymentDue: string | null;
  issuedForPayment: boolean;
  vatExempt: boolean;
  notes: string | null;
  isPSGExpense?: boolean;
  paymentMethod?: string | null;
};
export type ReportBudgetLine = {
  id: number;
  department: string;
  description: string;
  nominalCode?: string | null;
  budgeted: number;
  notes?: string | null;
  expenses: ReportExpense[];
};
export type ReportMovement = {
  id?: number;
  haulageCompany: string;
  fromLocation: string;
  toLocation: string;
  departureAt: string;
  cargo: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  rechargeable: boolean;
  budgetLineId: number | null;
};
export type ReportTourStop = {
  id?: number;
  stopNumber: number;
  venue: { name: string; city?: string | null };
  contraEstimate: number | null;
  contraActual: number | null;
};

export type Figures = { allocation: number; pm: number; net: number; gross: number; variance: number };
export type ReportLine = Figures & {
  id: number;
  department: string;
  description: string;
  nominalCode: string | null;
  notes: string | null;
  items: ReportExpense[];
  psgItems: ReportExpense[];
  movements: ReportMovement[];
};
export type ReportDepartment = Figures & { name: string; lines: ReportLine[] };
export type BudgetReport = {
  departments: ReportDepartment[];
  lineById: Map<number, ReportLine>;
  unlinkedHaulage: { movements: ReportMovement[]; pm: number; net: number };
  contra: { stops: ReportTourStop[]; pm: number; net: number };
  totals: Figures;
};

const sum = <T,>(items: T[], f: (x: T) => number) => items.reduce((s, x) => s + f(x), 0);
const est = (m: ReportMovement) => m.estimatedCost ?? 0;
const act = (m: ReportMovement) => m.actualCost ?? 0;
const withVariance = (f: Omit<Figures, "variance">): Figures => ({ ...f, variance: f.allocation - f.net });

export function buildBudgetReport(
  lines: ReportBudgetLine[],
  haulage: ReportMovement[],
  tourStops: ReportTourStop[],
  deptOrder?: string[] | null,
): BudgetReport {
  const lineById = new Map<number, ReportLine>();
  const byDept = new Map<string, ReportLine[]>();
  for (const l of lines) {
    const movements = haulage.filter(m => m.budgetLineId === l.id);
    const line: ReportLine = {
      id: l.id,
      department: l.department,
      description: l.description,
      nominalCode: l.nominalCode ?? null,
      notes: l.notes ?? null,
      items: l.expenses.filter(x => !x.isPSGExpense),
      psgItems: l.expenses.filter(x => x.isPSGExpense),
      movements,
      ...withVariance({
        allocation: l.budgeted,
        pm: sum(l.expenses, x => x.estimated) + sum(movements, est),
        net: sum(l.expenses, x => x.committed) + sum(movements, act),
        gross: sum(l.expenses, x => x.spent),
      }),
    };
    lineById.set(l.id, line);
    if (!byDept.has(l.department)) byDept.set(l.department, []);
    byDept.get(l.department)!.push(line);
  }

  // Saved order first, then any departments it doesn't mention, in the order they appear
  const natural = [...byDept.keys()];
  const order = deptOrder
    ? [...deptOrder.filter(d => byDept.has(d)), ...natural.filter(d => !deptOrder.includes(d))]
    : natural;
  const departments: ReportDepartment[] = order.map(name => {
    const ls = byDept.get(name)!;
    return {
      name,
      lines: ls,
      ...withVariance({
        allocation: sum(ls, l => l.allocation),
        pm: sum(ls, l => l.pm),
        net: sum(ls, l => l.net),
        gross: sum(ls, l => l.gross),
      }),
    };
  });

  const linkedIds = new Set(lines.map(l => l.id));
  const unlinked = haulage.filter(m => m.budgetLineId == null || !linkedIds.has(m.budgetLineId));
  const unlinkedHaulage = { movements: unlinked, pm: sum(unlinked, est), net: sum(unlinked, act) };
  const stops = [...tourStops].sort((a, b) => a.stopNumber - b.stopNumber);
  const contra = { stops, pm: sum(stops, t => t.contraEstimate ?? 0), net: sum(stops, t => t.contraActual ?? 0) };

  const totals = withVariance({
    allocation: sum(departments, d => d.allocation),
    pm: sum(departments, d => d.pm) + unlinkedHaulage.pm + contra.pm,
    net: sum(departments, d => d.net) + unlinkedHaulage.net + contra.net,
    gross: sum(departments, d => d.gross),
  });

  return { departments, lineById, unlinkedHaulage, contra, totals };
}

// ── Variations (for the exports) ─────────────────────────────────────────────

export type ReportVariation = {
  id: number;
  type: string;
  status: string;
  title: string;
  justification: string | null;
  clientRef: string | null;
  notes: string | null;
  rejectionReason: string | null;
  requestedAt: string;
  requestedBy: { name: string } | null;
  approvedAt: string | null;
  approvedBy: { name: string } | null;
  items: { amount: number; note: string | null; budgetLine: { department: string; description: string } }[];
};

export const VARIATION_TYPES: Record<string, string> = {
  reallocation: "Reallocation",
  additional_spend: "Additional spend",
  saving: "Saving",
};
export const VARIATION_STATUSES: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};
