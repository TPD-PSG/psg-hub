import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "notes");
  if ("error" in access) return access.error;
  const notes = await prisma.productionNote.findMany({
    where: { productionId: Number(id) },
    orderBy: { order: "asc" },
    include: { createdByUser: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return NextResponse.json(notes);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "notes");
  if ("error" in access) return access.error;
  const { ids } = await req.json(); // ordered array of note ids
  await Promise.all((ids as number[]).map((noteId: number, index: number) =>
    prisma.productionNote.updateMany({ where: { id: noteId, productionId: Number(id) }, data: { order: index } })
  ));
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "notes");
  if ("error" in access) return access.error;
  if (access.role !== "admin" && access.role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = access.userId;
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
