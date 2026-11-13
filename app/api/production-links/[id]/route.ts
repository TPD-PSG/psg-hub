import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const link = await prisma.productionLink.update({
    where: { id: Number(id) },
    data: { title: body.title, url: body.url, description: body.description || null },
  });
  return NextResponse.json(link);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.productionLink.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
