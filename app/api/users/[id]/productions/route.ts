import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const teams = await prisma.productionTeam.findMany({
    where: { userId: Number(id) },
    select: { productionId: true },
  });
  return NextResponse.json(teams.map((t) => t.productionId));
}
