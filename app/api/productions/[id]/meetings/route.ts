import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const meetings = await prisma.meeting.findMany({
    where: { productionId: Number(id) },
    orderBy: { meetingDate: "desc" },
    include: { createdByUser: { select: { id: true, name: true } } },
  });
  return NextResponse.json(meetings);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const userId = Number((session.user as any).id);
  const body = await req.json();
  const meeting = await prisma.meeting.create({
    data: {
      productionId: Number(id),
      title: body.title,
      meetingDate: new Date(body.meetingDate),
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
