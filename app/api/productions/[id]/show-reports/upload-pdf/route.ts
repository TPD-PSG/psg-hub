import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function parsePdfWithClaude(base64: string, filename: string): Promise<{
  reportDate: string | null;
  venue: string | null;
  performance: string | null;
  performanceNumber: number | null;
  attendance: number | null;
  houseCapacity: number | null;
  runningTime: string | null;
  playingTime: string | null;
  notes: string | null;
}> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as any,
          {
            type: "text",
            text: `This is a show report from a theatre production team. The filename is: "${filename}".

These reports are produced by stage managers after each performance. They follow a consistent structure including:
- Date, venue, performance number, show time (e.g. "Evening", "Matinee", "7:30pm Evening")
- House number (attendance), house capacity, house percentage
- Act timings: up/down times, playing time, running time
- Staff on duty
- Categorised notes: General, Sound, Lighting/LX, Video, Costume, Movement, SM Notes, Health & Safety, Audience Reactions, Maintenance, Injury/Illness, Cast/staff absent with covers

Extract the following fields and return ONLY valid JSON (no markdown, no explanation):
{
  "reportDate": "YYYY-MM-DD or null",
  "venue": "venue name only (not address) or null",
  "performance": "performance slot e.g. 'Evening – 7:30pm' or 'Matinee – 2:30pm' or null",
  "performanceNumber": number (the show/performance number e.g. 81, 56, 68) or null,
  "attendance": number (house number / audience count) or null,
  "houseCapacity": number (total capacity of the venue) or null,
  "runningTime": "total running time e.g. '2:24' or '1h 46m' or null",
  "playingTime": "total playing time (excluding interval) e.g. '2:03' or '1h 39m' or null",
  "notes": "structured summary — see format below"
}

For the notes field, produce a well-structured markdown summary preserving all important details. Use these sections (omit sections with no content):

**General**
[cast changes, covers, any general production notes]

**Technical – Sound**
[sound cue issues, operator errors, equipment problems]

**Technical – Lighting**
[LX cue issues, operator errors, spotlight issues]

**Technical – Video/Automation**
[video de-sync, automation issues]

**Audience & House**
[house number, audience reactions, standing ovation, any audience incidents]

**Health & Safety / Incidents**
[injuries, illnesses, audience medical incidents, show stops]

**Maintenance**
[equipment to fix, items to investigate]

**Covers & Absences**
[who was off, their role, who covered]

Include specific cue numbers, scene references, and direct quotes where present. Be concise but complete.`,
          },
        ],
      },
    ],
  });

  const text = ((message.content[0] as any).text ?? "").trim();
  try {
    return JSON.parse(text);
  } catch {
    return {
      reportDate: null, venue: null, performance: null, performanceNumber: null,
      attendance: null, houseCapacity: null, runningTime: null, playingTime: null,
      notes: text || null,
    };
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const productionId = parseInt(id);
  if (isNaN(productionId)) return NextResponse.json({ error: "Invalid production ID" }, { status: 400 });

  const production = await prisma.production.findUnique({ where: { id: productionId }, select: { id: true, name: true } });
  if (!production) return NextResponse.json({ error: "Production not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("pdf") as File | null;
  if (!file) return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const parsed = await parsePdfWithClaude(base64, file.name);

  const report = await prisma.showReport.create({
    data: {
      productionId,
      reportDate: parsed.reportDate ? new Date(parsed.reportDate) : new Date(),
      venue: parsed.venue,
      performance: parsed.performance,
      performanceNumber: parsed.performanceNumber,
      attendance: parsed.attendance,
      houseCapacity: parsed.houseCapacity,
      runningTime: parsed.runningTime,
      playingTime: parsed.playingTime,
      notes: parsed.notes,
      emailSubject: file.name,
      rawPdf: base64,
      productionMatched: true,
      createdByUserId: (session.user as any)?.id ?? null,
    },
  });

  return NextResponse.json({ reportId: report.id, parsed });
}
