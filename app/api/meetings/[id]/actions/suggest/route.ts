// Suggest action items from a meeting's saved minutes (PSG staff with access to the meeting).
// Returns suggestions only; POST /api/meetings/[id]/actions saves the ones a person accepts.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { extractJson, ClaudeOutputError } from "@/lib/claude";
import { ACTIONS_SCHEMA, actionsPrompt, cleanActions } from "@/lib/meetingActions";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "PSG staff only" }, { status: 403 });
  const { id } = await params;
  const rec = await requireRecordAccess("meeting", id);
  if ("error" in rec) return rec.error;

  const meeting = await prisma.meeting.findUnique({
    where: { id: Number(id) },
    select: { title: true, meetingDate: true, minutes: true, production: { select: { name: true } }, tasks: { select: { title: true } } },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!meeting.minutes?.trim()) return NextResponse.json({ error: "Save the minutes first" }, { status: 400 });

  // Owners can be any PSG staff member or anyone on this show's team
  const people = await prisma.user.findMany({
    where: { OR: [{ role: { in: ["admin", "member"] } }, { productionTeams: { some: { production: { meetings: { some: { id: Number(id) } } } } } }] },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let raw: { actions: Parameters<typeof cleanActions>[0] };
  try {
    raw = await extractJson({
      feature: "meeting-actions",
      model: "claude-opus-5-5",
      effort: "low",
      maxTokens: 8000,
      schema: ACTIONS_SCHEMA as unknown as Record<string, unknown>,
      content: [{ type: "text", text: actionsPrompt({ title: meeting.title, meetingDate: meeting.meetingDate, production: meeting.production.name, minutes: meeting.minutes }, people) }],
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof ClaudeOutputError ? err.message : "Couldn't read the minutes" }, { status: 502 });
  }
  return NextResponse.json({ actions: cleanActions(raw.actions ?? [], people, meeting.tasks.map(t => t.title)), people });
}
