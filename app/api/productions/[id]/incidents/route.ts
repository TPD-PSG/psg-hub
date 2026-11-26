// A production's accident & incident reports (26 Nov 2026). Anyone who can open its H&S tab can file
// one; H&S leads and the show's team staff see them all, everyone else only their own.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hsProductionAccess } from "@/lib/incidentRoute";
import { incidentAccess, createIncident, readReport, INCIDENT_INCLUDE } from "@/lib/incidents";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await hsProductionAccess(id);
  if ("error" in access) return access.error;
  const productionId = Number(id);
  const { lead, manage } = await incidentAccess(access.userId, access.role, productionId);
  const incidents = await prisma.incident.findMany({
    where: { productionId, ...(manage ? {} : { reportedById: access.userId }) },
    orderBy: { occurredAt: "desc" }, include: INCIDENT_INCLUDE,
  });
  const extra = manage ? await prisma.production.findUnique({ where: { id: productionId }, select: { hsReportToken: true } }) : null;
  // People who can own an action: staff on the show, and the leads
  const team = manage ? await prisma.user.findMany({
    where: { role: { in: ["admin", "member"] }, OR: [{ productionTeams: { some: { productionId } } }, { role: "admin" }] },
    select: { id: true, name: true }, orderBy: { name: "asc" },
  }) : [];
  return NextResponse.json({ incidents, lead, manage, qrToken: extra?.hsReportToken ?? null, people: team });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await hsProductionAccess(id);
  if ("error" in access) return access.error;
  const body = await req.json().catch(() => ({}));
  const r = readReport(body);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const incident = await createIncident(Number(id), r.data, { userId: access.userId, viaQr: false });
  return NextResponse.json(await prisma.incident.findUnique({ where: { id: incident.id }, include: INCIDENT_INCLUDE }), { status: 201 });
}
