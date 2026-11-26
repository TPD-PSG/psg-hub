import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INCIDENT_INCLUDE, readFollowUp } from "@/lib/incidents";
import { incidentFor } from "@/lib/incidentRoute";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await incidentFor((await params).id, "view");
  if ("error" in r) return r.error;
  return NextResponse.json(await prisma.incident.findUnique({ where: { id: r.inc.id }, include: INCIDENT_INCLUDE }));
}

// Follow-up: investigation, root cause, severity, RIDDOR. Closed reports are reopened first.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await incidentFor((await params).id, "manage");
  if ("error" in r) return r.error;
  if (r.inc.status === "closed") return NextResponse.json({ error: "This report is closed. Reopen it to change it." }, { status: 409 });
  const data = readFollowUp(await req.json().catch(() => ({})), r.inc.occurredAt);
  // Writing up an investigation moves an open report on
  if (r.inc.status === "open" && (data.investigation || data.rootCause) && !data.status) data.status = "investigating";
  const updated = await prisma.incident.update({ where: { id: r.inc.id }, data, include: INCIDENT_INCLUDE });
  return NextResponse.json(updated);
}

// Only an H&S lead can delete a report (e.g. a duplicate or a test); the page confirms first
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await incidentFor((await params).id, "lead");
  if ("error" in r) return r.error;
  await prisma.incident.delete({ where: { id: r.inc.id } });
  return NextResponse.json({ ok: true });
}
