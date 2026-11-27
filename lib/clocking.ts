// Tablet mode clocking (27 Nov 2026). Clock on to a build; clocking off (or onto another build)
// turns the time into a day entry on that build, rounded to the nearest half day (at least half
// a day), with the times in its note. Under 15 minutes is treated as a mistake and not logged.
import { prisma } from "@/lib/prisma";

export const HOURS_PER_DAY = 8;
export const daysFor = (ms: number) => Math.max(0.5, Math.round((ms / 3600e3 / HOURS_PER_DAY) * 2) / 2);
const hm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** Close someone's open clock entry, logging the time. Returns what was logged, if anything. */
export async function clockOff(userId: number, at = new Date()) {
  const open = await prisma.clockEntry.findFirst({ where: { userId, endAt: null }, orderBy: { startAt: "desc" } });
  if (!open) return null;
  const ms = at.getTime() - open.startAt.getTime();
  if (ms < 15 * 60e3) { await prisma.clockEntry.deleteMany({ where: { id: open.id, endAt: null } }); return { days: 0, jobId: open.jobId }; }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { costDayRate: true } });
  const days = daysFor(ms);
  const hours = Math.round((ms / 3600e3) * 10) / 10;
  // Close the entry first, only if it's still open, then log the day, all in one transaction: two
  // taps at once can't log the same time twice (audit round 2)
  const logged = await prisma.$transaction(async tx => {
    const closed = await tx.clockEntry.updateMany({ where: { id: open.id, endAt: null }, data: { endAt: at } });
    if (!closed.count) return false;
    const entry = await tx.timeEntry.create({
      data: { jobId: open.jobId, userId, date: new Date(Date.UTC(open.startAt.getUTCFullYear(), open.startAt.getUTCMonth(), open.startAt.getUTCDate())), days, dayRate: user?.costDayRate ?? null, note: `Clocked ${hm(open.startAt)}–${hm(at)} (${hours} h)` },
    });
    await tx.clockEntry.update({ where: { id: open.id }, data: { timeEntryId: entry.id } });
    return true;
  });
  return logged ? { days, jobId: open.jobId } : null;
}
