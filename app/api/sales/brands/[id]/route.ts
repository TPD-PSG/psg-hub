import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const brand = await prisma.salesBrand.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      category: body.category,
      stage: body.stage,
      website: body.website || null,
      rep: body.rep || null,
      repEmail: body.repEmail || null,
      repPhone: body.repPhone || null,
      notes: body.notes || null,
      priority: body.priority,
    },
    include: { tasks: { where: { completedAt: null }, orderBy: { dueDate: "asc" } } },
  });
  return NextResponse.json(brand);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.salesBrand.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
