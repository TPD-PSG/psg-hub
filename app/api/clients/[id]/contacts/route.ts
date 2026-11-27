import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const data = await req.json().catch(() => ({}));
  if (typeof data.name !== "string" || !data.name.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
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
