import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { money } from "@/lib/parse";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { title: "The title can't be blank" });
  if (blank) return blank;
  const item = await prisma.propertyMaintenance.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      description: body.description || null,
      status: body.status,
      priority: body.priority,
      contractor: body.contractor || null,
      cost: money(body.cost),
      resolvedAt: body.status === "resolved" ? new Date() : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.propertyMaintenance.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
