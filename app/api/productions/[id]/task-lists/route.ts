import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lists = await prisma.taskList.findMany({
    where: { productionId: Number(id) },
    orderBy: { position: "asc" },
  });
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await req.json();
  const count = await prisma.taskList.count({ where: { productionId: Number(id) } });
  const list = await prisma.taskList.create({
    data: { productionId: Number(id), name, position: count },
  });
  return NextResponse.json(list);
}
