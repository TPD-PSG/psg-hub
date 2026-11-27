import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const item = await prisma.propertyDocument.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      type: body.type || "other",
      expiryDate: (toDate(body.expiryDate) ?? null),
      fileUrl: body.fileUrl || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.propertyDocument.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
