// A corrective action on a report: what will stop it happening again, who, and by when.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INCIDENT_INCLUDE, incidentAccess, incidentPath } from "@/lib/incidents";
import { notify } from "@/lib/clientPortal";
import { incidentRef } from "@/lib/incidentsCore";
import { incidentFor } from "@/lib/incidentRoute";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await incidentFor((await params).id, "manage");
  if ("error" in r) return r.error;
  if (r.inc.status === "closed") return NextResponse.json({ error: "This report is closed. Reopen it to add actions." }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!text) return NextResponse.json({ error: "Say what needs doing" }, { status: 400 });
  const ownerId = body.ownerId ? Number(body.ownerId) : null;
  if (ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { role: true } });
    // An owner must be able to see the report: staff who manage this show's reports
    if (!owner || !(await incidentAccess(ownerId, owner.role, r.inc)).manage) return NextResponse.json({ error: "That person can't see this show's reports" }, { status: 400 });
  }
  const dueDate = body.dueDate && !Number.isNaN(new Date(body.dueDate).getTime()) ? new Date(body.dueDate) : null;
  await prisma.incidentAction.create({ data: { incidentId: r.inc.id, text, ownerId, dueDate } });
  const inc = await prisma.incident.update({ where: { id: r.inc.id }, data: r.inc.status === "open" ? { status: "investigating" } : {}, include: INCIDENT_INCLUDE });
  if (ownerId && ownerId !== r.userId) await notify([ownerId], { title: `Incident action for you (${incidentRef(inc)})`, body: text, link: incidentPath(inc) });
  return NextResponse.json(inc, { status: 201 });
}
