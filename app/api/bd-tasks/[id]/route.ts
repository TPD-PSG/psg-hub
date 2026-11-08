import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const task = await prisma.bDTask.update({
    where: { id: parseInt(id) },
    data: {
      description: data.description,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      completedAt: data.completedAt !== undefined ? (data.completedAt ? new Date(data.completedAt) : null) : undefined,
    },
  });
  return NextResponse.json(task);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.bDTask.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
