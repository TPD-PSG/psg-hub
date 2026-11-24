import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readJobStatus } from "@/lib/job-status";
import { readAttention } from "@/lib/importAttention";

export const dynamic = "force-dynamic";

// Hub Settings status panel: when each background job last ran and how it went, plus report
// emails the import couldn't use. Admins only.
export async function GET() {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [jobs, attention] = await Promise.all([readJobStatus(prisma), readAttention(prisma)]);
  return NextResponse.json({ checkedAt: new Date().toISOString(), jobs, attention });
}
