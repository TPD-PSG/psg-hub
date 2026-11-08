import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const opportunities = await prisma.opportunity.findMany({
    include: { client: true, tasks: { orderBy: { dueDate: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(opportunities);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const opp = await prisma.opportunity.create({
    data: {
      title: data.title,
      type: data.type,
      stage: data.stage ?? "lead",
      value: data.value ? parseFloat(data.value) : null,
      clientId: data.clientId ? parseInt(data.clientId) : null,
      description: data.description || null,
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      notes: data.notes || null,
    },
    include: { client: true, tasks: true },
  });
  return NextResponse.json(opp, { status: 201 });
}
