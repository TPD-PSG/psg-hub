// Sign-off: an H&S lead closes a report once RIDDOR is settled and every action is done; or reopens it.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INCIDENT_INCLUDE } from "@/lib/incidents";
import { closeBlockers } from "@/lib/incidentsCore";
import { incidentFor } from "@/lib/incidentRoute";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await incidentFor((await params).id, "lead");
  if ("error" in r) return r.error;
  const body = await req.json().catch(() => ({}));
  if (body.reopen) {
    const updated = await prisma.incident.update({ where: { id: r.inc.id }, data: { status: "investigating", closedAt: null, closedById: null }, include: INCIDENT_INCLUDE });
    return NextResponse.json(updated);
  }
  const full = await prisma.incident.findUnique({ where: { id: r.inc.id }, select: { riddor: true, riddorReportedAt: true, actions: { select: { doneAt: true } } } });
  const blockers = closeBlockers(full!);
  if (blockers.length) return NextResponse.json({ error: `Not ready to close: ${blockers.join("; ")}.`, blockers }, { status: 409 });
  const closeNote = typeof body.closeNote === "string" ? body.closeNote.trim().slice(0, 2000) || null : null;
  const updated = await prisma.incident.update({ where: { id: r.inc.id }, data: { status: "closed", closedAt: new Date(), closedById: r.userId, closeNote }, include: INCIDENT_INCLUDE });
  return NextResponse.json(updated);
}
