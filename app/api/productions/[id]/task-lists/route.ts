import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const lists = await prisma.taskList.findMany({
    where: { productionId: Number(id) },
    orderBy: { position: "asc" },
  });
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const { name } = await req.json();
  const count = await prisma.taskList.count({ where: { productionId: Number(id) } });
  const list = await prisma.taskList.create({
    data: { productionId: Number(id), name, position: count },
  });
  return NextResponse.json(list);
}
