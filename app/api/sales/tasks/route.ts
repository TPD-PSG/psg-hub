import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tasks = await prisma.salesTask.findMany({
    orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: { brand: { select: { id: true, name: true } } },
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const task = await prisma.salesTask.create({
    data: {
      title: body.title,
      notes: body.notes || null,
      dueDate: (toDate(body.dueDate) ?? null),
      priority: body.priority ?? "medium",
      brandId: body.brandId ? Number(body.brandId) : null,
    },
    include: { brand: { select: { id: true, name: true } } },
  });
  return NextResponse.json(task);
}
