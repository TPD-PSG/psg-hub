import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parseShowReportPdf, type ParsedReport } from "@/lib/showReportParser";
import { ClaudeOutputError } from "@/lib/claude";
import { toDate } from "@/lib/parse";
import { saveFile } from "@/lib/storage";

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
  const callerRole = (session?.user as any)?.role;
  if (!isCron && callerRole !== "admin" && callerRole !== "member") {
    return NextResponse.json({ error: "Only PSG staff can run the report import" }, { status: 403 });
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
  const results: { subject: string; status: string; reportId?: number; production?: string; parsed?: ParsedReport[] }[] = [];
  // Railway ends requests at 60s. Stop starting new PDFs after 40s and parse a few at once;
  // anything left is reported as "deferred" and picked up by the next call.
  const started = Date.now();
  const TIME_BUDGET_MS = 40_000;
  const CONCURRENCY = 3;
  let deferred = 0;
  const inFlight = new Set<string>();

  const handle = async (msg: any): Promise<void> => {
    const dedupKey = `${msg.subject}||${msg.from?.emailAddress?.address ?? ""}`;

    if (importedKeys.has(dedupKey)) {
      results.push({ subject: msg.subject, status: "already_imported" });
      return;
    }

    // Skip reports for shows that aren't Hub productions before downloading anything.
    // (This used to apply only to backfill, so the scheduled import re-downloaded every
    // unrelated PDF in the inbox on every run.)
    if (!matchProduction(msg.subject, productions)) {
      results.push({ subject: msg.subject, status: "skipped_no_match" });
      return;
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
      return;
    }

    // Fetch attachment list (without contentBytes — avoid inline size limit)
    const attRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/messages/${msg.id}/attachments?$select=id,name,contentType,size`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!attRes.ok) {
      results.push({ subject: msg.subject, status: `attachment_error_${attRes.status}` });
      return;
    }
    const { value: attachments } = await attRes.json();

    // Every PDF on the email (some emails carry one report per attachment, e.g. matinee + evening)
    const pdfMetas: { id: string; name: string }[] = (attachments ?? []).filter((a: any) =>
      a.contentType === "application/pdf" ||
      (a.contentType === "application/octet-stream" && (a.name as string)?.toLowerCase().endsWith(".pdf"))
    );
    if (!pdfMetas.length) {
      results.push({ subject: msg.subject, status: "skipped_no_pdf" });
      return;
    }

    // Out of time for this request: leave it for the next batch (don't download what we won't parse)
    if (Date.now() - started > TIME_BUDGET_MS) {
      deferred++;
      results.push({ subject: msg.subject, status: "deferred" });
      return;
    }
    // Claim it so a parallel worker doesn't import a duplicate email twice
    if (inFlight.has(dedupKey)) { results.push({ subject: msg.subject, status: "already_imported" }); return; }
    inFlight.add(dedupKey);

    const productionId = matchProduction(msg.subject, productions);
    if (!productionId) {
      inFlight.delete(dedupKey);
      results.push({ subject: msg.subject, status: "skipped_no_match" });
      return;
    }
    const production = productions.find(p => p.id === productionId);

    // Download and read every attachment. Nothing is saved unless all of them succeed, so a
    // failure leaves the whole email in the inbox for the next run (no half-imported emails).
    let readPdfs: { name: string; base64: string; reports: ParsedReport[] }[];
    try {
      readPdfs = await Promise.all(pdfMetas.map(async meta => {
        // Download each attachment separately (handles any size)
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/users/${REPORTS_MAILBOX}/messages/${msg.id}/attachments/${meta.id}/$value`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`attachment_download_error_${res.status} (${meta.name})`);
        const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
        const reports = await parseShowReportPdf(base64, { subject: msg.subject, filename: meta.name, oneOfSeveral: pdfMetas.length > 1, receivedAt: msg.receivedDateTime });
        return { name: meta.name, base64, reports };
      }));
      console.log(`[ingest] parsed ${readPdfs.reduce((n, p) => n + p.reports.length, 0)} report(s) from ${readPdfs.length} attachment(s) in message ${msg.id}`);
    } catch (err) {
      inFlight.delete(dedupKey);
      results.push({ subject: msg.subject, status: err instanceof ClaudeOutputError ? `parse_error: ${err.message}` : `error: ${err instanceof Error ? err.message : "parse failed"}` });
      return;
    }

    // Store each PDF once (R2 if configured), shared by every report it contains; one DB record per report
    const parsedReports: ParsedReport[] = [];
    for (const pdf of readPdfs) {
      const stored = await saveFile("show-reports", pdf.name || `${msg.subject}.pdf`, Buffer.from(pdf.base64, "base64"), "application/pdf");
      for (const parsed of pdf.reports) {
        parsedReports.push(parsed);
        await prisma.showReport.create({
          data: {
            productionId: productionId,
            reportDate: toDate(parsed.reportDate) ?? new Date(msg.receivedDateTime),
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
            rawPdf: stored.base64,
            pdfKey: stored.key,
            productionMatched: productionId !== null,
          },
        });
      }
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
      ...(debug ? { parsed: parsedReports } : {}),
    });
  };

  const queue = [...messages];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const msg = queue.shift();
      try {
        await handle(msg);
      } catch (err) {
        // One bad email shouldn't stop the rest of the batch
        console.error(`[ingest] message ${msg?.id} failed:`, err instanceof Error ? err.message : err);
        results.push({ subject: msg?.subject, status: "error" });
      }
    }
  }));

  return NextResponse.json({ processed: results.length, deferred, results, graphErrors: graphErrors.length ? graphErrors : undefined });
}
