import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordingUrl } from "@/lib/transcript";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { toDate } from "@/lib/parse";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const rec = await requireRecordAccess("meeting", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const meeting = await prisma.meeting.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      meetingDate: toDate(body.meetingDate),
      location: body.location || null,
      attendees: body.attendees || null,
      agenda: body.agenda || null,
      minutes: body.minutes || null,
      transcript: typeof body.transcript === "string" && body.transcript.trim() ? body.transcript.trim().slice(0, 500_000) : null,
      recordingUrl: recordingUrl(body.recordingUrl),
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
