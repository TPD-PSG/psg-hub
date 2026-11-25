// Share a build photo to the space's noticeboard (once)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberOfEntity, POST_INCLUDE } from "@/lib/spaceBoard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const photo = await prisma.spacePhoto.findUnique({ where: { id: parseInt((await params).id) } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await memberOfEntity(photo.entityId);
  if ("error" in m) return m.error;
  if (photo.postId) return NextResponse.json({ error: "Already on the noticeboard" }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "showcase" ? "showcase" : "photo";
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 140) : photo.caption;
  const post = await prisma.spacePost.create({ data: { entityId: photo.entityId, authorId: m.userId, kind, title, jobId: photo.jobId }, select: { id: true } });
  await prisma.spacePhoto.update({ where: { id: photo.id }, data: { postId: post.id } });
  return NextResponse.json(await prisma.spacePost.findUnique({ where: { id: post.id }, include: POST_INCLUDE }), { status: 201 });
}
