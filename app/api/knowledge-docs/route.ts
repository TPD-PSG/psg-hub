import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";

// What Ask Me Anything can actually read: PDFs (as documents) and plain text (28 Nov 2026: Word,
// Excel and images were accepted but couldn't be read, while .txt and .md were offered but refused)
const ALLOWED_MIME = ["application/pdf", "text/plain", "text/markdown"];
const typeOf = (f: File) => (f.type && f.type !== "application/octet-stream" ? f.type : /\.md$/i.test(f.name) ? "text/markdown" : /\.txt$/i.test(f.name) ? "text/plain" : f.type);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const docs = await prisma.knowledgeDoc.findMany({
    select: { id: true, name: true, mime: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  const mime = typeOf(file);
  if (!ALLOWED_MIME.includes(mime)) return NextResponse.json({ error: "Ask Me Anything reads PDFs and plain text (.txt, .md). Save a Word or Excel file as PDF first." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });

  const stored = await saveFile("knowledge-docs", file.name, await file.arrayBuffer(), mime);

  const doc = await prisma.knowledgeDoc.create({
    data: { name: file.name, mime, file: stored.base64 ?? "", fileKey: stored.key },
    select: { id: true, name: true, mime: true, createdAt: true },
  });
  return NextResponse.json(doc);
}
