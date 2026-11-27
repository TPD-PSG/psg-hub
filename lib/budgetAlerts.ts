// Overspend alerts (27 Nov 2026): after anything that changes a show's budget figures, check each
// line and the whole budget. When one newly reaches "nearly spent" (90%) or goes over, the show's
// team gets a Hub notification. Each line remembers the level it last alerted at, so the same
// overspend isn't sent twice; when it drops back under, it can alert again next time.
import { prisma } from "./prisma";
import { buildBudgetReport } from "./budgetReport";
import { alertLevel } from "./budgetAlertsCore.ts";

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

/** Staff on the show's team (no clients or freelancers: they can't see budgets), else the admins. */
async function recipients(productionId: number) {
  const team = await prisma.productionTeam.findMany({
    where: { productionId, user: { deactivatedAt: null, role: { in: ["admin", "member"] } } },
    select: { userId: true },
  });
  if (team.length) return team.map(t => t.userId);
  const admins = await prisma.user.findMany({ where: { role: "admin", deactivatedAt: null }, select: { id: true } });
  return admins.map(a => a.id);
}

export type AlertSent = { lineId: number | null; level: number; title: string };

export async function checkBudgetAlerts(productionId: number): Promise<AlertSent[]> {
  const p = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true, name: true, budgetAlertLevel: true,
      budgetLines: { select: { id: true, department: true, description: true, budgeted: true, alertLevel: true, expenses: { select: { phase: true, description: true, estimated: true, committed: true, spent: true, supplier: true, poNumber: true, paymentDue: true, issuedForPayment: true, vatExempt: true, notes: true, isPSGExpense: true } } } },
      haulageMovements: { select: { haulageCompany: true, fromLocation: true, toLocation: true, departureAt: true, cargo: true, estimatedCost: true, actualCost: true, rechargeable: true, budgetLineId: true } },
      tourStops: { select: { stopNumber: true, contraEstimate: true, contraActual: true, venue: { select: { name: true } } } },
    },
  });
  if (!p) return [];
  const report = buildBudgetReport(
    p.budgetLines.map(l => ({ ...l, expenses: l.expenses.map(x => ({ ...x, paymentDue: x.paymentDue?.toISOString() ?? null })) })),
    p.haulageMovements.map(m => ({ ...m, departureAt: m.departureAt.toISOString() })),
    p.tourStops,
  );

  const sent: AlertSent[] = [];
  const link = `/productions/${p.id}?section=budget`;
  let users: number[] | null = null;
  const notify = async (lineId: number | null, level: number, title: string, body: string) => {
    users ??= await recipients(p.id);
    if (users.length) await prisma.notification.createMany({ data: users.map(userId => ({ userId, title, body, link })) });
    sent.push({ lineId, level, title });
  };

  for (const l of p.budgetLines) {
    const r = report.lineById.get(l.id)!;
    const level = alertLevel(r.allocation, r.net);
    if (level === l.alertLevel) continue;
    // Claim the change first, so two saves at once can't both send it
    const claimed = await prisma.budgetLine.updateMany({ where: { id: l.id, alertLevel: l.alertLevel }, data: { alertLevel: level } });
    if (!claimed.count || level <= l.alertLevel) continue; // back under: nothing to send
    const name = `${l.department}: ${l.description}`;
    if (level === 100) await notify(l.id, level, `Over budget: ${name} · ${p.name}`, `Net cost ${gbp(r.net)} against ${gbp(r.allocation)}, ${gbp(r.net - r.allocation)} over`);
    else await notify(l.id, level, `Nearly spent: ${name} · ${p.name}`, `Net cost ${gbp(r.net)} of ${gbp(r.allocation)} (${Math.round((r.net / r.allocation) * 100)}%)`);
  }

  const t = report.totals;
  const total = alertLevel(t.allocation, t.net);
  if (total !== p.budgetAlertLevel) {
    const claimed = await prisma.production.updateMany({ where: { id: p.id, budgetAlertLevel: p.budgetAlertLevel }, data: { budgetAlertLevel: total } });
    if (claimed.count && total > p.budgetAlertLevel) {
      if (total === 100) await notify(null, total, `${p.name} is over budget`, `Net cost ${gbp(t.net)} against ${gbp(t.allocation)}, ${gbp(t.net - t.allocation)} over`);
      else await notify(null, total, `${p.name}'s budget is nearly spent`, `Net cost ${gbp(t.net)} of ${gbp(t.allocation)} (${Math.round((t.net / t.allocation) * 100)}%)`);
    }
  }
  return sent;
}

/** For routes: check after a save without ever failing the save. */
export async function afterBudgetChange(productionId: number | null | undefined) {
  if (!productionId) return;
  try { await checkBudgetAlerts(productionId); } catch (e) { console.error("[budget-alerts]", e instanceof Error ? e.message : e); }
}

/** The show a budget line belongs to. */
export async function productionOfLine(lineId: number | null | undefined) {
  if (!lineId) return null;
  return (await prisma.budgetLine.findUnique({ where: { id: lineId }, select: { productionId: true } }))?.productionId ?? null;
}
