import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const item = await prisma.propertyDocument.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      type: body.type || "other",
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      fileUrl: body.fileUrl || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.propertyDocument.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
