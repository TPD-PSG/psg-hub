// Tick one of your own parts done (or not done)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { myWorkViewer } from "@/lib/myWork";

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const v = await myWorkViewer(slug);
  if ("error" in v) return v.error;
  const body = await req.json().catch(() => ({}));
  if (typeof body.done !== "boolean") return NextResponse.json({ error: "Say whether it's done" }, { status: 400 });
  const r = await prisma.buildPart.updateMany({ where: { id: Number(id) || 0, userId: v.userId, job: { entityId: v.space.id, status: { not: "cancelled" } } }, data: { done: body.done } });
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: Number(id), done: body.done });
}
