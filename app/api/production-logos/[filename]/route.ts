import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { auth } from "@/auth";

const LOGO_DIR = process.env.NODE_ENV === "production"
  ? "/data/production-logos"
  : join(process.cwd(), "public", "production-logos");

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename } = await params;
  if (filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const ext = extname(filename).slice(1).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });

  try {
    const buffer = await readFile(join(LOGO_DIR, filename));
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
