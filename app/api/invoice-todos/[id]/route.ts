import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { money, toDate } from "@/lib/parse";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { client: "Who it's for can't be blank", description: "The description can't be blank" });
  if (blank) return blank;
  const todo = await prisma.invoiceTodo.update({
    where: { id: Number(id) },
    data: {
      client: body.client ?? undefined,
      description: body.description ?? undefined,
      productionId: body.productionId !== undefined ? (body.productionId ? Number(body.productionId) : null) : undefined,
      amount: body.amount !== undefined ? money(body.amount) : undefined,
      dueDate: body.dueDate !== undefined ? ((toDate(body.dueDate) ?? null)) : undefined,
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
