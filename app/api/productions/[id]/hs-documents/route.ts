import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export const maxDuration = 60;
const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png", "image/gif", "image/webp",
];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "hs");
  if ("error" in access) return access.error;
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const folder = (fd.get("folder") as string) || "General";
  const tourStopId = fd.get("tourStopId") ? Number(fd.get("tourStopId")) : null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
  const bytes = await file.arrayBuffer();
  const data = Buffer.from(bytes).toString("base64");
  const doc = await prisma.hSDocument.create({
    data: { productionId: Number(id), name: file.name, mime: file.type, data, folder, tourStopId },
    select: { id: true, name: true, mime: true, folder: true, tourStopId: true, createdAt: true },
  });
  return NextResponse.json(doc, { status: 201 });
}
