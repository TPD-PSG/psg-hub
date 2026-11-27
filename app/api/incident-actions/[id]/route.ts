import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { INCIDENT_INCLUDE, incidentAccess } from "@/lib/incidents";
import { incidentFor } from "@/lib/incidentRoute";

async function actionFor(rawId: string) {
  const id = Number(rawId);
  const a = Number.isInteger(id) ? await prisma.incidentAction.findUnique({ where: { id }, select: { id: true, incidentId: true } }) : null;
  if (!a) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const r = await incidentFor(a.incidentId, "manage");
  if (!("inc" in r) || !r.inc) return { error: r.error! };
  if (r.inc.status === "closed") return { error: NextResponse.json({ error: "This report is closed. Reopen it to change actions." }, { status: 409 }) };
  return { a, r };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await actionFor((await params).id);
  if ("error" in x) return x.error;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { text: "The text can't be blank" });
  if (blank) return blank;
  const data: Record<string, unknown> = {};
  if ("done" in body) data.doneAt = body.done ? new Date() : null;
  if (typeof body.text === "string" && body.text.trim()) data.text = body.text.trim().slice(0, 1000);
  if ("dueDate" in body) data.dueDate = body.dueDate && !Number.isNaN(new Date(body.dueDate).getTime()) ? new Date(body.dueDate) : null;
  if ("ownerId" in body) {
    const ownerId = body.ownerId ? Number(body.ownerId) : null;
    if (ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { role: true } });
      if (!owner || !(await incidentAccess(ownerId, owner.role, x.r.inc)).manage) return NextResponse.json({ error: "That person can't see this show's reports" }, { status: 400 });
    }
    data.ownerId = ownerId;
  }
  await prisma.incidentAction.update({ where: { id: x.a.id }, data });
  return NextResponse.json(await prisma.incident.findUnique({ where: { id: x.a.incidentId }, include: INCIDENT_INCLUDE }));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await actionFor((await params).id);
  if ("error" in x) return x.error;
  await prisma.incidentAction.delete({ where: { id: x.a.id } });
  return NextResponse.json(await prisma.incident.findUnique({ where: { id: x.a.incidentId }, include: INCIDENT_INCLUDE }));
}
