import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await prisma.funMedia.findUnique({ where: { id: Number(id) } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = Buffer.from(media.data, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": media.mime, "Cache-Control": "private, max-age=86400" },
  });
}
