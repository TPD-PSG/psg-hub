// Rename, recolour, reorder or archive a discipline (archived ones keep their stages but aren't offered)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarStaff } from "@/lib/workshopCalendar";

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const m = await calendarStaff(slug);
  if ("error" in m) return m.error;
  const d = await prisma.workshopDiscipline.findFirst({ where: { id: Number(id) || 0, entityId: m.space.id }, select: { id: true } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") { const n = body.name.trim().slice(0, 40); if (!n) return NextResponse.json({ error: "The name can't be blank" }, { status: 400 }); data.name = n; }
  if (typeof body.color === "string") { if (!/^#[0-9a-f]{6}$/i.test(body.color)) return NextResponse.json({ error: "Colour must look like #1a2b3c" }, { status: 400 }); data.color = body.color; }
  if (Number.isInteger(body.sortOrder)) data.sortOrder = body.sortOrder;
  if (typeof body.archived === "boolean") data.archived = body.archived;
  return NextResponse.json(await prisma.workshopDiscipline.update({ where: { id: d.id }, data }));
}
