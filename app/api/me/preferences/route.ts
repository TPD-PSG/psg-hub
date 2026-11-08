import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const prefs = user.preferences ? JSON.parse(user.preferences) : null;
  return NextResponse.json(prefs ?? {});
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  await prisma.user.update({
    where: { email: session.user.email },
    data: { preferences: JSON.stringify(data) },
  });
  return NextResponse.json({ ok: true });
}
