import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const todo = await prisma.invoiceTodo.update({
    where: { id: Number(id) },
    data: {
      client: body.client ?? undefined,
      description: body.description ?? undefined,
      productionId: body.productionId !== undefined ? (body.productionId ? Number(body.productionId) : null) : undefined,
      amount: body.amount !== undefined ? (body.amount ? Number(body.amount) : null) : undefined,
      dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
      notes: body.notes !== undefined ? (body.notes || null) : undefined,
      done: body.done !== undefined ? Boolean(body.done) : undefined,
    },
    include: { production: { select: { id: true, name: true } } },
  });
  return NextResponse.json(todo);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.invoiceTodo.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
