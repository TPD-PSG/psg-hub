import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import { join } from "path";

const MEDIA_DIR = process.env.NODE_ENV === "production"
  ? "/data/fun-media"
  : join(process.cwd(), "public", "fun-media");

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await prisma.funMedia.findUnique({ where: { id: Number(id) } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let buf: Buffer;
  if (media.filePath) {
    buf = await readFile(join(MEDIA_DIR, media.filePath));
  } else if (media.data) {
    buf = Buffer.from(media.data, "base64");
  } else {
    return NextResponse.json({ error: "No data" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": media.mime, "Cache-Control": "private, max-age=86400" },
  });
}
