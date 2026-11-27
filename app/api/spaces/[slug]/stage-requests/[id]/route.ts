// A workshop manager approves or declines a reschedule request. Approving moves the stage.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { notify } from "@/lib/clientPortal";
import { isWorkshopManager, REQUEST_SELECT, stageName } from "@/lib/workshopCalendar";

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const m = await spaceMember(slug);
  if ("error" in m) return m.error;
  if (!(await isWorkshopManager(m.userId, m.role, m.space.id))) return NextResponse.json({ error: "Only a workshop manager can decide reschedule requests" }, { status: 403 });
  const r = await prisma.stageRequest.findFirst({ where: { id: Number(id) || 0, stage: { part: { job: { entityId: m.space.id } } } }, select: { id: true, kind: true, status: true, stageId: true, newStart: true, newDays: true, byId: true } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.kind !== "reschedule" || r.status !== "open") return NextResponse.json({ error: "That request has already been dealt with" }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  if (body.decision !== "approved" && body.decision !== "declined") return NextResponse.json({ error: "Approve or decline" }, { status: 400 });
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  // Only the request that changes it from open moves the stage (a double click can't do it twice)
  const claimed = await prisma.stageRequest.updateMany({ where: { id: r.id, status: "open" }, data: { status: body.decision, decidedById: m.userId, decidedAt: new Date(), decisionNote: note } });
  if (!claimed.count) return NextResponse.json({ error: "That request has already been dealt with" }, { status: 409 });
  if (body.decision === "approved") await prisma.partStage.update({ where: { id: r.stageId }, data: { startDate: r.newStart, days: r.newDays ?? undefined, lateUntil: null } });
  if (r.byId && r.byId !== m.userId) {
    await notify([r.byId], { title: `Reschedule ${body.decision}: ${await stageName(r.stageId)}`, body: note, link: `/spaces/${slug}/my-work` }).catch(() => {});
  }
  return NextResponse.json(await prisma.stageRequest.findUnique({ where: { id: r.id }, select: REQUEST_SELECT }));
}
