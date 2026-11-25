// Server-side job loading. Money (day rates, costs, margins) only for admins and staff with BD or
// finance access; other staff see the job and can log their own days.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccess, parsePerms } from "@/lib/permissions";
import { jobFigures } from "@/lib/jobCosting";
import { JOB_TYPES } from "@/lib/quotes";

export type JobViewer = { userId: number; role: string; seeMoney: boolean };

export async function requireJobViewer(): Promise<JobViewer | { error: NextResponse }> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; permissions?: string | null } | undefined;
  if (!user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = user.role ?? "member";
  if (role !== "admin" && role !== "member") return { error: NextResponse.json({ error: "PSG staff only" }, { status: 403 }) };
  const perms = parsePerms(user.permissions ?? null);
  return { userId: Number(user.id), role, seeMoney: role === "admin" || canAccess(perms, "bd", role) || canAccess(perms, "finance", role) };
}

const QUOTE_LINES = { select: { id: true, number: true, status: true, vatRate: true, lines: { select: { quantity: true, unitCost: true, unitPrice: true } } } };

async function psgExpensesFor(productionIds: number[]) {
  if (!productionIds.length) return new Map<number, { spent: number; committed: number; description: string; supplier: string | null }[]>();
  const rows = await prisma.expense.findMany({
    where: { isPSGExpense: true, budgetLine: { productionId: { in: productionIds } } },
    select: { spent: true, committed: true, description: true, supplier: true, budgetLine: { select: { productionId: true } } },
  });
  const m = new Map<number, typeof rows>();
  for (const r of rows) m.set(r.budgetLine.productionId, [...(m.get(r.budgetLine.productionId) ?? []), r]);
  return m as unknown as Map<number, { spent: number; committed: number; description: string; supplier: string | null }[]>;
}

export async function listJobs(v: JobViewer) {
  const jobs = await prisma.job.findMany({
    include: {
      entity: { select: { id: true, name: true } }, client: { select: { id: true, name: true } },
      production: { select: { id: true, name: true, pmFee: true } },
      quotes: QUOTE_LINES, time: { select: { days: true, dayRate: true } }, costs: { select: { amount: true } },
      forProduction: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const psg = await psgExpensesFor(jobs.map(j => j.productionId).filter((x): x is number => !!x));
  return jobs.map(j => {
    const f = jobFigures({ price: j.price, productionPmFee: j.production?.pmFee, quotes: j.quotes, time: j.time, costs: j.costs, psgExpenses: j.productionId ? psg.get(j.productionId) ?? [] : [] });
    const { quotes, time, costs, ...rest } = j;
    void quotes; void time; void costs;
    return {
      ...rest, price: v.seeMoney ? rest.price : null,
      production: rest.production && { id: rest.production.id, name: rest.production.name },
      days: f.days, figures: v.seeMoney ? f : null,
    };
  });
}

export async function loadJob(id: number, v: JobViewer) {
  const j = await prisma.job.findUnique({
    where: { id },
    include: {
      entity: { select: { id: true, name: true } }, client: { select: { id: true, name: true } },
      opportunity: { select: { id: true, title: true } },
      production: { select: { id: true, name: true, pmFee: true } },
      quotes: { ...QUOTE_LINES, select: { ...QUOTE_LINES.select, title: true } },
      time: { include: { user: { select: { id: true, name: true } } }, orderBy: { date: "desc" } },
      costs: { include: { createdBy: { select: { name: true } } }, orderBy: { date: "desc" } },
      links: { orderBy: { createdAt: "asc" } },
      forProduction: { select: { id: true, name: true } },
    },
  });
  if (!j) return null;
  const psg = j.productionId ? (await psgExpensesFor([j.productionId])).get(j.productionId) ?? [] : [];
  const figures = jobFigures({ price: j.price, productionPmFee: j.production?.pmFee, quotes: j.quotes, time: j.time, costs: j.costs, psgExpenses: psg });
  if (v.seeMoney) return { ...j, production: j.production && { id: j.production.id, name: j.production.name }, figures, psgExpenses: psg };
  // Without money access: no prices, rates, costs or quote figures; only your own days in detail
  return {
    ...j, price: null, figures: null, psgExpenses: [], costs: [],
    production: j.production && { id: j.production.id, name: j.production.name },
    quotes: j.quotes.map(q => ({ id: q.id, number: q.number, status: q.status, title: q.title, vatRate: 0, lines: [] })),
    time: j.time.map(t => ({ ...t, dayRate: null })),
  };
}

/** Job fields from a body; only keys sent are changed. */
export function jobFields(body: Record<string, unknown>) {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const int = (v: unknown) => (v === "" || v == null ? null : Number.isInteger(Number(v)) ? Number(v) : null);
  const d: Record<string, unknown> = {};
  if (has("title") && text(body.title)) d.title = text(body.title);
  if (has("jobType") && JOB_TYPES.some(t => t.key === body.jobType)) d.jobType = body.jobType;
  if (has("status") && ["active", "complete", "cancelled"].includes(body.status as string)) d.status = body.status;
  if (has("entityId")) d.entityId = int(body.entityId);
  if (has("clientId")) d.clientId = int(body.clientId);
  if (has("price")) { const n = Number(body.price); d.price = body.price === "" || body.price == null || !Number.isFinite(n) ? null : n; }
  if (has("startDate")) d.startDate = text(body.startDate) ? new Date(body.startDate as string) : null;
  if (has("endDate")) d.endDate = text(body.endDate) ? new Date(body.endDate as string) : null;
  if (has("notes")) d.notes = text(body.notes);
  return d;
}
