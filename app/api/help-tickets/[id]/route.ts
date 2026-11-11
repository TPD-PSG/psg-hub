import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === "resolved" || body.status === "closed") data.resolvedAt = new Date();
    else data.resolvedAt = null;
  }
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.assignedToUserId !== undefined) data.assignedToUserId = body.assignedToUserId ? Number(body.assignedToUserId) : null;

  const ticket = await prisma.helpTicket.update({
    where: { id: Number(id) },
    data,
    include: {
      createdByUser: { select: { id: true, name: true } },
      assignedToUser: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(ticket);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.helpTicket.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
