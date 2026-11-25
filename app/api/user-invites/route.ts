// Admin → Users: people invited who haven't set up their account yet (admins only)
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { openInvites } from "@/lib/invites";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await openInvites());
}
