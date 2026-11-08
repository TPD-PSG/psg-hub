import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const client = await prisma.client.update({
    where: { id: parseInt(id) },
    data: { name: data.name, type: data.type, website: data.website ?? null, address: data.address ?? null, notes: data.notes ?? null },
    include: { contacts: true },
  });
  return NextResponse.json(client);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.client.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
