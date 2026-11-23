// One parser for show-report PDFs, shared by email import, re-parse and manual upload
// (these used to carry three slightly different copies of the prompt).
import { extractJson, pdfBlock, nullable, objectSchema } from "@/lib/claude";

export type ParsedReport = {
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

export const REPORT_SCHEMA = objectSchema({
  reports: {
    type: "array",
    description: "One entry per performance in the PDF",
    items: objectSchema({
      reportDate: nullable("string", "YYYY-MM-DD"),
      venue: nullable("string", "Venue name only, not the address"),
      performance: nullable("string", "Performance slot, e.g. 'Evening – 7:30pm' or 'Matinee – 2:30pm'"),
      performanceNumber: nullable("integer", "The show/performance number, e.g. 81"),
      attendance: nullable("integer", "House number / audience count"),
      houseCapacity: nullable("integer", "Total capacity of the venue"),
      runningTime: nullable("string", "Total running time including interval, e.g. '2:24'"),
      playingTime: nullable("string", "Total playing time excluding interval, e.g. '2:03'"),
      notes: nullable("string", "Markdown summary in the format given in the instructions"),
    }),
  },
});

export const PROMPT = (hint: string) => `This PDF is one or more show reports from a theatre production team. ${hint}

Stage managers write these after each performance. They usually include: date, venue, performance number and slot; house number, capacity and percentage; act timings (house open, FOH clearance, act up/down, interval, playing and running time); staff on duty; and notes by department (general, sound, lighting, video, costume, movement, SM, health & safety, audience, maintenance, injury/illness, absences and covers).

The PDF may hold several performances (e.g. a matinee and an evening). Return each as its own entry in "reports". Use null for anything the report doesn't state.

For each report's notes, write a markdown summary in exactly this format, with each heading on its own line and its content directly underneath:

**Timings**
House open: HH:MM  FOH clearance: HH:MM
Act 1: HH:MM – HH:MM (duration)
Interval: HH:MM – HH:MM (duration)
Act 2: HH:MM – HH:MM (duration)

**General**
[cast changes, covers, general production notes; no timings here]

**Technical – Sound**
**Technical – Lighting**
**Technical – Video/Automation**
**Audience & House**
**Health & Safety / Incidents**
[injuries, illnesses, audience medical incidents, show stops]
**Maintenance**
**Covers & Absences**
[who was off, their role, who covered]

Leave out sections with nothing in them. Keep cue numbers and scene references. Be concise but complete.`;

/** Parse a show-report PDF. `hint` is where it came from, e.g. the email subject or filename. */
/**
 * `oneOfSeveral`: this PDF is one of several attachments on the same email. Then performance
 * numbers come only from this file (its contents or its name), never from the email subject, and
 * the subject-based split doesn't apply, so two attachments can't both become report #55.
 */
export async function parseShowReportPdf(base64: string, hint: { subject?: string; filename?: string; oneOfSeveral?: boolean; receivedAt?: string | Date }): Promise<ParsedReport[]> {
  const ref = hint.receivedAt ? new Date(hint.receivedAt) : new Date();
  const source = [
    hint.subject ? `The email subject was: "${hint.subject}".` : "",
    hint.filename ? `${hint.oneOfSeveral ? "This PDF is one of several attached to that email; its" : "The"} filename is: "${hint.filename}".` : "",
  ].filter(Boolean).join(" ");
  const { reports } = await extractJson<{ reports: ParsedReport[] }>({
    model: "claude-sonnet-5-5",
    content: [pdfBlock(base64), { type: "text", text: PROMPT(source) + `\n\nToday is ${ref.toISOString().slice(0, 10)} (${ref.toLocaleDateString("en-GB", { weekday: "long" })}). Reports often give a date without a year: use the weekday to choose the year, and never a date more than a week after today.` }],
    schema: REPORT_SCHEMA,
  });
  let out: ParsedReport[];
  if (hint.oneOfSeveral) {
    // Numbers from this file's name only; venue and date can still come from the subject
    const fromFile = applyHintFallbacks(reports, hint.filename ?? "", { split: false });
    out = applyHintFallbacks(fromFile, hint.subject ?? "", { split: false, numbers: false });
  } else {
    out = applyHintFallbacks(reports, hint.subject ?? hint.filename ?? "");
  }
  return out.map(r => ({ ...r, reportDate: fixYear(r.reportDate, ref) }));
}

/**
 * Reports often say "Sunday 22nd November" with no year, and the model can pick the wrong one.
 * Move the date to whichever year (one either side) is closest to when the report arrived,
 * without going more than a week past it.
 */
export function fixYear(date: string | null, ref: Date): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [y, m, d] = date.split("-").map(Number);
  const limit = ref.getTime() + 7 * 864e5;
  const candidates = [y - 1, y, y + 1]
    .map(year => new Date(Date.UTC(year, m - 1, d)))
    .filter(c => c.getUTCMonth() === m - 1 && c.getTime() <= limit); // drop 29 Feb in non-leap years
  if (!candidates.length) return date;
  const best = candidates.reduce((a, b) => (Math.abs(b.getTime() - ref.getTime()) < Math.abs(a.getTime() - ref.getTime()) ? b : a));
  return best.toISOString().slice(0, 10);
}

// ── Fill gaps from the email subject / filename, e.g. "Show Reports 55 and 56 – 28.10.2026 York" ──

function parsePerformanceNumbers(subject: string): number[] {
  const multi = subject.match(/(?:reports?|performances?|previews?)\s+(?:\w+\s+)?(\d+)\s+(?:and|&)\s+(\d+)/i);
  if (multi) return [parseInt(multi[1]), parseInt(multi[2])];
  const single = subject.match(/(?:reports?|performances?|previews?)\s+(?:performance\s+|preview\s+)?#?(\d+)/i);
  return single ? [parseInt(single[1])] : [];
}

function parseVenue(subject: string): string | null {
  const m = subject.match(/\d{2}[./-]\d{2}[./-]\d{4}\s+(.+?)(?:\.pdf)?$/i);
  return m ? m[1].trim() : null;
}

function parseDate(subject: string): string | null {
  const m = subject.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function applyHintFallbacks(reports: ParsedReport[], subject: string, opts: { split?: boolean; numbers?: boolean } = {}): ParsedReport[] {
  const nums = opts.numbers === false ? [] : parsePerformanceNumbers(subject);
  const venue = parseVenue(subject);
  const date = parseDate(subject);
  if (!reports.length) reports = [emptyReport()];

  // Combined PDF but only one report came back: split it by the numbers in the subject
  if (opts.split !== false && nums.length > 1 && reports.length === 1 && !reports[0].performanceNumber) {
    return nums.map(n => ({ ...reports[0], performanceNumber: n, venue: reports[0].venue ?? venue, reportDate: reports[0].reportDate ?? date }));
  }
  return reports.map((r, i) => ({
    ...r,
    performanceNumber: r.performanceNumber ?? nums[i] ?? nums[0] ?? null,
    venue: r.venue ?? venue,
    reportDate: r.reportDate ?? date,
  }));
}

export function emptyReport(): ParsedReport {
  return { reportDate: null, venue: null, performance: null, performanceNumber: null, attendance: null, houseCapacity: null, runningTime: null, playingTime: null, notes: null };
}
