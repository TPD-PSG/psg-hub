import { myCompanyLimit, productionWhere, optionalProductionWhere } from "@/lib/companyScope";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { money, toDate } from "@/lib/parse";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const todos = await prisma.invoiceTodo.findMany({
    where: optionalProductionWhere(await myCompanyLimit()), // companies they can see
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: { production: { select: { id: true, name: true } } },
  });
  return NextResponse.json(todos);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.client !== "string" || !body.client.trim()) return NextResponse.json({ error: "Who's the invoice for?" }, { status: 400 });
  const todo = await prisma.invoiceTodo.create({
    data: {
      client: body.client,
      description: typeof body.description === "string" ? body.description : "",
      productionId: body.productionId ? Number(body.productionId) : null,
      amount: money(body.amount),
      dueDate: (toDate(body.dueDate) ?? null),
      notes: body.notes || null,
      done: false,
    },
    include: { production: { select: { id: true, name: true } } },
  });
  return NextResponse.json(todo);
}
