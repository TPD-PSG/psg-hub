"use client";

import { useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { F, Btns, inp, inpStyle, fmtDate, pickFiles, sendJson, toggled, useList, type TabProps } from "../shared";

export default function ReportsTab({ prod }: TabProps) {
  const id = String(prod.id);
  type ShowReport = { id: number; reportDate: string; venue: string | null; performance: string | null; performanceNumber: number | null; attendance: number | null; houseCapacity: number | null; runningTime: string | null; playingTime: string | null; notes: string | null; flags: string | null; emailSubject: string | null; productionMatched: boolean; rawPdf: boolean | null; createdByUser: { id: number; name: string } | null };
  const [showReports, setShowReports, reloadReports] = useList<ShowReport>(`/api/productions/${id}/show-reports`);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editReport, setEditReport] = useState<ShowReport | null>(null);
  const [importingReports, setImportingReports] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Set<number>>(new Set());
  const [uploadingPdfs, setUploadingPdfs] = useState(false);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<string | null>(null);
  const BLANK_REPORT = { reportDate: "", venue: "", performance: "", attendance: "", notes: "" };
  const [reportForm, setReportForm] = useState(BLANK_REPORT);

  // Shows a status line, then clears it after `ms`
  function flashPdfStatus(msg: string, ms: number) { setPdfUploadStatus(msg); setTimeout(() => setPdfUploadStatus(null), ms); }
  function flashImportStatus(msg: string, ms: number) { setImportStatus(msg); setTimeout(() => setImportStatus(null), ms); }

  // Runs a server-side import/re-parse loop with a live status line, then refreshes the list
  async function runImport(startMsg: string, work: () => Promise<string>) {
    setImportingReports(true);
    setImportStatus(startMsg);
    try {
      const doneMsg = await work();
      await reloadReports();
      flashImportStatus(doneMsg, 5000);
    } catch (e: any) {
      flashImportStatus(`Error: ${e.message}`, 8000);
    } finally {
      setImportingReports(false);
    }
  }

  async function importFromEmail() {
    const backfill = await confirmDialog("Import all historical emails, including ones already read?\n\nOr just new unread reports.", { confirmLabel: "All emails", cancelLabel: "New only" });
    await runImport(backfill ? "Checking inbox & Processed folder…" : "Checking inbox for new reports…", async () => {
      let totalImported = 0;
      let batch = 0;
      while (true) {
        batch++;
        setImportStatus(`Batch ${batch}: parsing PDFs with AI…`);
        const url = `/api/show-reports/ingest${backfill ? "?backfill=true" : ""}`;
        const res = await fetch(url, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        const imported = data.results?.filter((r: any) => r.status.startsWith("imported")).length ?? 0;
        totalImported += imported;
        setImportStatus(`Batch ${batch} done — ${totalImported} imported so far…`);
        // Keep going while the server had to leave reports for the next batch
        // (or, when backfilling, while each batch still finds new ones)
        if (batch >= 50) break; // safety stop
        if ((data.deferred ?? 0) > 0) continue;
        if (imported === 0 || !backfill) break;
      }
      return `✓ Done — ${totalImported} report(s) imported`;
    });
  }

  async function reparseEmpty() {
    await runImport("Re-parsing incomplete records…", async () => {
      let total = 0;
      while (true) {
        const res = await fetch("/api/show-reports/reparse", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        total += data.reparsed ?? 0;
        setImportStatus(`Re-parsed ${total} so far… (${data.remaining} remaining)`);
        if (!data.remaining || data.remaining === 0) break;
      }
      return `✓ Done — ${total} record(s) updated`;
    });
  }

  async function saveReport(e: React.FormEvent) {
    e.preventDefault();
    if (editReport) {
      await sendJson(`/api/show-reports/${editReport.id}`, "PUT", reportForm);
    } else {
      await sendJson(`/api/productions/${id}/show-reports`, "POST", reportForm);
    }
    setShowReportForm(false);
    setEditReport(null);
    setReportForm(BLANK_REPORT);
    reloadReports();
  }

  async function deleteReport(rid: number) {
    if (!await confirmDialog("Delete this show report?")) return;
    await fetch(`/api/show-reports/${rid}`, { method: "DELETE" });
    reloadReports();
  }

  function parseFlags(r: ShowReport): string[] {
    try { return r.flags ? JSON.parse(r.flags) : []; } catch { return []; }
  }

  async function toggleFlag(r: ShowReport, heading: string) {
    const current = parseFlags(r);
    const next = current.includes(heading) ? current.filter(f => f !== heading) : [...current, heading];
    const res = await sendJson(`/api/show-reports/${r.id}/flags`, "PATCH", { flags: next });
    if (res.ok) {
      const updated = await res.json();
      setShowReports(prev => prev.map(x => x.id === r.id ? { ...x, flags: JSON.stringify(updated.flags) } : x));
    }
  }

  function renderReportNotes(report: ShowReport) {
    if (!report.notes) return null;
    const flagged = parseFlags(report);
    // Prepend \n so the first heading is caught by the same \n+ lookahead as the rest
    const sections = ('\n' + report.notes).split(/\n+(?=\*\*[^*]+\*\*)/).filter(Boolean);
    return (
      <div className="mt-2 space-y-2">
        {sections.map((section, i) => {
          const m = section.match(/^\*\*([^*]+)\*\*\n?([\s\S]*)/);
          if (!m) return <p key={i} className="text-sm whitespace-pre-wrap" style={{ color: "var(--psg-muted)" }}>{section.trim()}</p>;
          const [, heading, body] = m;
          const h = heading.trim();
          const isTimings = h === "Timings";
          const isFlagged = flagged.includes(h);
          const cleanBody = body.replace(/^\*\*\s*\n+/, '').trim();
          if (!cleanBody) return null;
          return (
            <div key={i} className="rounded p-2.5" style={{ backgroundColor: isTimings ? "rgba(59,130,246,0.07)" : isFlagged ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${isTimings ? "rgba(59,130,246,0.2)" : isFlagged ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)"}` }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-semibold" style={{ color: isTimings ? "var(--psg-blue)" : isFlagged ? "#fbbf24" : "rgba(255,255,255,0.5)" }}>{h}</p>
                {!isTimings && (
                  <button onClick={() => toggleFlag(report, h)} title={isFlagged ? "Remove flag" : "Flag this section"}
                    className="text-xs px-1 rounded transition-colors leading-none"
                    style={{ color: isFlagged ? "#fbbf24" : "rgba(255,255,255,0.2)", backgroundColor: "transparent" }}>
                    {isFlagged ? "⚑" : "⚐"}
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--psg-muted)" }}>{cleanBody}</p>
            </div>
          );
        })}
      </div>
    );
  }

  async function uploadReportPdfs(files: File[]) {
    const pdfs = files.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { flashPdfStatus("No PDF files found.", 4000); return; }
    setUploadingPdfs(true);
    let imported = 0;
    try {
      for (let i = 0; i < pdfs.length; i++) {
        const f = pdfs[i];
        setPdfUploadStatus(`Parsing ${i + 1} of ${pdfs.length}: ${f.name}…`);
        const fd = new FormData();
        fd.append("pdf", f);
        const res = await fetch(`/api/productions/${id}/show-reports/upload-pdf`, { method: "POST", body: fd });
        const text = await res.text();
        let data: any;
        try { data = JSON.parse(text); } catch { throw new Error(`Server error on "${f.name}": ${text.slice(0, 200)}`); }
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        imported++;
      }
      await reloadReports();
      flashPdfStatus(`✓ ${imported} report${imported !== 1 ? "s" : ""} imported`, 5000);
    } catch (e: any) {
      flashPdfStatus(`Error: ${e.message}`, 8000);
    } finally {
      setUploadingPdfs(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Show Reports</h3>
          {prod.reportEmail && (
            <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Reports sent to: {prod.reportEmail}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={importFromEmail} disabled={importingReports}
            className="text-sm px-3 py-1.5 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "var(--psg-blue)", border: "1px solid rgba(59,130,246,0.3)" }}>
            {importingReports ? "Importing…" : "Import from Email"}
          </button>
          <button onClick={reparseEmpty} disabled={importingReports}
            className="text-sm px-3 py-1.5 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "rgba(234,179,8,0.15)", color: "#b45309", border: "1px solid rgba(234,179,8,0.3)" }}>
            Re-parse Empty
          </button>
          <button onClick={() => { setEditReport(null); setReportForm(BLANK_REPORT); setShowReportForm(true); }}
            className="text-sm px-3 py-1.5 rounded font-medium text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--psg-blue)" }}>+ Add Report</button>
        </div>
      </div>

      {importStatus && (
        <div className="flex items-center gap-2 px-3 py-2 rounded text-sm" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "var(--psg-blue)", border: "1px solid rgba(59,130,246,0.2)" }}>
          {importingReports && <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />}
          {importStatus}
        </div>
      )}

      {/* PDF drag-and-drop upload zone */}
      <div
        className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 py-5 cursor-pointer transition-colors"
        style={{
          borderColor: pdfDragOver ? "var(--psg-blue)" : "var(--psg-card-border)",
          backgroundColor: pdfDragOver ? "rgba(59,130,246,0.07)" : "transparent",
          opacity: uploadingPdfs ? 0.6 : 1,
          pointerEvents: uploadingPdfs ? "none" : undefined,
        }}
        onClick={() => pickFiles(uploadReportPdfs, ".pdf,application/pdf")}
        onDragOver={(e) => { e.preventDefault(); setPdfDragOver(true); }}
        onDragLeave={() => setPdfDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setPdfDragOver(false); const files = Array.from(e.dataTransfer.files); if (files.length) uploadReportPdfs(files); }}
      >
        {uploadingPdfs
          ? <><span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ color: "var(--psg-blue)" }} /><p className="text-xs" style={{ color: "var(--psg-blue)" }}>{pdfUploadStatus}</p></>
          : <><p className="text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Drop PDF show reports here, or click to select</p><p className="text-xs" style={{ color: "var(--psg-muted)", opacity: 0.6 }}>Multiple files supported — each will be parsed by AI</p></>
        }
      </div>

      {pdfUploadStatus && !uploadingPdfs && (
        <div className="flex items-center gap-2 px-3 py-2 rounded text-sm" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "var(--psg-blue)", border: "1px solid rgba(59,130,246,0.2)" }}>
          {pdfUploadStatus}
        </div>
      )}

      {showReportForm && (
        <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-blue)" }}>
          <h4 className="text-sm font-semibold text-white">{editReport ? "Edit Report" : "New Show Report"}</h4>
          <form onSubmit={saveReport} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <F label="Date *"><input required type="date" className={inp} style={inpStyle} value={reportForm.reportDate} onChange={e => setReportForm(f => ({ ...f, reportDate: e.target.value }))} /></F>
              <F label="Performance"><input className={inp} style={inpStyle} placeholder="e.g. Evening – 7:30pm" value={reportForm.performance} onChange={e => setReportForm(f => ({ ...f, performance: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Venue"><input className={inp} style={inpStyle} value={reportForm.venue} onChange={e => setReportForm(f => ({ ...f, venue: e.target.value }))} /></F>
              <F label="Attendance"><input type="number" min="0" className={inp} style={inpStyle} value={reportForm.attendance} onChange={e => setReportForm(f => ({ ...f, attendance: e.target.value }))} /></F>
            </div>
            <F label="Notes"><textarea rows={4} className={inp} style={inpStyle} value={reportForm.notes} onChange={e => setReportForm(f => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => { setShowReportForm(false); setEditReport(null); setReportForm(BLANK_REPORT); }} label={editReport ? "Save Changes" : "Save Report"} />
          </form>
        </div>
      )}

      {showReports.length === 0 && !showReportForm ? (
        <div className="py-12 text-center rounded-lg border" style={{ color: "var(--psg-muted)", borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          No show reports yet.{prod.reportEmail ? "" : " Reports sent to reports@production-solutions.group will be imported automatically."}
        </div>
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          {showReports.map(r => {
            const isExpanded = expandedReports.has(r.id);
            const flags = parseFlags(r);
            return (
              <div key={r.id}>
                {/* Collapsed header — always visible */}
                <button
                  className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedReports(prev => toggled(prev, r.id))}
                >
                  <span className="text-sm shrink-0" style={{ color: "var(--psg-muted)", marginTop: 1 }}>{isExpanded ? "▾" : "▸"}</span>
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    {r.performanceNumber != null && <span className="text-sm font-bold" style={{ color: "var(--psg-blue)", minWidth: "2.5rem" }}>#{r.performanceNumber}</span>}
                    <span className="font-medium text-white text-sm">{fmtDate(r.reportDate)}</span>
                    {r.performance && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{r.performance}</span>}
                    {r.venue && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "var(--psg-blue)" }}>{r.venue}</span>}
                    {r.attendance != null && (
                      <span className="text-xs" style={{ color: "var(--psg-muted)" }}>
                        {r.attendance.toLocaleString()}{r.houseCapacity ? ` / ${r.houseCapacity.toLocaleString()} (${Math.round(r.attendance / r.houseCapacity * 100)}%)` : ""} sold
                      </span>
                    )}
                    {r.runningTime && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>Run: {r.runningTime}</span>}
                    {r.playingTime && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>Play: {r.playingTime}</span>}
                    {flags.map(f => (
                      <span key={f} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
                        {f === "Health & Safety / Incidents" ? "H&S" : f === "Covers & Absences" ? "Covers" : f}
                      </span>
                    ))}
                    {!r.productionMatched && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171" }}>Unmatched</span>}
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {r.rawPdf && (
                      <a href={`/api/show-reports/${r.id}/pdf`} download
                        className="text-xs px-2 py-1 rounded" style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.06)" }}
                        title="Download original PDF">PDF</a>
                    )}
                    <button onClick={() => { setEditReport(r); setReportForm({ reportDate: r.reportDate.slice(0, 10), venue: r.venue ?? "", performance: r.performance ?? "", attendance: r.attendance != null ? String(r.attendance) : "", notes: r.notes ?? "" }); setShowReportForm(true); }}
                      className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Edit</button>
                    <button onClick={() => deleteReport(r.id)}
                      className="text-xs px-2 py-1 rounded" style={{ color: "#f87171", backgroundColor: "rgba(239,68,68,0.1)" }}>Delete</button>
                  </div>
                </button>

                {/* Expanded notes */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                    {renderReportNotes(r)}
                    {r.emailSubject && <p className="text-xs mt-2 italic" style={{ color: "var(--psg-muted)", opacity: 0.5 }}>via email: {r.emailSubject}</p>}
                    {r.createdByUser && <p className="text-xs mt-1" style={{ color: "var(--psg-muted)", opacity: 0.6 }}>by {r.createdByUser.name}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
