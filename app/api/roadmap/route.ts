import { NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROADMAP_INCLUDE } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.roadmapItem.findMany({
    include: ROADMAP_INCLUDE,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id?: string }).id);
  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { title: "Give the item a title" });
  if (bad) return bad;
  const item = await prisma.roadmapItem.create({
    data: {
      title: body.title,
      body: body.body ?? null,
      category: body.category ?? "general",
      status: body.status ?? "idea",
      createdByUserId: userId,
    },
    include: ROADMAP_INCLUDE,
  });
  return NextResponse.json(item, { status: 201 });
}
