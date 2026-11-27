import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Alarm records hold the alarm codes: admins only (28 Nov 2026)
  if ((session.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Only admins can change alarm records" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { name: "The name can't be blank" });
  if (blank) return blank;
  const item = await prisma.propertyAlarm.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      code: body.code || null,
      zones: body.zones || null,
      monitoringCo: body.monitoringCo || null,
      monitoringPhone: body.monitoringPhone || null,
      keyholders: body.keyholders || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Alarm records hold the alarm codes: admins only (28 Nov 2026)
  if ((session.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Only admins can change alarm records" }, { status: 403 });
  const { id } = await params;
  await prisma.propertyAlarm.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
