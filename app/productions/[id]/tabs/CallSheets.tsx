"use client";

import { useEffect, useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { F, Modal, Btns, inp, inpStyle, sendJson, type TabProps } from "../shared";

export default function CallSheetsTab({ prod }: TabProps) {
  const id = String(prod.id);
  type CSEntry = { id: number; discipline: string; name: string | null; role: string | null; callTime: string | null; notes: string | null; sortOrder: number };
  type CallSheet = { id: number; date: string; title: string | null; venue: string | null; generalNotes: string | null; entries: CSEntry[] };
  const [callSheets, setCallSheets] = useState<CallSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState<CallSheet | null>(null);
  const [showNewSheetForm, setShowNewSheetForm] = useState(false);
  const BLANK_SHEET = { date: "", title: "", venue: "", generalNotes: "" };
  const [sheetForm, setSheetForm] = useState(BLANK_SHEET);
  const BLANK_ENTRY = { discipline: "", name: "", role: "", callTime: "", notes: "" };
  const [entryForm, setEntryForm] = useState(BLANK_ENTRY);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CSEntry | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount
  useEffect(() => { reloadCallSheets(); }, [id]);

  function closeSheetForm() { setShowNewSheetForm(false); setSheetForm(BLANK_SHEET); }
  function closeEntryForm() { setShowEntryForm(false); setEditingEntry(null); setEntryForm(BLANK_ENTRY); }

  // Keeps the selected sheet selected (with fresh entries) after a reload, or picks the first
  async function reloadCallSheets() {
    const data = await fetch(`/api/productions/${id}/call-sheets`).then((r) => r.json());
    setCallSheets(data);
    setActiveSheet((prev) => prev ? (data.find((s: CallSheet) => s.id === prev.id) ?? data[0] ?? null) : (data[0] ?? null));
  }

  async function saveNewSheet(e: React.FormEvent) {
    e.preventDefault();
    await sendJson(`/api/productions/${id}/call-sheets`, "POST", sheetForm);
    closeSheetForm();
    await reloadCallSheets();
  }

  async function deleteSheet(sheetId: number) {
    await fetch(`/api/call-sheets/${sheetId}`, { method: "DELETE" });
    setActiveSheet(null);
    await reloadCallSheets();
  }

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSheet) return;
    if (editingEntry) {
      await sendJson(`/api/call-sheet-entries/${editingEntry.id}`, "PUT", entryForm);
    } else {
      await sendJson(`/api/call-sheets/${activeSheet.id}/entries`, "POST", entryForm);
    }
    closeEntryForm();
    await reloadCallSheets();
  }

  async function deleteEntry(entryId: number) {
    await fetch(`/api/call-sheet-entries/${entryId}`, { method: "DELETE" });
    await reloadCallSheets();
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {/* Sheet list sidebar */}
          <div className="w-48 shrink-0 space-y-1">
            {callSheets.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSheet(s)}
                className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                style={activeSheet?.id === s.id
                  ? { backgroundColor: "var(--psg-blue)", color: "#fff" }
                  : { backgroundColor: "var(--psg-card-bg)", color: "var(--psg-text)", border: "1px solid var(--psg-card-border)" }}
              >
                <div className="font-medium">{s.title || "Call Sheet"}</div>
                <div className="text-xs opacity-70">{new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
              </button>
            ))}
            <button
              onClick={() => setShowNewSheetForm(true)}
              className="w-full text-left px-3 py-2 rounded text-sm border border-dashed transition-colors hover:border-white/40"
              style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
            >
              + New Call Sheet
            </button>
          </div>

          {/* Active sheet */}
          <div className="flex-1 min-w-0">
            {activeSheet ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{activeSheet.title || "Call Sheet"}</h3>
                      <div className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
                        {new Date(activeSheet.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        {activeSheet.venue && ` · ${activeSheet.venue}`}
                      </div>
                      {activeSheet.generalNotes && <div className="text-sm mt-2" style={{ color: "var(--psg-muted)" }}>{activeSheet.generalNotes}</div>}
                    </div>
                    <button onClick={async () => { if (await confirmDialog("Delete this call sheet?")) deleteSheet(activeSheet.id); }} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
                  </div>
                </div>

                {/* Entries table */}
                <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                    <span className="text-sm font-medium">Crew Calls</span>
                    <button
                      onClick={() => { setEditingEntry(null); setEntryForm(BLANK_ENTRY); setShowEntryForm(true); }}
                      className="text-xs px-3 py-1 rounded font-medium text-white"
                      style={{ backgroundColor: "var(--psg-blue)" }}
                    >
                      + Add Row
                    </button>
                  </div>

                  {activeSheet.entries.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No crew calls yet — add a row to get started.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left" style={{ borderColor: "var(--psg-card-border)" }}>
                            <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Discipline</th>
                            <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Name</th>
                            <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Role</th>
                            <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Call Time</th>
                            <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Notes</th>
                            <th className="px-4 py-2 w-16" />
                          </tr>
                        </thead>
                        <tbody>
                          {activeSheet.entries.map((entry, i) => (
                            <tr key={entry.id} className="border-b last:border-0" style={{ borderColor: "var(--psg-card-border)", backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                              <td className="px-4 py-2.5 font-medium">{entry.discipline}</td>
                              <td className="px-4 py-2.5" style={{ color: "var(--psg-muted)" }}>{entry.name || "—"}</td>
                              <td className="px-4 py-2.5" style={{ color: "var(--psg-muted)" }}>{entry.role || "—"}</td>
                              <td className="px-4 py-2.5">
                                {entry.callTime ? (
                                  <span className="font-mono font-semibold" style={{ color: "var(--psg-blue)" }}>{entry.callTime}</span>
                                ) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-xs" style={{ color: "var(--psg-muted)" }}>{entry.notes || ""}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex gap-1">
                                  <button onClick={() => { setEditingEntry(entry); setEntryForm({ discipline: entry.discipline, name: entry.name ?? "", role: entry.role ?? "", callTime: entry.callTime ?? "", notes: entry.notes ?? "" }); setShowEntryForm(true); }} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Edit</button>
                                  <button onClick={() => deleteEntry(entry.id)} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center" style={{ color: "var(--psg-muted)" }}>
                {callSheets.length === 0 ? "No call sheets yet — create one to get started." : "Select a call sheet."}
              </div>
            )}
          </div>
        </div>
      </div>
      {showNewSheetForm && (
        <Modal title="New Call Sheet" onClose={closeSheetForm}>
          <form onSubmit={saveNewSheet} className="space-y-3">
            <F label="Date *"><input required type="date" className={inp} style={inpStyle} value={sheetForm.date} onChange={(e) => setSheetForm((f) => ({ ...f, date: e.target.value }))} /></F>
            <F label="Title"><input className={inp} style={inpStyle} placeholder="e.g. Get In Day 1, Show Day" value={sheetForm.title} onChange={(e) => setSheetForm((f) => ({ ...f, title: e.target.value }))} /></F>
            <F label="Venue"><input className={inp} style={inpStyle} value={sheetForm.venue} onChange={(e) => setSheetForm((f) => ({ ...f, venue: e.target.value }))} /></F>
            <F label="General Notes"><textarea rows={2} className={inp} style={inpStyle} value={sheetForm.generalNotes} onChange={(e) => setSheetForm((f) => ({ ...f, generalNotes: e.target.value }))} /></F>
            <Btns onCancel={closeSheetForm} label="Create Call Sheet" />
          </form>
        </Modal>
      )}

      {/* Modal: Add / Edit Call Sheet Entry */}
      {showEntryForm && (
        <Modal title={editingEntry ? "Edit Row" : "Add Crew Call"} onClose={closeEntryForm}>
          <form onSubmit={saveEntry} className="space-y-3">
            <F label="Discipline *"><input required className={inp} style={inpStyle} placeholder="e.g. Lighting, Sound, Staging" value={entryForm.discipline} onChange={(e) => setEntryForm((f) => ({ ...f, discipline: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name"><input className={inp} style={inpStyle} placeholder="Leave blank for dept. call" value={entryForm.name} onChange={(e) => setEntryForm((f) => ({ ...f, name: e.target.value }))} /></F>
              <F label="Role"><input className={inp} style={inpStyle} placeholder="e.g. Head of LX" value={entryForm.role} onChange={(e) => setEntryForm((f) => ({ ...f, role: e.target.value }))} /></F>
            </div>
            <F label="Call Time"><input className={inp} style={inpStyle} placeholder="e.g. 08:00" value={entryForm.callTime} onChange={(e) => setEntryForm((f) => ({ ...f, callTime: e.target.value }))} /></F>
            <F label="Notes"><input className={inp} style={inpStyle} value={entryForm.notes} onChange={(e) => setEntryForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={closeEntryForm} label={editingEntry ? "Save Changes" : "Add Row"} />
          </form>
        </Modal>
      )}
    </>
  );
}
