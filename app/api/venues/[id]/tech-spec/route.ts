import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  await prisma.venue.update({
    where: { id: Number(id) },
    data: {
      techSpecFile: base64,
      techSpecName: file.name,
      techSpecMime: file.type,
    },
  });
  return NextResponse.json({ ok: true, name: file.name });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await prisma.venue.findUnique({ where: { id: Number(id) }, select: { techSpecFile: true, techSpecName: true, techSpecMime: true } });
  if (!venue?.techSpecFile) return NextResponse.json({ error: "No file" }, { status: 404 });

  const buffer = Buffer.from(venue.techSpecFile, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": venue.techSpecMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${venue.techSpecName ?? "tech-spec"}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.venue.update({ where: { id: Number(id) }, data: { techSpecFile: null, techSpecName: null, techSpecMime: null } });
  return NextResponse.json({ ok: true });
}
