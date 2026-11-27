import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireProductionAccess } from "@/lib/access";
import { removeFile } from "@/lib/storage";
import { loadProductionForViewer } from "@/lib/productionData";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadProductionForViewer(id);
  if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role ?? "member";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const production = await prisma.production.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      type: body.type,
      venue: body.venue || null,
      venueId: body.venueId ? Number(body.venueId) : null,
      isTour: body.isTour ?? false,
      startDate: (toDate(body.startDate) ?? null),
      endDate: (toDate(body.endDate) ?? null),
      status: body.status,
      announcementStatus: body.announcementStatus || "not_announced",
      internalStatus: body.internalStatus || "pencil",
      productionManager: body.productionManager || null,
      color: body.color || null,
      notes: body.notes || null,
      reportEmail: body.reportEmail || null,
      sharepointUrl: body.sharepointUrl || null,
      haulageBudgetLineId: body.haulageBudgetLineId ? Number(body.haulageBudgetLineId) : null,
      bdClientId: body.bdClientId ? Number(body.bdClientId) : null,
      // Only when the form sends it, so older callers don't clear it
      ...("entityId" in body ? { entityId: body.entityId ? Number(body.entityId) : null } : {}),
    },
  });
  return NextResponse.json(production);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role ?? "member";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.archived === "boolean") {
    data.archived = body.archived;
    data.archivedAt = body.archived ? new Date() : null;
  }
  if (typeof body.advancingStatus === "string") data.advancingStatus = body.advancingStatus;
  if ("contraEstimate" in body) data.contraEstimate = body.contraEstimate === "" || body.contraEstimate == null ? null : Number(body.contraEstimate);
  if ("contraActual" in body) data.contraActual = body.contraActual === "" || body.contraActual == null ? null : Number(body.contraActual);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  const production = await prisma.production.update({
    where: { id: Number(id) },
    data,
  });
  return NextResponse.json(production);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const pid = Number(id);
  // Accident and incident reports (including RIDDOR) must be kept: archive the show instead (audit round 2)
  const incidents = await prisma.incident.count({ where: { productionId: pid } });
  if (incidents) return NextResponse.json({ error: `This show has ${incidents} accident/incident report${incidents === 1 ? "" : "s"}, which must be kept. Archive the production instead.` }, { status: 409 });
  // Note the production's stored files so they can be removed from R2 once the rows are gone
  // (company expenses and their receipts are kept: they're unlinked from the production, not deleted)
  const [docs, hs, reports, spend] = await Promise.all([
    prisma.productionDocument.findMany({ where: { productionId: pid }, select: { fileKey: true } }),
    prisma.hSDocument.findMany({ where: { productionId: pid }, select: { fileKey: true } }),
    prisma.showReport.findMany({ where: { productionId: pid }, select: { pdfKey: true } }),
    prisma.spendDocument.findMany({ where: { expense: { budgetLine: { productionId: pid } } }, select: { fileKey: true } }),
  ]);
  await prisma.production.delete({ where: { id: pid } });
  const keys = new Set([...docs, ...hs, ...spend].map(d => d.fileKey).concat(reports.map(r => r.pdfKey)));
  for (const key of keys) await removeFile(key);
  return NextResponse.json({ ok: true });
}
