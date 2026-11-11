import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    where.scheduledAt = { gte: start, lt: end };
  }

  const posts = await prisma.marketingPost.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: {
      production: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const body = await req.json();

  const post = await prisma.marketingPost.create({
    data: {
      title: body.title,
      caption: body.caption || null,
      platforms: body.platforms ? JSON.stringify(body.platforms) : "[]",
      status: body.status || "draft",
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      productionId: body.productionId ? Number(body.productionId) : null,
      imageUrl: body.imageUrl || null,
      link: body.link || null,
      tags: body.tags || null,
      notes: body.notes || null,
      createdByUserId: userId,
    },
    include: {
      production: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  return NextResponse.json(post);
}
