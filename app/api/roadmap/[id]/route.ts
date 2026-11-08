import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const item = await prisma.roadmapItem.update({
    where: { id: Number(params.id) },
    data: {
      title: body.title !== undefined ? body.title : undefined,
      body: body.body !== undefined ? body.body : undefined,
      category: body.category !== undefined ? body.category : undefined,
      status: body.status !== undefined ? body.status : undefined,
      pinned: body.pinned !== undefined ? body.pinned : undefined,
    },
    include: { createdByUser: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  const item = await prisma.roadmapItem.findUnique({ where: { id: Number(params.id) } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only creator or admin can delete
  if (item.createdByUserId !== userId && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.roadmapItem.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
