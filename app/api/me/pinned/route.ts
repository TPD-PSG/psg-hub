// The signed-in person's pinned shortcuts on the new look's Home (six menu pages; null = the defaults)
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setPins } from "@/lib/newLook";

export async function PUT(req: Request) {
  const session = await auth();
  const id = Number((session?.user as { id?: string } | undefined)?.id);
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.hrefs === null) { await setPins(id, null); return NextResponse.json({ hrefs: null }); }
  // Only the Hub's own pages (a path starting with one slash), at most six
  if (!Array.isArray(body.hrefs) || body.hrefs.length > 6 || !body.hrefs.every((h: unknown) => typeof h === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(h) && h.length < 120)) {
    return NextResponse.json({ error: "Up to six of the Hub's own pages" }, { status: 400 });
  }
  await setPins(id, body.hrefs);
  return NextResponse.json({ hrefs: body.hrefs });
}
