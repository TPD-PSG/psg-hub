import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.notification.update({ where: { id: Number(id) }, data: { read: true } });
  return NextResponse.json({ ok: true });
}
