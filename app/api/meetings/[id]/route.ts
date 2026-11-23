import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const rec = await requireRecordAccess("meeting", id);
  if ("error" in rec) return rec.error;
  const body = await req.json();
  const meeting = await prisma.meeting.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      meetingDate: new Date(body.meetingDate),
      location: body.location || null,
      attendees: body.attendees || null,
      agenda: body.agenda || null,
      minutes: body.minutes || null,
    },
    include: { createdByUser: { select: { id: true, name: true } } },
  });
  return NextResponse.json(meeting);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const rec = await requireRecordAccess("meeting", id);
  if ("error" in rec) return rec.error;
  await prisma.meeting.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
