import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const docs = await prisma.venueDocument.findMany({
    where: { venueId: Number(id) },
    select: { id: true, name: true, mime: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const doc = await prisma.venueDocument.create({
    data: { venueId: Number(id), name: file.name, mime: file.type, file: base64 },
    select: { id: true, name: true, mime: true, createdAt: true },
  });

  return NextResponse.json(doc);
}
