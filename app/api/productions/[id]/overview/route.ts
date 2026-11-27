// A production's Overview (new look, build brief stage 5): now and next venue, budget at a glance,
// this week's show reports, this week's schedule, advancing for the next venue, crew on this week,
// open tasks and the latest show report. Anything in a section hidden for this person is left out.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { buildBudgetReport } from "@/lib/budgetReport";
import { buildDigest } from "@/lib/showDigestCore";

export const dynamic = "force-dynamic";
const DAY = 86_400_000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const pid = Number(id), see = (s: string) => !access.hidden.has(s);
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekEnd = new Date(start.getTime() + 7 * DAY);
  const weekAgo = new Date(start.getTime() - 6 * DAY);

  const p = await prisma.production.findUnique({ where: { id: pid }, select: { id: true, isTour: true, advancingStatus: true, venue: true, venueRef: { select: { name: true, city: true } } } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [stops, events, crew, tasks, reports, budget] = await Promise.all([
    prisma.tourStop.findMany({ where: { productionId: pid }, select: { id: true, stopNumber: true, loadInDate: true, startDate: true, endDate: true, advancingStatus: true, venue: { select: { name: true, city: true } } }, orderBy: { stopNumber: "asc" } }),
    see("schedule") ? prisma.event.findMany({ where: { productionId: pid, startAt: { gte: start, lt: weekEnd } }, select: { id: true, title: true, type: true, startAt: true, location: true }, orderBy: { startAt: "asc" }, take: 12 }) : [],
    see("crew") ? prisma.productionCrew.findMany({ where: { productionId: pid, AND: [{ OR: [{ startDate: null }, { startDate: { lt: weekEnd } }] }, { OR: [{ endDate: null }, { endDate: { gte: start } }] }] }, select: { role: true, crew: { select: { name: true, discipline: true } } }, take: 40 }) : [],
    see("tasks") ? prisma.task.findMany({ where: { productionId: pid, status: { not: "done" } }, select: { id: true, title: true, dueDate: true, assigneeUser: { select: { name: true } } }, orderBy: [{ dueDate: "asc" }, { id: "asc" }], take: 50 }) : [],
    see("reports") ? prisma.showReport.findMany({ where: { productionId: pid, reportDate: { gte: weekAgo } }, select: { id: true, reportDate: true, performance: true, performanceNumber: true, venue: true, attendance: true, houseCapacity: true, runningTime: true, notes: true, flags: true }, orderBy: { reportDate: "desc" } }) : [],
    see("budget") ? prisma.budgetLine.findMany({ where: { productionId: pid }, select: { id: true, department: true, description: true, budgeted: true, alertLevel: true, expenses: { select: { phase: true, description: true, estimated: true, committed: true, spent: true, supplier: true, poNumber: true, paymentDue: true, issuedForPayment: true, vatExempt: true, notes: true, isPSGExpense: true } } } }) : null,
  ]);

  // Now and next: the stop on today (load-in to last day), and the next one to start
  const from = (s: (typeof stops)[number]) => s.loadInDate ?? s.startDate, to = (s: (typeof stops)[number]) => s.endDate ?? s.startDate;
  const nowStop = stops.find(s => from(s) && to(s) && from(s)! <= new Date(start.getTime() + DAY) && to(s)! >= start) ?? null;
  const nextStop = stops.filter(s => from(s) && from(s)! > start && s.id !== nowStop?.id).sort((a, b) => from(a)!.getTime() - from(b)!.getTime())[0] ?? null;
  const place = (v: { name: string; city: string | null }) => [v.name, v.city].filter(Boolean).join(", ");

  let budgetTile = null;
  if (budget) {
    const r = buildBudgetReport(budget.map(l => ({ ...l, expenses: l.expenses.map(x => ({ ...x, paymentDue: x.paymentDue?.toISOString() ?? null })) })), [], []);
    budgetTile = { total: r.totals.allocation, net: r.totals.net, pctSpent: r.totals.allocation ? Math.round((r.totals.net / r.totals.allocation) * 100) : null, overspends: budget.filter(l => l.alertLevel === 100).length };
  }
  const digest = reports.length ? buildDigest(reports) : null;
  const latest = see("reports") ? await prisma.showReport.findFirst({ where: { productionId: pid }, select: { id: true, reportDate: true, performance: true, venue: true, flags: true }, orderBy: { reportDate: "desc" } }) : null;

  // This week: schedule events and tour stops starting this week
  const week = [
    ...events.map(e => ({ at: e.startAt.toISOString(), title: e.title, line: e.location, kind: "event" })),
    ...stops.filter(s => from(s) && from(s)! >= start && from(s)! < weekEnd).map(s => ({ at: from(s)!.toISOString(), title: `${s.loadInDate ? "Get-in" : "Opens"}: ${place(s.venue)}`, line: `Stop ${s.stopNumber}`, kind: "stop" })),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));

  return NextResponse.json({
    now: p.isTour ? (nowStop ? { venue: place(nowStop.venue), stop: nowStop.stopNumber, of: stops.length } : null) : { venue: p.venueRef ? place(p.venueRef) : p.venue, stop: null, of: null },
    next: p.isTour && nextStop ? { venue: place(nextStop.venue), getIn: (nextStop.loadInDate ?? nextStop.startDate)!.toISOString(), stop: nextStop.stopNumber } : null,
    budget: budgetTile,
    reports: see("reports") ? { count: reports.length, faults: digest ? digest.repeats.length + digest.flagged.reduce((s, f) => s + f.count, 0) : 0, absences: digest?.absences ?? 0 } : null,
    week: see("schedule") ? week : null,
    // A tour with no more stops still shows the panel, saying so (status null)
    advancing: see("advancing") ? (p.isTour ? (nextStop ? { venue: place(nextStop.venue), status: nextStop.advancingStatus || "triage" } : { venue: null, status: null }) : { venue: p.venueRef ? place(p.venueRef) : p.venue, status: p.advancingStatus || "triage" }) : null,
    crew: see("crew") ? crew.map(c => ({ name: c.crew.name, role: c.role ?? c.crew.discipline })) : null,
    tasks: see("tasks") ? { open: tasks.length, top: tasks.slice(0, 4).map(t => ({ id: t.id, title: t.title, due: t.dueDate?.toISOString() ?? null, who: t.assigneeUser?.name ?? null })) } : null,
    latestReport: latest ? { id: latest.id, at: latest.reportDate.toISOString(), performance: latest.performance, venue: latest.venue, flags: (() => { try { return (JSON.parse(latest.flags ?? "[]") as string[]).length; } catch { return 0; } })() } : null,
  });
}
