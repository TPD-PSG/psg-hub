import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("productionContact", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
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
  const rec = await requireRecordAccess("productionContact", id);
  if ("error" in rec) return rec.error;
  await prisma.productionContact.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
