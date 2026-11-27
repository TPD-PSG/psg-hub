import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("productionLink", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { title: "The title can't be blank", url: "The web address can't be blank" });
  if (blank) return blank;
  const link = await prisma.productionLink.update({
    where: { id: Number(id) },
    data: { title: body.title, url: body.url, description: body.description || null },
  });
  return NextResponse.json(link);
}

export async function DELETE(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("productionLink", id);
  if ("error" in rec) return rec.error;
  await prisma.productionLink.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
