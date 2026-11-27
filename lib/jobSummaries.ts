// One-line summaries of background job runs for the Hub Settings status panel (lib/job-status.js).

type ImportBody = { error?: string; results?: { status: string }[]; graphErrors?: string[] } | null;
type DailyBody = { error?: string; created?: number; failed?: string[] } | null;
type BackupBody = { error?: string; sizeMB?: number | string; backupsRetained?: number } | null;

/** "20 emails: 2 imported, 18 skipped" — failing only when the mailbox couldn't be read. */
export function summariseImport(res: Response, body: ImportBody): { ok: boolean; summary: string } {
  if (!res.ok) return { ok: false, summary: body?.error ?? `HTTP ${res.status}` };
  const results: { status: string }[] = body?.results ?? [];
  const count = (test: (s: string) => boolean) => results.filter(r => test(r.status)).length;
  const imported = count(s => s.startsWith("imported"));
  const unmatched = count(s => s === "imported_unmatched");
  const errors = count(s => s === "error" || s.startsWith("parse_error") || s.startsWith("error") || s.startsWith("attachment_error"));
  const deferred = count(s => s === "deferred");
  const noShow = count(s => s === "skipped_no_match");
  const skipped = results.length - imported - errors - deferred - noShow;
  const parts = [
    imported && `${imported} imported${unmatched ? ` (${unmatched} not matched to a show)` : ""}`,
    noShow && `${noShow} not for a show in the Hub`,
    skipped && `${skipped} already done or not reports`,
    deferred && `${deferred} left for the next run`,
    errors && `${errors} couldn't be read`,
  ].filter(Boolean);
  const graph = body?.graphErrors?.length ? `Mailbox error: ${body.graphErrors[0]}` : "";
  const summary = results.length ? `${results.length} email${results.length === 1 ? "" : "s"}: ${parts.join(", ")}` : "No new emails";
  return { ok: !graph, summary: graph ? `${graph}. ${summary}` : summary };
}

export function summariseDaily(res: Response, body: DailyBody): { ok: boolean; summary: string } {
  if (!res.ok) return { ok: false, summary: body?.error ?? `HTTP ${res.status}` };
  const made = `${body?.created ?? 0} notification${body?.created === 1 ? "" : "s"} created`;
  // A section that failed (the rest still ran) marks the run as failed, naming it
  if (Array.isArray(body?.failed) && body.failed.length) return { ok: false, summary: `${made}; failed: ${body.failed.join(", ")}` };
  return { ok: true, summary: made };
}

export function summariseBackup(res: Response, body: BackupBody): { ok: boolean; summary: string } {
  if (!res.ok) return { ok: false, summary: body?.error ?? `HTTP ${res.status}` };
  return { ok: true, summary: `${body?.sizeMB ?? "?"} MB saved, ${body?.backupsRetained ?? "?"} daily copies kept` };
}
