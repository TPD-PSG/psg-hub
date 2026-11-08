import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sheet = await prisma.callSheet.findUnique({
    where: { id: Number(id) },
    include: { entries: { orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }] } },
  });
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sheet);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const sheet = await prisma.callSheet.update({
    where: { id: Number(id) },
    data: {
      date: body.date ? new Date(body.date) : undefined,
      title: body.title ?? undefined,
      venue: body.venue ?? undefined,
      generalNotes: body.generalNotes ?? undefined,
    },
    include: { entries: { orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }] } },
  });
  return NextResponse.json(sheet);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.callSheet.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
