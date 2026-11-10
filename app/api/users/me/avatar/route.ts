import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const prisma = new PrismaClient();

// Store avatars on the persistent volume so they survive redeploys
const AVATAR_DIR = process.env.NODE_ENV === "production"
  ? "/data/avatars"
  : join(process.cwd(), "public", "avatars");

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("avatar") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const filename = `${userId}.${ext}`;
  await mkdir(AVATAR_DIR, { recursive: true });
  await writeFile(join(AVATAR_DIR, filename), Buffer.from(bytes));

  const avatarUrl = `/api/avatars/${filename}`;
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });

  return NextResponse.json({ avatarUrl });
}
