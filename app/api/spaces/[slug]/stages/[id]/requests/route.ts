// Report a stage running late, or ask to reschedule it. Staff, or the person doing it (freelancers
// from My work). Late is noted straight away; a reschedule waits for a workshop manager.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { notify } from "@/lib/clientPortal";
import { dayText, REQUEST_SELECT, stageName, workshopManagers } from "@/lib/workshopCalendar";

const DAY = 86_400_000;
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : null);

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const m = await spaceMember(slug);
  if ("error" in m) return m.error;
  const stage = await prisma.partStage.findFirst({ where: { id: Number(id) || 0, part: { job: { entityId: m.space.id } } }, select: { id: true, startDate: true, days: true, userId: true, part: { select: { userId: true } } } });
  if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!m.staff && stage.userId !== m.userId && stage.part.userId !== m.userId) return NextResponse.json({ error: "Only the person doing it, or staff, can report on this stage" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!reason) return NextResponse.json({ error: "Say why" }, { status: 400 });
  const name = await stageName(stage.id);
  const link = `/spaces/${slug}/calendar${stage.startDate ? `?from=${stage.startDate.toISOString().slice(0, 10)}` : ""}`;

  if (body.kind === "late") {
    const newEnd = day(body.newEnd);
    if (!newEnd) return NextResponse.json({ error: "When will it now finish?" }, { status: 400 });
    if (stage.startDate && newEnd.getTime() < stage.startDate.getTime()) return NextResponse.json({ error: "It can't finish before it starts" }, { status: 400 });
    const [r] = await prisma.$transaction([
      prisma.stageRequest.create({ data: { stageId: stage.id, kind: "late", reason, newEnd, status: "noted", byId: m.userId }, select: REQUEST_SELECT }),
      prisma.partStage.update({ where: { id: stage.id }, data: { lateUntil: newEnd } }),
    ]);
    await notify(await workshopManagers(m.space.id), { title: `Running late: ${name}`, body: `Now finishing ${dayText(newEnd)}. ${reason}`, link }).catch(() => {});
    return NextResponse.json(r, { status: 201 });
  }
  if (body.kind === "reschedule") {
    const newStart = day(body.newStart), newDays = Number(body.newDays);
    if (!newStart || !Number.isInteger(newDays) || newDays < 1 || newDays > 365) return NextResponse.json({ error: "Give the new start and how many days" }, { status: 400 });
    if (await prisma.stageRequest.count({ where: { stageId: stage.id, kind: "reschedule", status: "open" } })) return NextResponse.json({ error: "There's already a reschedule request waiting on this stage" }, { status: 409 });
    const r = await prisma.stageRequest.create({ data: { stageId: stage.id, kind: "reschedule", reason, newStart, newDays, byId: m.userId }, select: REQUEST_SELECT });
    await notify(await workshopManagers(m.space.id), { title: `Reschedule asked: ${name}`, body: `${dayText(newStart)} → ${dayText(new Date(newStart.getTime() + (newDays - 1) * DAY))}. ${reason}`, link }).catch(() => {});
    return NextResponse.json(r, { status: 201 });
  }
  return NextResponse.json({ error: "Say whether it's running late or needs rescheduling" }, { status: 400 });
}
