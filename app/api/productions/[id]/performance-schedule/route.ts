import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const productionId = Number(id);

  const schedule = await prisma.performanceSchedule.findUnique({ where: { productionId } });
  const overrides = await prisma.performanceDateOverride.findMany({
    where: { productionId },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ schedule, overrides });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const productionId = Number(id);
  const body = await req.json();

  const schedule = await prisma.performanceSchedule.upsert({
    where: { productionId },
    create: { productionId, weekPattern: body.weekPattern ?? 0, matineePattern: body.matineePattern ?? 0 },
    update: { weekPattern: body.weekPattern ?? 0, matineePattern: body.matineePattern ?? 0 },
  });
  return NextResponse.json(schedule);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const productionId = Number(id);
  const body = await req.json();

  // Toggle: if override exists remove it, otherwise create it
  const existing = await prisma.performanceDateOverride.findFirst({
    where: { productionId, date: body.date, type: body.type },
  });
  if (existing) {
    await prisma.performanceDateOverride.delete({ where: { id: existing.id } });
    return NextResponse.json({ deleted: true });
  }
  const override = await prisma.performanceDateOverride.create({
    data: { productionId, date: body.date, type: body.type },
  });
  return NextResponse.json(override);
}
