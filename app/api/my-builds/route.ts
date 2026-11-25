// A client's builds and drawings to sign off
import { NextResponse } from "next/server";
import { clientViewer, clientBuilds } from "@/lib/clientPortal";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  return NextResponse.json({ me: { name: v.name, company: v.clientName }, builds: await clientBuilds(v.clientId) });
}
