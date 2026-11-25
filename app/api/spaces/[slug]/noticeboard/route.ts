// A space's noticeboard: posts (pinned first) and build of the month; post a notice, photo or showcase.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember, storePhotos, buildOfMonth, POST_INCLUDE, withUrl } from "@/lib/spaceBoard";

export const dynamic = "force-dynamic";
const KINDS = ["notice", "photo", "showcase"];

const shape = (p: { photos: { id: number }[] } & Record<string, unknown>) => ({ ...p, photos: p.photos.map(withUrl) });

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  const [posts, botm, jobs] = await Promise.all([
    prisma.spacePost.findMany({ where: { entityId: m.space.id }, include: POST_INCLUDE, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 60 }),
    buildOfMonth(m.space.id, m.userId),
    prisma.job.findMany({ where: { entityId: m.space.id, status: { not: "cancelled" } }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return NextResponse.json({ space: m.space, posts: posts.map(shape), botm, jobs, me: { id: m.userId, staff: m.staff, admin: m.role === "admin" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "notice");
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Notice, photo or showcase" }, { status: 400 });
  const title = String(form.get("title") ?? "").trim().slice(0, 140) || null;
  const body = String(form.get("body") ?? "").trim().slice(0, 4000) || null;
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 8);
  if (!title && !body && !files.length) return NextResponse.json({ error: "Write something or add a photo" }, { status: 400 });
  if (kind !== "notice" && !files.length) return NextResponse.json({ error: "Add a photo" }, { status: 400 });
  const jobRaw = form.get("jobId");
  const jobId = jobRaw ? Number(jobRaw) : null;
  if (jobId && !(await prisma.job.count({ where: { id: jobId, entityId: m.space.id } }))) return NextResponse.json({ error: "Pick one of this company's builds" }, { status: 400 });
  let rows;
  try { rows = await storePhotos(files, m.space.id, m.userId, { jobId }); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  const created = await prisma.spacePost.create({ data: { entityId: m.space.id, authorId: m.userId, kind, title, body, jobId }, select: { id: true } });
  if (rows.length) await prisma.spacePhoto.createMany({ data: rows.map(r => ({ ...r, postId: created.id })) });
  const post = (await prisma.spacePost.findUnique({ where: { id: created.id }, include: POST_INCLUDE }))!;
  return NextResponse.json(shape(post), { status: 201 });
}
