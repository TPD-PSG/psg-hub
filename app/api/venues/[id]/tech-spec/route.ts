import { NextRequest, NextResponse } from "next/server";
import { fileHeaders } from "@/lib/fileHeaders";
import { prisma } from "@/lib/prisma";
import { fileToContent, parseTechSpec } from "@/lib/venueParser";
import { ClaudeOutputError } from "@/lib/claude";
import { auth } from "@/auth";
import { saveFile, loadFile, removeFile } from "@/lib/storage";

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
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });

  const buffer = await file.arrayBuffer();

  // Store the file first (R2 if configured), replacing any previous one
  const previous = await prisma.venue.findUnique({ where: { id: Number(id) }, select: { techSpecFileKey: true } });
  const stored = await saveFile("venue-tech-specs", file.name, buffer, file.type);
  await prisma.venue.update({
    where: { id: Number(id) },
    data: { techSpecFile: stored.base64, techSpecFileKey: stored.key, techSpecName: file.name, techSpecMime: file.type },
  });
  await removeFile(previous?.techSpecFileKey);

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
  const venue = await prisma.venue.findUnique({ where: { id: Number(id) }, select: { techSpecFile: true, techSpecFileKey: true, techSpecName: true, techSpecMime: true } });
  const buffer = venue ? await loadFile(venue.techSpecFileKey, venue.techSpecFile) : null;
  if (!venue || !buffer) return NextResponse.json({ error: "No file" }, { status: 404 });
  return new NextResponse(buffer, {
    headers: {
      ...fileHeaders(venue.techSpecMime, venue.techSpecName ?? "tech-spec", {}, { download: true }),
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const previous = await prisma.venue.findUnique({ where: { id: Number(id) }, select: { techSpecFileKey: true } });
  await prisma.venue.update({ where: { id: Number(id) }, data: { techSpecFile: null, techSpecFileKey: null, techSpecName: null, techSpecMime: null } });
  await removeFile(previous?.techSpecFileKey);
  return NextResponse.json({ ok: true });
}
