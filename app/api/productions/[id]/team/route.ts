import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  if (access.role !== "admin" && access.role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId } = await req.json();

  const entry = await prisma.productionTeam.upsert({
    where: { productionId_userId: { productionId: Number(id), userId: Number(userId) } },
    create: { productionId: Number(id), userId: Number(userId) },
    update: {},
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  return NextResponse.json(entry, { status: 201 });
}
