import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const folder = (fd.get("folder") as string) || "General";
  const tourStopId = fd.get("tourStopId") ? Number(fd.get("tourStopId")) : null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  const bytes = await file.arrayBuffer();
  const data = Buffer.from(bytes).toString("base64");
  const doc = await prisma.hSDocument.create({
    data: { productionId: Number(id), name: file.name, mime: file.type, data, folder, tourStopId },
    select: { id: true, name: true, mime: true, folder: true, tourStopId: true, createdAt: true },
  });
  return NextResponse.json(doc, { status: 201 });
}
