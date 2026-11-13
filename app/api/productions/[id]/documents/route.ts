import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const folder = (form.get("folder") as string) || "General";
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const data = buffer.toString("base64");
  const doc = await prisma.productionDocument.create({
    data: { productionId: Number(id), name: file.name, mime: file.type || "application/octet-stream", data, folder },
  });
  return NextResponse.json({ id: doc.id, name: doc.name, mime: doc.mime, folder: doc.folder, createdAt: doc.createdAt }, { status: 201 });
}
