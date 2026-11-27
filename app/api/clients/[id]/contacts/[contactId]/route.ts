// Remove a contact from a client (PSG staff)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, contactId } = await params;
  const { count } = await prisma.contact.deleteMany({ where: { id: parseInt(contactId), clientId: parseInt(id) } });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
