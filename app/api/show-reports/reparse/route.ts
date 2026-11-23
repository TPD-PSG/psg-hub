import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ParsedReport = {
  reportDate: string | null;
  venue: string | null;
  performance: string | null;
  performanceNumber: number | null;
  attendance: number | null;
  houseCapacity: number | null;
  runningTime: string | null;
  playingTime: string | null;
  notes: string | null;
};

const EMPTY_REPORT: ParsedReport = {
  reportDate: null, venue: null, performance: null, performanceNumber: null,
  attendance: null, houseCapacity: null, runningTime: null, playingTime: null, notes: null,
};

async function parsePdfWithClaude(base64: string, subject: string): Promise<ParsedReport[]> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 4096,
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
            text: `This is a show report (or combined show reports) from a theatre production team. The email subject was: "${subject}".

These reports are produced by stage managers after each performance. They follow a consistent structure including:
- Date, venue, performance number, show time (e.g. "Evening", "Matinee", "7:30pm Evening")
- House number (attendance), house capacity, house percentage
- Act timings: house open, FOH clearance, act up/down times with durations, interval times, playing time, running time
- Staff on duty
- Categorised notes: General, Sound, Lighting/LX, Video, Costume, Movement, SM Notes, Health & Safety, Audience Reactions, Maintenance, Injury/Illness, Cast/staff absent with covers

IMPORTANT: This PDF may contain multiple show reports (e.g. a matinee and an evening performance). Extract EACH report as a separate object.

Return ONLY a valid JSON array (no markdown, no explanation). Each element represents one performance:
[
  {
    "reportDate": "YYYY-MM-DD or null",
    "venue": "venue name only (not address) or null",
    "performance": "performance slot e.g. 'Evening – 7:30pm' or 'Matinee – 2:30pm' or null",
    "performanceNumber": number (the show/performance number e.g. 81, 56, 68) or null,
    "attendance": number (house number / audience count) or null,
    "houseCapacity": number (total capacity of the venue) or null,
    "runningTime": "total running time including interval e.g. '2:24' or null",
    "playingTime": "total playing time excluding interval e.g. '2:03' or null",
    "notes": "structured summary — see format below"
  }
]

For the notes field of each report, produce a well-structured markdown summary. Use EXACTLY this format — each section heading on its own line followed immediately by the content (no blank lines or separator lines between the heading and content):

**Timings**
House open: HH:MM  FOH clearance: HH:MM
Act 1: HH:MM – HH:MM (duration)
Interval: HH:MM – HH:MM (duration)
Act 2: HH:MM – HH:MM (duration)

**General**
[cast changes, covers, any general production notes — do NOT include timings here]

**Technical – Sound**
[sound cue issues, operator errors, equipment problems]

**Technical – Lighting**
[LX cue issues, operator errors, spotlight issues]

**Technical – Video/Automation**
[video de-sync, automation issues]

**Audience & House**
[audience reactions, standing ovation, any audience incidents]

**Health & Safety / Incidents**
[injuries, illnesses, audience medical incidents, show stops]

**Maintenance**
[equipment to fix, items to investigate]

**Covers & Absences**
[who was off, their role, who covered]

Omit sections with no content. Include specific cue numbers and scene references where present. Be concise but complete.`,
          },
        ],
      },
    ],
  });

  const text = ((message.content[0] as any).text ?? "").trim();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [EMPTY_REPORT];
    return [parsed];
  } catch {
    return [{ ...EMPTY_REPORT, notes: text || null }];
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("x-cron-secret");
  const isCron = cronSecret && authHeader === cronSecret;
  if (!session && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const MAX_PER_RUN = 4;

  // Find records that have a stored PDF but no attendance data (incomplete parse)
  const incomplete = await prisma.showReport.findMany({
    where: {
      rawPdf: { not: null },
      attendance: null,
    },
    select: {
      id: true,
      emailSubject: true,
      performanceNumber: true,
      venue: true,
      reportDate: true,
      rawPdf: true,
    },
    orderBy: { id: "asc" },
    take: MAX_PER_RUN,
  });

  if (incomplete.length === 0) {
    return NextResponse.json({ message: "Nothing to reparse", reparsed: 0 });
  }

  const results: { id: number; subject: string | null; status: string; parsed?: any }[] = [];

  for (const record of incomplete) {
    try {
      const parsed = await parsePdfWithClaude(record.rawPdf!, record.emailSubject ?? "");
      console.log(`[reparse] id=${record.id} parsed ${parsed.length} report(s)`);

      // Pick the parsed entry that matches this record's performance number, or first
      const match = parsed.find(p => p.performanceNumber === record.performanceNumber) ?? parsed[0];

      if (!match || (!match.attendance && !match.notes)) {
        results.push({ id: record.id, subject: record.emailSubject, status: "still_empty", parsed: match });
        continue;
      }

      await prisma.showReport.update({
        where: { id: record.id },
        data: {
          attendance: match.attendance ?? undefined,
          houseCapacity: match.houseCapacity ?? undefined,
          performance: match.performance ?? undefined,
          runningTime: match.runningTime ?? undefined,
          playingTime: match.playingTime ?? undefined,
          notes: match.notes ?? undefined,
          // Only overwrite venue/date if currently null
          venue: record.venue ?? match.venue ?? undefined,
          reportDate: record.reportDate ?? (match.reportDate ? new Date(match.reportDate) : undefined),
        },
      });

      results.push({ id: record.id, subject: record.emailSubject, status: "updated", parsed: match });
    } catch (err: any) {
      results.push({ id: record.id, subject: record.emailSubject, status: `error: ${err?.message}` });
    }
  }

  const remaining = await prisma.showReport.count({
    where: { rawPdf: { not: null }, attendance: null },
  });

  return NextResponse.json({ reparsed: results.length, remaining, results });
}
