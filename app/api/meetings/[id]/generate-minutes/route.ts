import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateText, ClaudeOutputError } from "@/lib/claude";
import { requireRecordAccess, requireProductionAccess } from "@/lib/access";
import { allowUse } from "@/lib/rate-limit";


// Write minutes from a transcript (Opus). PSG staff only, on a meeting (or, before it's saved, a
// production) they can open; transcripts capped; a few runs per person per hour (audit round 2).
const MAX_TRANSCRIPT = 200_000; // characters, about 50,000 words

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "member") return NextResponse.json({ error: "PSG staff only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { transcript, agenda, title, attendees, meetingDate } = body;
  const { id } = await params;
  const access = /^\d+$/.test(id) ? await requireRecordAccess("meeting", id) : await requireProductionAccess(Number(body.productionId) || 0, "meetings");
  if ("error" in access) return access.error;

  if (typeof transcript !== "string" || !transcript.trim()) {
    return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
  }
  if (transcript.length > MAX_TRANSCRIPT) return NextResponse.json({ error: "That transcript is too long to write minutes from in one go. Split it into parts." }, { status: 413 });
  if (!allowUse(`minutes:${user.id}`, 10, 3600e3)) return NextResponse.json({ error: "That's the limit for minutes this hour. Try again later." }, { status: 429 });

  const prompt = `You are helping write professional meeting minutes for a theatre production company.

Meeting: ${title}
Date: ${meetingDate ? new Date(meetingDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
Attendees: ${attendees || "Not specified"}
${agenda ? `\nAgenda:\n${agenda}` : ""}

Transcript:
${transcript}

Write concise, professional meeting minutes from this transcript. Structure them with:
- A brief summary of what was discussed
- Key decisions made (bullet points)
- Action items with who is responsible (if mentioned)
- Any other important points

Write in past tense. Be concise — capture what matters, not every word. Plain text only, no markdown symbols.`;

  let minutes: string;
  try {
    minutes = await generateText({
      feature: "minutes",
      model: "claude-opus-5-5",
      maxTokens: 16000, // room for thinking plus the minutes themselves
      effort: "medium",
      content: [{ type: "text", text: prompt }],
    });
  } catch (err) {
    const message = err instanceof ClaudeOutputError ? err.message : "Couldn't generate minutes";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  return NextResponse.json({ minutes });
}
