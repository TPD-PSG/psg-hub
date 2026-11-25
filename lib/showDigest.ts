// Load a production's show reports for a week (Mon–Sun) and build the digest (lib/showDigestCore).
import { prisma } from "@/lib/prisma";
import { buildDigest, mondayOf } from "@/lib/showDigestCore";

export async function weekDigest(productionId: number, week?: string | null) {
  const from = mondayOf(week);
  const to = new Date(from.getTime() + 7 * 86400e3);
  const reports = await prisma.showReport.findMany({
    where: { productionId, reportDate: { gte: from, lt: to } },
    select: { id: true, reportDate: true, performance: true, performanceNumber: true, venue: true, attendance: true, houseCapacity: true, runningTime: true, notes: true, flags: true },
  });
  return { week: from.toISOString().slice(0, 10), ...buildDigest(reports) };
}
