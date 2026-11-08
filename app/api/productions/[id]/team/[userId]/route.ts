import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  await prisma.productionTeam.deleteMany({
    where: { productionId: Number(id), userId: Number(userId) },
  });
  return NextResponse.json({ ok: true });
}
