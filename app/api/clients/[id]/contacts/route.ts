import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const contact = await prisma.contact.create({
    data: {
      clientId: parseInt(id),
      name: data.name,
      role: data.role || null,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
    },
  });
  return NextResponse.json(contact, { status: 201 });
}
