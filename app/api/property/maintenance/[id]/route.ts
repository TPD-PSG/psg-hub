import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const item = await prisma.propertyMaintenance.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      description: body.description || null,
      status: body.status,
      priority: body.priority,
      contractor: body.contractor || null,
      cost: body.cost ? Number(body.cost) : null,
      resolvedAt: body.status === "resolved" ? new Date() : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.propertyMaintenance.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
