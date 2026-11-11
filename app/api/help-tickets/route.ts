import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const include = {
  createdByUser: { select: { id: true, name: true } },
  assignedToUser: { select: { id: true, name: true } },
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const userId = Number((session.user as any).id);
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1" && role === "admin";

  const tickets = await prisma.helpTicket.findMany({
    where: all ? undefined : { createdByUserId: userId },
    include,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const body = await req.json();

  const ticket = await prisma.helpTicket.create({
    data: {
      title: body.title,
      description: body.description || null,
      category: body.category || "bug",
      priority: body.priority || "medium",
      createdByUserId: userId,
    },
    include,
  });
  return NextResponse.json(ticket);
}
