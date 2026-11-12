import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const contacts = await prisma.productionContact.findMany({
    where: { productionId: Number(id) },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const contact = await prisma.productionContact.create({
    data: {
      productionId: Number(id),
      section: body.section || "General",
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      name: body.name,
      company: body.company || null,
      role: body.role || null,
      phone: body.phone || null,
      email: body.email || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(contact, { status: 201 });
}
