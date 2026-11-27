// The signed-in person's New look (beta) switch
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { newLookFor, setNewLook } from "@/lib/newLook";

export async function GET() {
  const session = await auth();
  const id = Number((session?.user as { id?: string } | undefined)?.id);
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ on: await newLookFor(id) });
}

export async function PUT(req: Request) {
  const session = await auth();
  const id = Number((session?.user as { id?: string } | undefined)?.id);
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.on !== "boolean") return NextResponse.json({ error: "Say on or off" }, { status: 400 });
  await setNewLook(id, body.on);
  return NextResponse.json({ on: body.on });
}
