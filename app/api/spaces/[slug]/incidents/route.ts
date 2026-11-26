// A workshop floor's accident & incident reports (a company space, e.g. The Workshop Stoke). Anyone who
// can open the space can file one; its own staff and the H&S leads see them all, others only their own.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceBySlug } from "@/lib/spaces";
import { hsSpaceAccess } from "@/lib/incidentRoute";
import { incidentAccess, createIncident, readReport, readPhotos, INCIDENT_INCLUDE } from "@/lib/incidents";

export const dynamic = "force-dynamic";

async function space(slug: string) {
  const s = await spaceBySlug(slug);
  if (!s) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const access = await hsSpaceAccess(s.id);
  if ("error" in access) return access;
  return { s, ...access };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const x = await space((await params).slug);
  if ("error" in x) return x.error;
  const owner = { productionId: null, entityId: x.s.id };
  const { lead, manage } = await incidentAccess(x.userId, x.role, owner);
  const incidents = await prisma.incident.findMany({
    where: { entityId: x.s.id, ...(manage ? {} : { reportedById: x.userId }) },
    orderBy: { occurredAt: "desc" }, include: INCIDENT_INCLUDE,
  });
  const e = manage ? await prisma.entity.findUnique({ where: { id: x.s.id }, select: { hsReportToken: true } }) : null;
  // People who can own an action: the workshop's own staff and the admins
  const people = manage ? await prisma.user.findMany({
    where: { OR: [{ role: "member", homeEntityId: x.s.id }, { role: "admin" }] }, select: { id: true, name: true }, orderBy: { name: "asc" },
  }) : [];
  return NextResponse.json({ incidents, lead, manage, qrToken: e?.hsReportToken ?? null, people });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const x = await space((await params).slug);
  if ("error" in x) return x.error;
  const body = await req.json().catch(() => ({}));
  const r = readReport(body);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const ph = readPhotos(body.photos);
  if ("error" in ph) return NextResponse.json({ error: ph.error }, { status: 400 });
  const incident = await createIncident({ productionId: null, entityId: x.s.id }, r.data, { userId: x.userId, viaQr: false }, ph.photos);
  return NextResponse.json(await prisma.incident.findUnique({ where: { id: incident.id }, include: INCIDENT_INCLUDE }), { status: 201 });
}
