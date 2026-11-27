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
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 30 * 86400e3);
  const [jobs, attention, ai] = await Promise.all([
    readJobStatus(prisma), readAttention(prisma),
    // AI use by feature over the last 30 days (audit round 2)
    prisma.aiUsage.groupBy({ by: ["feature"], where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true } }),
  ]);
  const aiUsage = ai.map(r => ({ feature: r.feature, calls: r._count._all, inputTokens: r._sum.inputTokens ?? 0, outputTokens: r._sum.outputTokens ?? 0, cacheReadTokens: r._sum.cacheReadTokens ?? 0 }))
    .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));
  return NextResponse.json({ checkedAt: new Date().toISOString(), jobs, attention, aiUsage });
}
