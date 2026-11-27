import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { INTERNAL_SETTING_PREFIXES } from "@/lib/importAttention";


export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Internal keys (job status, alerts, the import's email list) are served elsewhere, admins only
  const settings = (await prisma.setting.findMany()).filter(s => !INTERNAL_SETTING_PREFIXES.some(p => s.key.startsWith(p)));
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return NextResponse.json(map);
}

export async function PUT(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { key, value } = body;
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const setting = await prisma.setting.upsert({
    where: { key },
    update: { value: value ?? "" },
    create: { key, value: value ?? "" },
  });
  return NextResponse.json(setting);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { key } = await req.json().catch(() => ({}));
  await prisma.setting.deleteMany({ where: { key } });
  return NextResponse.json({ ok: true });
}
