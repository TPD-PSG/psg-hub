import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const opp = await prisma.opportunity.update({
    where: { id: parseInt(id) },
    data: {
      title: data.title,
      type: data.type,
      stage: data.stage,
      value: data.value !== undefined ? (data.value ? parseFloat(data.value) : null) : undefined,
      clientId: data.clientId !== undefined ? (data.clientId ? parseInt(data.clientId) : null) : undefined,
      description: data.description ?? null,
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      lostReason: data.lostReason ?? null,
      notes: data.notes ?? null,
    },
    include: { client: true, tasks: true },
  });
  return NextResponse.json(opp);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.opportunity.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
