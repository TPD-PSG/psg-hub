import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sub = await prisma.funSubmission.findUnique({ where: { id: Number(id) } });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sub.authorId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (sub.roundupId) return NextResponse.json({ error: "Already published in a roundup" }, { status: 400 });

  await prisma.funSubmission.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
