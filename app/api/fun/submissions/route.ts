import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";


export async function GET() {
  // Returns all submissions for the current user (pending) + all published (in a roundup)
  const session = await auth();
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const [mine, roundups] = await Promise.all([
    // User's own pending submissions (not yet in a roundup)
    prisma.funSubmission.findMany({
      where: { authorId: userId, roundupId: null },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        media: { select: { id: true, name: true, mime: true } },
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

  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const mediaData = await Promise.all(
    files.map(async (file) => {
      const buf = await file.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      return { name: file.name, mime: file.type, data: b64 };
    })
  );

  const submission = await prisma.funSubmission.create({
    data: {
      authorId: userId,
      title,
      story,
      monthYear,
      media: { create: mediaData },
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      media: { select: { id: true, name: true, mime: true } },
    },
  });

  return NextResponse.json(submission, { status: 201 });
}
