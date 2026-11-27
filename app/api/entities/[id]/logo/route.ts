// Upload or remove a company's logo (admins only). It's served at /api/spaces/<slug>/logo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { saveFile, removeFile } from "@/lib/storage";
import { ENTITY_SELECT } from "@/lib/entities";

const TYPES = ["image/png", "image/jpeg", "image/webp"]; // no SVG: it can carry script
const MAX = 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = parseInt((await params).id);
  const existing = await prisma.entity.findUnique({ where: { id }, select: { logoKey: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  const file = form.get("logo");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Logo must be PNG, JPEG or WebP" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Logo must be under 1 MB" }, { status: 400 });
  const stored = await saveFile("entity-logos", file.name, await file.arrayBuffer(), file.type);
  const entity = await prisma.entity.update({
    where: { id },
    data: { logoKey: stored.key, logoData: stored.base64, logoMime: file.type },
    select: ENTITY_SELECT,
  });
  if (existing.logoKey) await removeFile(existing.logoKey).catch(() => {});
  return NextResponse.json(entity);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = parseInt((await params).id);
  const existing = await prisma.entity.findUnique({ where: { id }, select: { logoKey: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const entity = await prisma.entity.update({ where: { id }, data: { logoKey: null, logoData: null, logoMime: null }, select: ENTITY_SELECT });
  if (existing.logoKey) await removeFile(existing.logoKey).catch(() => {});
  return NextResponse.json(entity);
}
