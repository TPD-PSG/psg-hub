import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";


export async function GET() {
  const links = await prisma.quickLink.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(links);
}

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const link = await prisma.quickLink.create({
    data: { label: body.label, url: body.url, icon: body.icon ?? "🔗", order: body.order ?? 0 },
  });
  return NextResponse.json(link);
}

export async function PUT(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const link = await prisma.quickLink.update({
    where: { id: body.id },
    data: { label: body.label, url: body.url, icon: body.icon, order: body.order },
  });
  return NextResponse.json(link);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  await prisma.quickLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
