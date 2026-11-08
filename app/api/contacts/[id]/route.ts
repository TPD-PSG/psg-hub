import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const contact = await prisma.contact.update({
    where: { id: parseInt(id) },
    data: { name: data.name, role: data.role ?? null, email: data.email ?? null, phone: data.phone ?? null, notes: data.notes ?? null },
  });
  return NextResponse.json(contact);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.contact.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
