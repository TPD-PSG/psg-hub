// Admins turn the New look (beta) on or off for anyone (for the first week's testers)
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setNewLook } from "@/lib/newLook";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.on !== "boolean") return NextResponse.json({ error: "Say on or off" }, { status: 400 });
  if (!(await setNewLook(Number((await params).id) || 0, body.on))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ on: body.on });
}
