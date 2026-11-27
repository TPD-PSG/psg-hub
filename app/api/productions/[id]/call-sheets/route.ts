import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { missingDates, toDate } from "@/lib/parse";
import { dayRange, peopleForDay, venueForDay, ENTRY_SELECT, shapeEntries } from "@/lib/callSheets";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "callsheets");
  if ("error" in access) return access.error;
  const productionId = Number(id);
  const [sheets, events] = await Promise.all([
    prisma.callSheet.findMany({
      where: { productionId },
      include: { entries: { select: ENTRY_SELECT }, sends: { orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true, isUpdate: true, recipients: true, failed: true, sentBy: { select: { name: true } } } } },
      orderBy: { date: "asc" },
    }),
    prisma.event.findMany({ where: { productionId }, select: { id: true, title: true, type: true, startAt: true, endAt: true, location: true }, orderBy: { startAt: "asc" } }),
  ]);
  return NextResponse.json(sheets.map(({ entries, sends, ...s }) => {
    const { start, end } = dayRange(s.date);
    const last = sends[0];
    return {
      ...s,
      entries: shapeEntries(entries),
      schedule: events.filter(e => e.startAt >= start && e.startAt < end),
      changedSinceSent: !!(s.sentAt && s.changedAt && s.changedAt > s.sentAt),
      lastSend: last ? { sentAt: last.sentAt, isUpdate: last.isUpdate, by: last.sentBy?.name ?? null, count: JSON.parse(last.recipients).length, failed: last.failed ? JSON.parse(last.failed).length : 0 } : null,
    };
  }));
}

// A new sheet fills in the crew and PSG staff booked that day (unless { fill: false }), and the
// day's venue when none is typed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "callsheets");
  if ("error" in access) return access.error;
  const body = await req.json().catch(() => ({}));
  const badDate = missingDates(body, ["date"]);
  if (badDate) return badDate;
  const productionId = Number(id);
  const date = toDate(body.date)!;
  const people = body.fill === false ? [] : await peopleForDay(productionId, date);
  const venue = (typeof body.venue === "string" && body.venue.trim()) || (await venueForDay(productionId, date));
  const sheet = await prisma.callSheet.create({
    data: {
      productionId,
      date,
      title: body.title || null,
      venue: venue || null,
      generalNotes: body.generalNotes || null,
      entries: { create: people.map((p, i) => ({ ...p, sortOrder: i })) },
    },
    include: { entries: true },
  });
  return NextResponse.json(sheet, { status: 201 });
}
