// Change a stage (dates, length, person, status, discipline) or remove it
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarStaff, stageFields, STAGE_SELECT } from "@/lib/workshopCalendar";

async function find(slug: string, rawId: string) {
  const m = await calendarStaff(slug);
  if ("error" in m) return m;
  const stage = await prisma.partStage.findFirst({ where: { id: Number(rawId) || 0, part: { job: { entityId: m.space.id } } }, select: { id: true } });
  if (!stage) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { m, stage };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const r = await find(slug, id);
  if ("error" in r) return r.error;
  const f = stageFields(await req.json().catch(() => ({})));
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  if (f.data.disciplineId && !(await prisma.workshopDiscipline.count({ where: { id: f.data.disciplineId as number, entityId: r.m.space.id } }))) return NextResponse.json({ error: "Pick a discipline" }, { status: 400 });
  const stage = await prisma.partStage.update({ where: { id: r.stage.id }, data: f.data, select: STAGE_SELECT });
  return NextResponse.json(stage);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const r = await find(slug, id);
  if ("error" in r) return r.error;
  await prisma.partStage.delete({ where: { id: r.stage.id } });
  return NextResponse.json({ ok: true });
}
