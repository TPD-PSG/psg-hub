// Call sheets (27 Nov 2026): who's booked on a day, the day's venue and schedule, who a sheet is
// emailed to, and marking a sheet changed so a sent one can go again as UPDATED.
import { prisma } from "./prisma";
import { byCallTime } from "./callSheetTimes.ts";
export { byCallTime, callMinutes } from "./callSheetTimes.ts";

const DAY = 86_400_000;
/** A sheet's day as [start, end): sheets are stored at midnight UTC of their date. */
export function dayRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return { start, end: new Date(start.getTime() + DAY) };
}

export type PersonRow = { discipline: string; name: string; role: string | null; crewId: number | null; userId: number | null };

/** Crew on the show whose dates cover the day (no dates = the whole run) and PSG staff assigned that day. */
export async function peopleForDay(productionId: number, date: Date): Promise<PersonRow[]> {
  const { start, end } = dayRange(date);
  const [crew, staff] = await Promise.all([
    prisma.productionCrew.findMany({
      where: { productionId, AND: [{ OR: [{ startDate: null }, { startDate: { lt: end } }] }, { OR: [{ endDate: null }, { endDate: { gte: start } }] }] },
      select: { role: true, crew: { select: { id: true, name: true, discipline: true } } },
      orderBy: { crew: { name: "asc" } },
    }),
    prisma.staffAssignment.findMany({
      where: { productionId, startDate: { lt: end }, endDate: { gte: start }, user: { deactivatedAt: null } },
      select: { activityType: true, user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  const rows: PersonRow[] = [];
  const seenCrew = new Set<number>(), seenUser = new Set<number>();
  for (const c of crew) {
    if (seenCrew.has(c.crew.id)) continue;
    seenCrew.add(c.crew.id);
    rows.push({ discipline: c.crew.discipline, name: c.crew.name, role: c.role, crewId: c.crew.id, userId: null });
  }
  for (const s of staff) {
    if (seenUser.has(s.user.id)) continue;
    seenUser.add(s.user.id);
    rows.push({ discipline: "PSG", name: s.user.name, role: s.activityType, crewId: null, userId: s.user.id });
  }
  return rows;
}

/** The venue for the day: the tour stop that covers it, else the show's own venue. */
export async function venueForDay(productionId: number, date: Date): Promise<string | null> {
  const { start, end } = dayRange(date);
  const stops = await prisma.tourStop.findMany({ where: { productionId }, select: { loadInDate: true, startDate: true, endDate: true, venue: { select: { name: true, city: true } } } });
  const stop = stops.find(s => {
    const from = s.loadInDate ?? s.startDate, to = s.endDate ?? s.startDate;
    return from && to && from < end && to >= start;
  });
  if (stop) return [stop.venue.name, stop.venue.city].filter(Boolean).join(", ");
  const p = await prisma.production.findUnique({ where: { id: productionId }, select: { venue: true, venueRef: { select: { name: true, city: true } } } });
  if (p?.venue?.trim()) return p.venue.trim(); // the show's typed venue wins, as elsewhere
  return p?.venueRef ? [p.venueRef.name, p.venueRef.city].filter(Boolean).join(", ") : null;
}

/** The show's schedule events that start on the day. */
export async function scheduleForDay(productionId: number, date: Date) {
  const { start, end } = dayRange(date);
  return prisma.event.findMany({ where: { productionId, startAt: { gte: start, lt: end } }, select: { id: true, title: true, type: true, startAt: true, endAt: true, location: true }, orderBy: { startAt: "asc" } });
}

export type Recipient = { entryId: number; name: string; email: string | null; callTime: string | null };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Who an emailing reaches: each row's own email, else its crew member's or PSG user's. One email per address. */
export async function recipientsFor(callSheetId: number): Promise<{ to: Recipient[]; noEmail: Recipient[] }> {
  const rows = await prisma.callSheetEntry.findMany({
    where: { callSheetId },
    select: { id: true, name: true, discipline: true, callTime: true, email: true, crew: { select: { email: true } }, user: { select: { email: true, deactivatedAt: true } } },
  });
  const to: Recipient[] = [], noEmail: Recipient[] = [];
  const seen = new Set<string>();
  for (const r of byCallTime(rows)) {
    const raw = (r.email || r.crew?.email || (r.user && !r.user.deactivatedAt ? r.user.email : "") || "").trim();
    const person = { entryId: r.id, name: r.name || r.discipline, callTime: r.callTime, email: EMAIL.test(raw) ? raw.toLowerCase() : null };
    if (!r.name) continue; // a department-wide row isn't a person
    if (!person.email) { noEmail.push(person); continue; }
    if (seen.has(person.email)) continue;
    seen.add(person.email);
    to.push(person);
  }
  return { to, noEmail };
}

/** Something on the sheet changed: a sheet already sent now shows "changed since sent". */
export function touchSheet(callSheetId: number) {
  return prisma.callSheet.update({ where: { id: callSheetId }, data: { changedAt: new Date() } });
}

// Rows come with whether there's an email to send to (never the address itself), so the tab
// can flag people who won't get the sheet.
export const ENTRY_SELECT = {
  id: true, discipline: true, name: true, role: true, callTime: true, notes: true, sortOrder: true, crewId: true, userId: true, email: true,
  crew: { select: { email: true } }, user: { select: { email: true } },
} as const;
type RawEntry = { id: number; discipline: string; name: string | null; role: string | null; callTime: string | null; notes: string | null; sortOrder: number; crewId: number | null; userId: number | null; email: string | null; crew: { email: string | null } | null; user: { email: string } | null };
export const shapeEntries = (rows: RawEntry[]) =>
  byCallTime(rows).map(({ crew, user, ...r }) => ({ ...r, linked: r.crewId ? "crew" : r.userId ? "psg" : null, hasEmail: !!(r.email || crew?.email || user?.email) }));
