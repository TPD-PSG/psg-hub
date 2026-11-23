import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REPORTS_MAILBOX = process.env.REPORTS_MAILBOX ?? "reports@production-solutions.group";

async function getGraphToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  if (!res.ok) throw new Error(`Graph token error: ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

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
    // Single object returned — wrap it
    return [parsed];
  } catch {
    return [{ ...EMPTY_REPORT, notes: text || null }];
  }
}

// Extract performance numbers from subjects like "Show Reports 55 and 56" or "Show Report #81"
function parsePerformanceNumbers(subject: string): number[] {
  const nums: number[] = [];
  // "Reports/Performances/Previews N and M" or "N & M"
  const multi = subject.match(/(?:reports?|performances?|previews?)\s+(?:\w+\s+)?(\d+)\s+(?:and|&)\s+(\d+)/i);
  if (multi) return [parseInt(multi[1]), parseInt(multi[2])];
  // "Report Performance 6" or "Report Preview 7" or "Report #81" or "Report 81"
  const single = subject.match(/(?:reports?|performances?|previews?)\s+(?:performance\s+|preview\s+)?#?(\d+)/i);
  if (single) nums.push(parseInt(single[1]));
  return nums;
}

// Extract venue from end of subject: "28.10.2026 York" → "York"
function parseVenueFromSubject(subject: string): string | null {
  const m = subject.match(/\d{2}[./-]\d{2}[./-]\d{4}\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Parse date formats like "28.10.2026"
function parseDateFromSubject(subject: string): string | null {
  const m = subject.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Fill in missing fields from the email subject when Claude returns nulls
function applySubjectFallbacks(reports: ParsedReport[], subject: string): ParsedReport[] {
  const nums = parsePerformanceNumbers(subject);
  const venue = parseVenueFromSubject(subject);
  const date = parseDateFromSubject(subject);

  if (nums.length > 1 && reports.length === 1 && !reports[0].performanceNumber) {
    // Combined PDF but Claude returned one record — split into one per performance number
    return nums.map(n => ({
      ...reports[0],
      performanceNumber: n,
      venue: reports[0].venue ?? venue,
      reportDate: reports[0].reportDate ?? date,
    }));
  }

  return reports.map((r, i) => ({
    ...r,
    performanceNumber: r.performanceNumber ?? (nums[i] ?? nums[0] ?? null),
    venue: r.venue ?? venue,
    reportDate: r.reportDate ?? date,
  }));
}

function matchProduction(subject: string, productions: { id: number; name: string }[]): number | null {
  const s = subject.toLowerCase();
  // Sort longest name first to prefer more specific matches
  const sorted = [...productions].sort((a, b) => b.name.length - a.name.length);
  // First pass: exact full name match
  for (const p of sorted) {
    if (s.includes(p.name.toLowerCase())) return p.id;
  }
  // Second pass: try each part split on " - " or " – " (e.g. "Curious Incident - UK Tour" → try "Curious Incident")
  for (const p of sorted) {
    const parts = p.name.split(/\s[–-]\s/);
    for (const part of parts) {
      if (part.length >= 5 && s.includes(part.toLowerCase())) return p.id;
    }
  }
  return null;
}

async function fetchAllMessages(token: string, url: string): Promise<{ messages: any[]; error?: string }> {
  const all: any[] = [];
  let next: string | null = url;
  while (next && all.length < 500) {
    const res: Response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const errText = await res.text();
      return { messages: all, error: `Graph ${res.status}: ${errText}` };
    }
    const data: any = await res.json();
    all.push(...(data.value ?? []));
    next = data["@odata.nextLink"] ?? null;
  }
  return { messages: all };
}

async function getOrCreateProcessedFolder(token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/mailFolders?$filter=displayName eq 'Processed'`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { value: folders } = await res.json();
    if (folders?.[0]?.id) return folders[0].id;
    const createRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/mailFolders`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Processed" }),
      }
    );
    return (await createRes.json()).id ?? null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("x-cron-secret");
  const isCron = cronSecret && authHeader === cronSecret;
  if (!session && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Microsoft Graph not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const backfill = url.searchParams.get("backfill") === "true";
  // Raw Claude output only for admins, never for the cron caller
  const debug = url.searchParams.get("debug") === "true" && (session?.user as any)?.role === "admin";

  const token = await getGraphToken();
  const productions = await prisma.production.findMany({ select: { id: true, name: true }, where: { archived: false } });

  // Build already-imported set to avoid duplicates (by emailSubject + emailFrom)
  const existing = await prisma.showReport.findMany({
    where: { emailSubject: { not: null } },
    select: { emailSubject: true, emailFrom: true },
  });
  const importedKeys = new Set(existing.map(r => `${r.emailSubject}||${r.emailFrom}`));

  // Collect messages to process
  let messages: any[] = [];
  const fields = "$select=id,subject,from,receivedDateTime,hasAttachments";

  const graphErrors: string[] = [];

  if (backfill) {
    const [inboxResult, processedFolderRes] = await Promise.all([
      fetchAllMessages(token, `https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/mailFolders/inbox/messages?${fields}&$top=50`),
      fetch(`https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/mailFolders?$filter=displayName eq 'Processed'`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (inboxResult.error) graphErrors.push(`inbox: ${inboxResult.error}`);
    messages.push(...inboxResult.messages);

    if (processedFolderRes.ok) {
      const { value: folders } = await processedFolderRes.json();
      if (folders?.[0]?.id) {
        const processedResult = await fetchAllMessages(token,
          `https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/mailFolders/${folders[0].id}/messages?${fields}&$top=50`
        );
        if (processedResult.error) graphErrors.push(`processed folder: ${processedResult.error}`);
        messages.push(...processedResult.messages);
      }
    } else {
      graphErrors.push(`folders list: Graph ${processedFolderRes.status}`);
    }
  } else {
    const msgsRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/mailFolders/inbox/messages?$filter=isRead eq false&$top=20&${fields}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!msgsRes.ok) {
      const errText = await msgsRes.text();
      return NextResponse.json({ error: `Graph messages error: ${errText}` }, { status: 502 });
    }
    messages = (await msgsRes.json()).value ?? [];
  }

  const processedFolderId = await getOrCreateProcessedFolder(token);
  const results: { subject: string; status: string; reportId?: number; production?: string; claudeRaw?: any }[] = [];
  const MAX_PER_RUN = 4; // keep well within Railway's 60s timeout (~10-15s per PDF)
  let pdfProcessed = 0;

  for (const msg of messages) {
    const dedupKey = `${msg.subject}||${msg.from?.emailAddress?.address ?? ""}`;

    if (importedKeys.has(dedupKey)) {
      results.push({ subject: msg.subject, status: "already_imported" });
      continue;
    }

    // During backfill, skip early if subject doesn't match any known production
    // (avoids burning the PDF-processing budget on unrelated shows)
    if (backfill) {
      const earlyMatch = matchProduction(msg.subject, productions);
      if (!earlyMatch) {
        results.push({ subject: msg.subject, status: "skipped_no_match" });
        continue;
      }
    }

    if (!msg.hasAttachments) {
      if (!backfill) {
        await fetch(`https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/messages/${msg.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        });
      }
      results.push({ subject: msg.subject, status: "skipped_no_attachment" });
      continue;
    }

    // Fetch attachment list (without contentBytes — avoid inline size limit)
    const attRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/messages/${msg.id}/attachments?$select=id,name,contentType,size`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!attRes.ok) {
      results.push({ subject: msg.subject, status: `attachment_error_${attRes.status}` });
      continue;
    }
    const { value: attachments } = await attRes.json();

    const pdfMeta = attachments?.find((a: any) =>
      a.contentType === "application/pdf" ||
      (a.contentType === "application/octet-stream" && (a.name as string)?.toLowerCase().endsWith(".pdf"))
    );
    if (!pdfMeta) {
      results.push({ subject: msg.subject, status: "skipped_no_pdf" });
      continue;
    }

    // Download the attachment content separately (handles any size)
    const pdfBytesRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/messages/${msg.id}/attachments/${pdfMeta.id}/$value`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!pdfBytesRes.ok) {
      results.push({ subject: msg.subject, status: `attachment_download_error_${pdfBytesRes.status}` });
      continue;
    }
    const pdfBuffer = await pdfBytesRes.arrayBuffer();
    const pdf = {
      contentBytes: Buffer.from(pdfBuffer).toString("base64"),
      name: pdfMeta.name,
    };

    if (pdfProcessed >= MAX_PER_RUN) {
      results.push({ subject: msg.subject, status: "deferred" });
      continue;
    }
    pdfProcessed++;

    const productionId = matchProduction(msg.subject, productions);
    if (!productionId) {
      results.push({ subject: msg.subject, status: "skipped_no_match" });
      continue;
    }
    const production = productions.find(p => p.id === productionId);

    let parsedReports: ParsedReport[];
    let claudeRaw: any;
    try {
      claudeRaw = await parsePdfWithClaude(pdf.contentBytes, msg.subject);
      parsedReports = applySubjectFallbacks(claudeRaw, msg.subject);
      console.log(`[ingest] parsed ${parsedReports.length} report(s) from message ${msg.id}`);
    } catch {
      results.push({ subject: msg.subject, status: "parse_error" });
      continue;
    }

    // Create one DB record per report found in the PDF
    for (const parsed of parsedReports) {
      await prisma.showReport.create({
        data: {
          productionId: productionId,
          reportDate: parsed.reportDate ? new Date(parsed.reportDate) : new Date(msg.receivedDateTime),
          venue: parsed.venue,
          performance: parsed.performance,
          performanceNumber: parsed.performanceNumber,
          attendance: parsed.attendance,
          houseCapacity: parsed.houseCapacity,
          runningTime: parsed.runningTime,
          playingTime: parsed.playingTime,
          notes: parsed.notes,
          emailSubject: msg.subject,
          emailFrom: msg.from?.emailAddress?.address ?? null,
          rawPdf: pdf.contentBytes,
          productionMatched: productionId !== null,
        },
      });
    }

    // Add to dedup set so we don't re-import within the same run
    importedKeys.add(dedupKey);

    // Move to Processed folder (non-fatal)
    if (processedFolderId) {
      try {
        await fetch(`https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/messages/${msg.id}/move`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ destinationId: processedFolderId }),
        });
      } catch { /* non-fatal */ }
    }

    results.push({
      subject: msg.subject,
      status: productionId ? "imported" : "imported_unmatched",
      production: production?.name,
      ...(debug ? { claudeRaw } : {}),
    });
  }

  return NextResponse.json({ processed: results.length, results, graphErrors: graphErrors.length ? graphErrors : undefined });
}
