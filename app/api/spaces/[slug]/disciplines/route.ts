// The workshop's disciplines (Pre-production, CNC, Carpentry…): list and add
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarStaff, disciplinesFor } from "@/lib/workshopCalendar";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await calendarStaff((await params).slug);
  if ("error" in m) return m.error;
  return NextResponse.json(await disciplinesFor(m.space.id, true));
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await calendarStaff((await params).slug);
  if ("error" in m) return m.error;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return NextResponse.json({ error: "Name the discipline" }, { status: 400 });
  const list = await disciplinesFor(m.space.id, true);
  if (list.some(d => d.name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: "There's already a discipline with that name" }, { status: 409 });
  const color = typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : "#8a8f96";
  const d = await prisma.workshopDiscipline.create({ data: { entityId: m.space.id, name, color, sortOrder: list.length } });
  return NextResponse.json(d, { status: 201 });
}
