// My work: the signed-in person's build parts in this space, and what they need for them
import { NextResponse } from "next/server";
import { myWork, myWorkViewer } from "@/lib/myWork";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const v = await myWorkViewer((await params).slug);
  if ("error" in v) return v.error;
  return NextResponse.json({ space: v.space, ...(await myWork(v)) });
}
