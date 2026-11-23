import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { missingDates, toDate } from "@/lib/parse";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "meetings");
  if ("error" in access) return access.error;
  const meetings = await prisma.meeting.findMany({
    where: { productionId: Number(id) },
    orderBy: { meetingDate: "desc" },
    include: { createdByUser: { select: { id: true, name: true } } },
  });
  return NextResponse.json(meetings);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "meetings");
  if ("error" in access) return access.error;
  if (access.role !== "admin" && access.role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = access.userId;
  const body = await req.json();
  const badDate = missingDates(body, ["meetingDate"]);
  if (badDate) return badDate;
  const meeting = await prisma.meeting.create({
    data: {
      productionId: Number(id),
      title: body.title,
      meetingDate: toDate(body.meetingDate)!,
      location: body.location || null,
      attendees: body.attendees || null,
      agenda: body.agenda || null,
      minutes: body.minutes || null,
      createdByUserId: userId,
    },
    include: { createdByUser: { select: { id: true, name: true } } },
  });
  return NextResponse.json(meeting, { status: 201 });
}
