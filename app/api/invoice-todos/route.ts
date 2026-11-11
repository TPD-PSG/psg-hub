import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const todos = await prisma.invoiceTodo.findMany({
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: { production: { select: { id: true, name: true } } },
  });
  return NextResponse.json(todos);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const todo = await prisma.invoiceTodo.create({
    data: {
      client: body.client,
      description: body.description,
      productionId: body.productionId ? Number(body.productionId) : null,
      amount: body.amount ? Number(body.amount) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notes: body.notes || null,
      done: false,
    },
    include: { production: { select: { id: true, name: true } } },
  });
  return NextResponse.json(todo);
}
