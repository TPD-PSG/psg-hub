import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest, { params: _params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { transcript, agenda, title, attendees, meetingDate } = body;

  if (!transcript?.trim()) {
    return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
  }

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

  const message = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const minutes = (message.content[0] as { type: string; text: string }).text;
  return NextResponse.json({ minutes });
}
