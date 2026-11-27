// Add a discipline stage to a piece (build part) on one of this space's builds
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarStaff, stageFields, STAGE_SELECT } from "@/lib/workshopCalendar";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await calendarStaff((await params).slug);
  if ("error" in m) return m.error;
  const body = await req.json().catch(() => ({}));
  const part = await prisma.buildPart.findFirst({ where: { id: Number(body.partId) || 0, job: { entityId: m.space.id } }, select: { id: true } });
  if (!part) return NextResponse.json({ error: "Pick a piece on one of this workshop's builds" }, { status: 404 });
  const f = stageFields(body);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  if (!f.data.disciplineId || !(await prisma.workshopDiscipline.count({ where: { id: f.data.disciplineId as number, entityId: m.space.id } }))) return NextResponse.json({ error: "Pick a discipline" }, { status: 400 });
  const last = await prisma.partStage.aggregate({ where: { partId: part.id }, _max: { sortOrder: true } });
  const stage = await prisma.partStage.create({ data: { partId: part.id, disciplineId: f.data.disciplineId as number, ...f.data, sortOrder: (last._max.sortOrder ?? -1) + 1 }, select: STAGE_SELECT });
  return NextResponse.json(stage, { status: 201 });
}
