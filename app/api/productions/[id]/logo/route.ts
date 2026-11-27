import { NextResponse } from "next/server";
import { requireProductionAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const LOGO_DIR = process.env.NODE_ENV === "production"
  ? "/data/production-logos"
  : join(process.cwd(), "public", "production-logos");

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const productionId = Number(id);

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  const file = formData.get("logo") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const filename = `${productionId}.${ext}`;
  await mkdir(LOGO_DIR, { recursive: true });
  await writeFile(join(LOGO_DIR, filename), Buffer.from(bytes));

  const logoUrl = `/api/production-logos/${filename}`;
  await prisma.production.update({ where: { id: productionId }, data: { logoUrl } });

  return NextResponse.json({ logoUrl });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  await prisma.production.update({ where: { id: Number(id) }, data: { logoUrl: null } });
  return NextResponse.json({ ok: true });
}
