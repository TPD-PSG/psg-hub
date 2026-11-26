// The central Health & Safety page (26 Nov 2026): incidents and actions across every show this person
// may see, H&S documents missing or due for review, and toolbox-talk sign-offs this week.
// H&S leads see every show; other staff see the shows they're on the team for.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { companyLimit } from "@/lib/companyScope";
import { hsLeadIds, managedScope, visibleWhere, incidentPath, INCIDENT_INCLUDE } from "@/lib/incidents";
import { incidentStats } from "@/lib/incidentsCore";
import { mondayOf } from "@/lib/showDigestCore";

export const dynamic = "force-dynamic";
const DAY = 86400e3;

export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = user.role ?? "member", userId = Number(user.id);
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const managed = await managedScope(userId, role);
  const limit = role === "admin" ? null : await companyLimit(userId);
  const now = new Date();
  const yearAgo = new Date(now.getTime() - 366 * DAY);

  const incidents = await prisma.incident.findMany({
    where: { AND: [await visibleWhere(userId, role), { OR: [{ status: { not: "closed" } }, { occurredAt: { gte: yearAgo } }] }] },
    orderBy: { occurredAt: "desc" }, include: INCIDENT_INCLUDE,
  });

  // Live shows: not archived or closed, and not finished
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const shows = await prisma.production.findMany({
    where: {
      archived: false, status: { not: "closed" }, OR: [{ endDate: null }, { endDate: { gte: startOfToday } }],
      ...(managed === "all" ? {} : { id: { in: managed.productionIds } }),
      ...(limit ? { entityId: { in: limit } } : {}),
    },
    select: {
      id: true, name: true, status: true, startDate: true, endDate: true,
      hsDocuments: { select: { id: true, name: true, folder: true, reviewDate: true, tourStopId: true, createdAt: true }, orderBy: { name: "asc" } },
      toolboxSignatures: { select: { signeeDate: true }, orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
  });
  const monday = mondayOf().toISOString().slice(0, 10);
  const soon = now.getTime() + 14 * DAY;
  const docs = shows.map(s => ({
    id: s.id, name: s.name, status: s.status, startDate: s.startDate, endDate: s.endDate,
    count: s.hsDocuments.length,
    noReviewDate: s.hsDocuments.filter(d => !d.reviewDate).length,
    due: s.hsDocuments.filter(d => d.reviewDate && d.reviewDate.getTime() <= soon).map(d => ({ id: d.id, name: d.name, reviewDate: d.reviewDate, overdue: d.reviewDate!.getTime() < now.getTime() })),
    documents: s.hsDocuments.map(d => ({ id: d.id, name: d.name, reviewDate: d.reviewDate })),
  }));
  const toolbox = shows.map(s => ({
    id: s.id, name: s.name, status: s.status,
    thisWeek: s.toolboxSignatures.filter(t => t.signeeDate >= monday).length,
    total: s.toolboxSignatures.length,
    last: s.toolboxSignatures.map(t => t.signeeDate).sort().pop() ?? null,
  }));

  const openActions = incidents.flatMap(i => i.actions.filter(a => !a.doneAt).map(a => ({ ...a, incident: { id: i.id, year: i.year, number: i.number, productionId: i.productionId, productionName: i.production?.name ?? i.entity?.name ?? "", path: incidentPath(i), entity: i.entity } })))
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
  const stats = incidentStats(incidents.map(i => ({ ...i, productionName: i.production?.name ?? i.entity?.name ?? "" })), now);

  const leadIds = role === "admin" ? await hsLeadIds() : [];
  const staff = role === "admin" ? await prisma.user.findMany({ where: { role: { in: ["admin", "member"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }) : [];
  return NextResponse.json({
    me: { lead: managed === "all", admin: role === "admin" },
    incidents, stats, openActions, docs, toolbox, weekOf: monday,
    leads: role === "admin" ? { ids: leadIds, staff } : null,
  });
}

// Admins name the H&S leads (they see every show's reports and sign them off)
export async function PUT(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.leadIds) ? body.leadIds.map(Number).filter(Number.isInteger) : [];
  const valid = await prisma.user.findMany({ where: { id: { in: ids }, role: { in: ["admin", "member"] } }, select: { id: true } });
  const value = JSON.stringify(valid.map(v => v.id));
  await prisma.setting.upsert({ where: { key: "hs_lead_ids" }, update: { value }, create: { key: "hs_lead_ids", value } });
  return NextResponse.json({ ids: valid.map(v => v.id) });
}
