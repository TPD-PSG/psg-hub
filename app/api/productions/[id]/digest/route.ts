// A show's weekly show-report digest (?week=YYYY-MM-DD, any day in the week; default this week).
import { NextResponse } from "next/server";
import { requireProductionAccess } from "@/lib/access";
import { weekDigest } from "@/lib/showDigest";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "reports");
  if ("error" in access) return access.error;
  return NextResponse.json(await weekDigest(Number(id), new URL(req.url).searchParams.get("week")));
}
