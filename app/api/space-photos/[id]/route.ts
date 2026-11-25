// A photo in a company space: served to people who can open that space; deleted by its uploader or an admin.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberOfEntity } from "@/lib/spaceBoard";
import { loadFile, removeFile } from "@/lib/storage";

const find = async (params: Promise<{ id: string }>) => prisma.spacePhoto.findUnique({ where: { id: parseInt((await params).id) } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const photo = await find(params);
  if (!photo) return new Response("Not found", { status: 404 });
  const m = await memberOfEntity(photo.entityId);
  if ("error" in m) return new Response("Forbidden", { status: m.error.status });
  const bytes = await loadFile(photo.fileKey, photo.data).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=604800, immutable", "X-Content-Type-Options": "nosniff" } });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const photo = await find(params);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await memberOfEntity(photo.entityId);
  if ("error" in m) return m.error;
  if (photo.uploadedById !== m.userId && m.role !== "admin") return NextResponse.json({ error: "Only the person who added it (or an admin) can delete it" }, { status: 403 });
  await prisma.spacePhoto.delete({ where: { id: photo.id } });
  if (photo.fileKey) await removeFile(photo.fileKey).catch(() => {});
  // A photo post left with no photos and no words goes too
  if (photo.postId) {
    const post = await prisma.spacePost.findUnique({ where: { id: photo.postId }, select: { title: true, body: true, _count: { select: { photos: true } } } });
    if (post && !post._count.photos && !post.title && !post.body) await prisma.spacePost.delete({ where: { id: photo.postId } });
  }
  return NextResponse.json({ ok: true });
}
