import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const contact = await prisma.productionContact.update({
    where: { id: Number(id) },
    data: {
      section: body.section || "General",
      name: body.name,
      company: body.company || null,
      role: body.role || null,
      phone: body.phone || null,
      email: body.email || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.productionContact.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
