import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fileToContent, parseTechSpec } from "@/lib/venueParser";
import { ClaudeOutputError } from "@/lib/claude";
import { auth } from "@/auth";

const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png", "image/gif", "image/webp",
];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  // Store the file first
  await prisma.venue.update({
    where: { id: Number(id) },
    data: { techSpecFile: base64, techSpecName: file.name, techSpecMime: file.type },
  });

  // Read the spec with Claude; the file is kept even if that fails
  const doc = await fileToContent(buffer, file.name, file.type);
  if (!doc) return NextResponse.json({ ok: true, name: file.name, parsed: false, error: "File saved. This format can't be read automatically." });
  try {
    const techSpecs = await parseTechSpec(doc);
    await prisma.venue.update({
      where: { id: Number(id) },
      data: { techSpecs: JSON.stringify(techSpecs) },
    });
    return NextResponse.json({ ok: true, name: file.name, parsed: true, techSpecs });
  } catch (err) {
    console.error("Tech spec parse error:", err instanceof Error ? err.message : err);
    const reason = err instanceof ClaudeOutputError ? err.message : "Parse failed";
    return NextResponse.json({ ok: true, name: file.name, parsed: false, error: `${reason} File saved.` });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.venue.update({ where: { id: Number(id) }, data: { techSpecFile: null, techSpecName: null, techSpecMime: null } });
  return NextResponse.json({ ok: true });
}
