import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { title: "The title can't be blank" });
  if (blank) return blank;

  const post = await prisma.marketingPost.update({
    where: { id: Number(id) },
    data: {
      title: body.title ?? undefined,
      caption: body.caption !== undefined ? (body.caption || null) : undefined,
      platforms: body.platforms !== undefined ? JSON.stringify(body.platforms) : undefined,
      status: body.status ?? undefined,
      scheduledAt: body.scheduledAt !== undefined ? ((toDate(body.scheduledAt) ?? null)) : undefined,
      publishedAt: body.publishedAt !== undefined ? ((toDate(body.publishedAt) ?? null)) : undefined,
      productionId: body.productionId !== undefined ? (body.productionId ? Number(body.productionId) : null) : undefined,
      imageUrl: body.imageUrl !== undefined ? (body.imageUrl || null) : undefined,
      link: body.link !== undefined ? (body.link || null) : undefined,
      tags: body.tags !== undefined ? (body.tags || null) : undefined,
      notes: body.notes !== undefined ? (body.notes || null) : undefined,
    },
    include: {
      production: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  return NextResponse.json(post);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.marketingPost.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
