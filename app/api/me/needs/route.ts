// The signed-in person's hidden "Needs you" items on Home. PUT { key, version } hides one (it comes
// back if it changes); PUT { key, version: null } shows it again; DELETE shows everything again.
// Hiding never approves, completes or changes the thing itself.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setHiddenNeeds, NEED_KEY } from "@/lib/newLook";

async function me() {
  const session = await auth();
  return Number((session?.user as { id?: string } | undefined)?.id) || null;
}

export async function PUT(req: Request) {
  const id = await me();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.key !== "string" || !NEED_KEY.test(b.key)) return NextResponse.json({ error: "Which item?" }, { status: 400 });
  if (b.version !== null && (typeof b.version !== "string" || !b.version || b.version.length > 60)) return NextResponse.json({ error: "Which version of it?" }, { status: 400 });
  await setHiddenNeeds(id, { [b.key]: b.version });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const id = await me();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await setHiddenNeeds(id, null);
  return NextResponse.json({ ok: true });
}
