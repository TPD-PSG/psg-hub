import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import { join } from "path";
import { auth } from "@/auth";
import { fileHeaders } from "@/lib/fileHeaders";

const MEDIA_DIR = process.env.NODE_ENV === "production"
  ? "/data/fun-media"
  : join(process.cwd(), "public", "fun-media");

export async function GET(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    headers: fileHeaders(media.mime, media.name, { "Cache-Control": "private, max-age=86400" }), // older uploads of any type download rather than open
  });
}
