import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : null;
  const role = (session?.user as any)?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const id = Number((await params).id);
  const sub = await prisma.funSubmission.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Admins can delete any submission; authors can delete their own (if not in a roundup)
  if (role !== "admin" && (sub.authorId !== userId || sub.roundupId !== null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.funSubmission.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number((await params).id);
  const { approved } = await req.json();

  const sub = await prisma.funSubmission.update({ where: { id }, data: { approved } });
  return NextResponse.json(sub);
}
