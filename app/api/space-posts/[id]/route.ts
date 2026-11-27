// Pin or unpin a noticeboard post (PSG staff), or delete it (its author or an admin).
// Photos uploaded with the post go with it; build photos shared to it stay on the build.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberOfEntity } from "@/lib/spaceBoard";
import { removeFile } from "@/lib/storage";

const find = async (params: Promise<{ id: string }>) => prisma.spacePost.findUnique({ where: { id: parseInt((await params).id) }, select: { id: true, entityId: true, authorId: true } });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const post = await find(params);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await memberOfEntity(post.entityId);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Only PSG staff can pin posts" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await prisma.spacePost.update({ where: { id: post.id }, data: { pinned: !!body.pinned }, select: { id: true, pinned: true } }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const post = await find(params);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await memberOfEntity(post.entityId);
  if ("error" in m) return m.error;
  if (post.authorId !== m.userId && m.role !== "admin") return NextResponse.json({ error: "Only the person who posted it (or an admin) can delete it" }, { status: 403 });
  const own = await prisma.spacePhoto.findMany({ where: { postId: post.id, jobId: null }, select: { id: true, fileKey: true } });
  await prisma.spacePhoto.deleteMany({ where: { id: { in: own.map(p => p.id) } } });
  await prisma.spacePost.delete({ where: { id: post.id } });
  for (const p of own) if (p.fileKey) await removeFile(p.fileKey).catch(() => {});
  return NextResponse.json({ ok: true });
}
