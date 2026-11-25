import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { spaceMember } from "@/lib/spaceBoard";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const MEDIA_DIR = process.env.NODE_ENV === "production"
  ? "/data/fun-media"
  : join(process.cwd(), "public", "fun-media");

export const maxDuration = 60;
// Allow large video uploads (up to 200MB)
export const dynamic = "force-dynamic";


export async function GET() {
  // Returns all submissions for the current user (pending) + all published (in a roundup)
  const session = await auth();
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const isAdmin = (session?.user as any)?.role === "admin";

  const [mine, roundups] = await Promise.all([
    // Pending submissions: admins see all, others see only their own
    prisma.funSubmission.findMany({
      where: isAdmin ? { roundupId: null } : { authorId: userId, roundupId: null },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        media: { select: { id: true, name: true, mime: true } },
        entity: { select: { id: true, name: true, shortName: true, slug: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // All sent roundups
    prisma.funRoundup.findMany({
      orderBy: { sentAt: "desc" },
      include: {
        submissions: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            media: { select: { id: true, name: true, mime: true } },
            entity: { select: { id: true, name: true, shortName: true, slug: true, color: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  return NextResponse.json({ pending: mine, roundups });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const formData = await req.formData();
  const title = formData.get("title") as string;
  const story = formData.get("story") as string;
  const files = formData.getAll("media") as File[];
  // Posted from inside a company space (e.g. TWS): the story carries that company's badge
  const spaceSlug = formData.get("spaceSlug");
  let entityId: number | null = null;
  if (typeof spaceSlug === "string" && spaceSlug) {
    const m = await spaceMember(spaceSlug);
    if ("error" in m) return m.error;
    entityId = m.space.id;
  }

  const MAX_FILE_MB = 150;
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `"${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum file size is ${MAX_FILE_MB}MB.` },
        { status: 413 }
      );
    }
  }

  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (files.length) await mkdir(MEDIA_DIR, { recursive: true }); // only when there are photos to keep
  const mediaData = await Promise.all(
    files.map(async (file) => {
      const buf = await file.arrayBuffer();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const filename = `${randomUUID()}.${ext}`;
      await writeFile(join(MEDIA_DIR, filename), Buffer.from(buf));
      return { name: file.name, mime: file.type, filePath: filename, data: null };
    })
  );

  const submission = await prisma.funSubmission.create({
    data: {
      authorId: userId,
      title,
      story,
      monthYear,
      entityId,
      media: { create: mediaData },
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      media: { select: { id: true, name: true, mime: true } },
      entity: { select: { id: true, name: true, shortName: true, slug: true, color: true } },
    },
  });

  return NextResponse.json(submission, { status: 201 });
}
