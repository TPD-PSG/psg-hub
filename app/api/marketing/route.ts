import { myCompanyLimit, productionWhere, optionalProductionWhere } from "@/lib/companyScope";
import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

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

  const limit = await myCompanyLimit(); // companies they can see
  if (limit) Object.assign(where, optionalProductionWhere(limit));
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
  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { title: "Give the post a title" });
  if (bad) return bad;

  const post = await prisma.marketingPost.create({
    data: {
      title: body.title,
      caption: body.caption || null,
      platforms: body.platforms ? JSON.stringify(body.platforms) : "[]",
      status: body.status || "draft",
      scheduledAt: (toDate(body.scheduledAt) ?? null),
      publishedAt: (toDate(body.publishedAt) ?? null),
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
