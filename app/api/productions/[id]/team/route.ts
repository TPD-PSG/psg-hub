import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { userId } = await req.json();

  const entry = await prisma.productionTeam.upsert({
    where: { productionId_userId: { productionId: Number(id), userId: Number(userId) } },
    create: { productionId: Number(id), userId: Number(userId) },
    update: {},
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  return NextResponse.json(entry, { status: 201 });
}
