import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const task = await prisma.salesTask.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      notes: body.notes || null,
      dueDate: (toDate(body.dueDate) ?? null),
      priority: body.priority,
      brandId: body.brandId ? Number(body.brandId) : null,
      completedAt: body.completedAt !== undefined ? ((toDate(body.completedAt) ?? null)) : undefined,
    },
    include: { brand: { select: { id: true, name: true } } },
  });
  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.salesTask.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
