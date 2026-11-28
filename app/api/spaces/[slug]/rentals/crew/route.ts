// The Rentals space's Crew page: the crew diary (jobs on this space's hires from today), and the
// crew directory with who's already booked on a chosen day (on any hire or production), and the
// space's crew rates.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInRentals, parseDay } from "@/lib/rentalAccess";
import { crewRatesFor } from "@/lib/crewRateAccess";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const date = parseDay(new URL(req.url).searchParams.get("date")) ?? today;
  const [jobs, crew, bookedThatDay, onProductions, rates] = await Promise.all([
    prisma.crewJob.findMany({
      where: { hire: { entityId: s.space.id }, date: { gte: today, lte: new Date(today.getTime() + 90 * 86_400_000) } },
      select: { id: true, role: true, date: true, callTime: true, endTime: true, places: true, location: true,
        hire: { select: { id: true, number: true, title: true, status: true } },
        offers: { select: { status: true, crew: { select: { id: true, name: true } } } } },
      orderBy: [{ date: "asc" }, { callTime: "asc" }],
    }),
    prisma.crew.findMany({ select: { id: true, name: true, discipline: true, phone: true, email: true, company: true, insuranceExpiry: true }, orderBy: { name: "asc" } }),
    prisma.crewOffer.findMany({ where: { status: "booked", job: { date } }, select: { crewId: true, job: { select: { role: true, hire: { select: { number: true } }, production: { select: { name: true } } } } } }),
    prisma.productionCrew.findMany({ where: { startDate: { lte: date }, OR: [{ endDate: { gte: date } }, { endDate: null, startDate: { gte: date } }] }, select: { crewId: true, role: true, production: { select: { name: true } } } }),
    crewRatesFor(s.space.id),
  ]);
  const busy = new Map<number, string[]>();
  for (const b of bookedThatDay) busy.set(b.crewId, [...(busy.get(b.crewId) ?? []), `${b.job.role} · ${b.job.hire?.number ?? b.job.production?.name ?? ""}`]);
  for (const p of onProductions) if (!bookedThatDay.some(b => b.crewId === p.crewId)) busy.set(p.crewId, [...(busy.get(p.crewId) ?? []), `${p.role ?? "Crew"} · ${p.production.name}`]);
  return NextResponse.json({
    space: s.space, date: date.toISOString().slice(0, 10),
    diary: jobs.map(j => ({ ...j, booked: j.offers.filter(o => o.status === "booked").map(o => o.crew), available: j.offers.filter(o => o.status === "available").length, offers: undefined })),
    crew: crew.map(c => ({ ...c, busy: busy.get(c.id) ?? [] })),
    rates,
  });
}
