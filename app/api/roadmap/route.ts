import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.roadmapItem.findMany({
    include: { createdByUser: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const body = await req.json();
  const item = await prisma.roadmapItem.create({
    data: {
      title: body.title,
      body: body.body ?? null,
      category: body.category ?? "general",
      status: body.status ?? "idea",
      createdByUserId: userId,
    },
    include: { createdByUser: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return NextResponse.json(item, { status: 201 });
}
