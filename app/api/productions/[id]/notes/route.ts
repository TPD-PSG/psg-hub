import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const notes = await prisma.productionNote.findMany({
    where: { productionId: Number(id) },
    orderBy: { updatedAt: "desc" },
    include: { createdByUser: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const userId = Number((session.user as any).id);
  const body = await req.json();
  const note = await prisma.productionNote.create({
    data: {
      productionId: Number(id),
      title: body.title,
      body: body.body,
      color: body.color || null,
      createdByUserId: userId,
    },
    include: { createdByUser: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return NextResponse.json(note, { status: 201 });
}
