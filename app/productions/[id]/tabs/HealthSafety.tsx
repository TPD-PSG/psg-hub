"use client";

import { useState } from "react";
import { exportToolboxSignoffPDF } from "@/lib/exports";
import { confirmDialog } from "@/components/Dialogs";
import { FileGrid, FolderToggle, fmtIsoDay, toggled, type HSDoc, type TabProps, type ToolboxSig } from "../shared";

export default function HealthSafetyTab({ prod, reload }: TabProps) {
  const id = String(prod.id);
  const [hsUploading, setHsUploading] = useState(false);
  const [hsUploadStop, setHsUploadStop] = useState<number | null>(null);
  const [hsOpenFolders, setHsOpenFolders] = useState<Set<string>>(new Set(["General"]));
  async function uploadHSDocs(files: File[], folder: string, tourStopId: number | null) {
    setHsUploading(true);
    setHsUploadStop(tourStopId);
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("folder", folder);
      if (tourStopId != null) fd.append("tourStopId", String(tourStopId));
      await fetch(`/api/productions/${id}/hs-documents`, { method: "POST", body: fd });
    }
    setHsUploading(false);
    setHsUploadStop(null);
    reload();
  }

  async function deleteHSDoc(docId: number) {
    if (!await confirmDialog("Delete this document?")) return;
    await fetch(`/api/hs-documents/${docId}`, { method: "DELETE" });
    reload();
  }

  const tourStops = prod.isTour ? prod.tourStops : [];
  const toggleOpen = (k: string) => setHsOpenFolders(p => toggled(p, k));

  // File list + upload zone for the general folder or one tour stop
  const hsDocGrid = (docs: HSDoc[], stopId: number | null, folderKey: string) => (
    <FileGrid docs={docs} href={(doc) => `/api/hs-documents/${doc.id}`} onDelete={deleteHSDoc}
      onUpload={(files) => uploadHSDocs(files, folderKey, stopId)} uploading={hsUploading && hsUploadStop === stopId} />
  );

  // Available sign-off dates for the filter
  const allSigDates = Array.from(new Set(prod.toolboxSignatures.map(s => s.signeeDate))).sort().reverse();
  const activeSigDates = allSigDates.filter(d => hsOpenFolders.has(`sigdate_${d}`));
  const filteredSigs = activeSigDates.length > 0 ? prod.toolboxSignatures.filter(s => activeSigDates.includes(s.signeeDate)) : prod.toolboxSignatures;

  // Export filtered sigs as branded PDF
  function exportPDF(sigs: ToolboxSig[], venueName?: string) {
    exportToolboxSignoffPDF(prod?.name ?? "Production", sigs, venueName, prod?.logoUrl ?? undefined);
  }

  return (
    <div className="space-y-6">

      {/* ── Documents section ── */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">H&S Documents</h2>

        {/* General documents (always shown) */}
        <div className="rounded-lg border overflow-hidden mb-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <FolderToggle icon="📁" title="General" count={`${prod.hsDocuments.filter(d => !d.tourStopId).length} files`} open={hsOpenFolders.has("General")} onToggle={() => toggleOpen("General")} />
          {hsOpenFolders.has("General") && (
            <div className="p-4">
              {hsDocGrid(prod.hsDocuments.filter(d => !d.tourStopId), null, "General")}
            </div>
          )}
        </div>

        {/* Tour venues — docs + QR + sign-off records per venue */}
        {prod.isTour && tourStops.length > 0 && tourStops.map(stop => {
          const key = `stop_${stop.id}`;
          const stopDocs = prod.hsDocuments.filter(d => d.tourStopId === stop.id);
          const stopSigs = prod.toolboxSignatures.filter(s => s.tourStopId === stop.id);
          const stopDates = Array.from(new Set(stopSigs.map(s => s.signeeDate))).sort().reverse();
          // Date filters live in hsOpenFolders as `${key}_date_${d}`
          const activeDateFilter = stopDates.filter(d => hsOpenFolders.has(`${key}_date_${d}`));
          const filteredStopSigs = activeDateFilter.length > 0 ? stopSigs.filter(s => activeDateFilter.includes(s.signeeDate)) : stopSigs;

          return (
            <div key={stop.id} className="rounded-lg border overflow-hidden mb-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              {/* Accordion header */}
              <FolderToggle icon="📍" title={stop.venue.name} count={`${stopDocs.length} files · ${stopSigs.length} sign-offs`} open={hsOpenFolders.has(key)} onToggle={() => toggleOpen(key)} />

              {hsOpenFolders.has(key) && (
                <div className="p-4 space-y-5">
                  {/* Documents */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--psg-muted)" }}>Documents</p>
                    {hsDocGrid(stopDocs, stop.id, "General")}
                  </div>

                  {/* QR code — inline within venue */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>CDM Toolbox Talk</p>
                    <QRCard
                      title={`${stop.venue.name} — sign-off`}
                      qrUrl={`/api/productions/${id}/toolbox-qr?stopId=${stop.id}`}
                      formUrl={`/toolbox-talk/${id}?stopId=${stop.id}`}
                    />
                  </div>

                  {/* Sign-off records for this venue */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Sign-off Records ({filteredStopSigs.length})</p>
                      {stopSigs.length > 0 && (
                        <button onClick={() => exportPDF(filteredStopSigs, stop.venue.name)} className="text-xs border px-2.5 py-1 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                          Export PDF
                        </button>
                      )}
                    </div>
                    {/* Date filter chips */}
                    {stopDates.length > 1 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {stopDates.map(d => <DateChip key={d} date={d} active={hsOpenFolders.has(`${key}_date_${d}`)} onClick={() => toggleOpen(`${key}_date_${d}`)} />)}
                      </div>
                    )}
                    {stopSigs.length === 0 ? (
                      <p className="text-xs py-3 text-center" style={{ color: "var(--psg-muted)" }}>No sign-offs yet</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--psg-card-border)" }}>
                        <SigTable sigs={filteredStopSigs} pad="px-3" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── CDM Toolbox Talk (single-venue / non-tour) ── */}
      {!prod.isTour && (
        <div>
          <h2 className="text-base font-semibold text-white mb-3">CDM Toolbox Talk Sign-off</h2>
          <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            <QRCard title={prod.name} qrUrl={`/api/productions/${id}/toolbox-qr`} formUrl={`/toolbox-talk/${id}`} />
          </div>

          {/* Sign-off records */}
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: "var(--psg-card-border)" }}>
              <p className="text-sm font-semibold text-white flex-1">Sign-off Records</p>
              {/* Date filter chips */}
              {allSigDates.map(d => <DateChip key={d} date={d} active={hsOpenFolders.has(`sigdate_${d}`)} onClick={() => toggleOpen(`sigdate_${d}`)} />)}
              {prod.toolboxSignatures.length > 0 && (
                <button onClick={() => exportPDF(filteredSigs)} className="text-xs border px-2.5 py-1 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                  Export PDF
                </button>
              )}
            </div>
            {prod.toolboxSignatures.length === 0 ? (
              <p className="text-center py-8 text-xs" style={{ color: "var(--psg-muted)" }}>No sign-offs yet</p>
            ) : (
              <div className="overflow-x-auto">
                <SigTable sigs={filteredSigs} pad="px-4" />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// QR code for the CDM toolbox-talk sign-off form
function QRCard({ title, qrUrl, formUrl }: { title: string; qrUrl: string; formUrl: string }) {
  return (
    <div className="rounded-lg border p-4 flex flex-col items-center gap-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <p className="text-sm font-semibold text-white text-center">{title}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrUrl} alt="QR Code" width={160} height={160} style={{ imageRendering: "pixelated" }} />
      <div className="flex gap-2 w-full">
        <a href={qrUrl} download="cdm-toolbox-qr.png" className="flex-1 text-center text-xs border px-3 py-1.5 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
          Download
        </a>
        <a href={formUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-xs border px-3 py-1.5 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
          Open form
        </a>
      </div>
    </div>
  );
}

function DateChip({ date, active, onClick }: { date: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-xs px-2.5 py-1 rounded-full border transition-colors" style={{ borderColor: active ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: active ? "rgba(59,130,246,0.15)" : "transparent", color: active ? "var(--psg-blue)" : "var(--psg-muted)" }}>
      {fmtIsoDay(date)}
    </button>
  );
}

// Sign-off table; the tour-stop version uses tighter cell padding (px-3) than the single-venue one (px-4)
function SigTable({ sigs, pad }: { sigs: ToolboxSig[]; pad: "px-3" | "px-4" }) {
  return (
    <table className="w-full text-xs">
      <thead><tr style={{ borderBottom: "1px solid var(--psg-card-border)" }}>
        {["Name", "Employer", "Position", "Date", "Briefing", "Safety"].map(h => <th key={h} className={`${pad} py-2 text-left font-semibold`} style={{ color: "var(--psg-muted)" }}>{h}</th>)}
      </tr></thead>
      <tbody>
        {sigs.map(sig => (
          <tr key={sig.id} style={{ borderBottom: "1px solid var(--psg-card-border)" }} className="hover:bg-white/5">
            <td className={`${pad} py-2 text-white font-medium`}>{sig.signeeName}</td>
            <td className={`${pad} py-2`} style={{ color: "var(--psg-muted)" }}>{sig.employer ?? "—"}</td>
            <td className={`${pad} py-2`} style={{ color: "var(--psg-muted)" }}>{sig.position ?? "—"}</td>
            <td className={`${pad} py-2`} style={{ color: "var(--psg-muted)" }}>{fmtIsoDay(sig.signeeDate)}</td>
            <td className={`${pad} py-2 text-center`}>{sig.agreedBriefing ? "✓" : "✗"}</td>
            <td className={`${pad} py-2 text-center`}>{sig.agreedSafety ? "✓" : "✗"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
