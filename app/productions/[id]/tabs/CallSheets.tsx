"use client";

// Call sheets: one per day. A new sheet fills in the crew and PSG staff booked that day, shows the
// day's schedule, lists everyone by call time, and can be downloaded or emailed as a PDF. A sheet
// changed after it was sent says so, and the next send is marked UPDATED.
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { confirmDialog, alertDialog } from "@/components/Dialogs";
import { F, Modal, Btns, inp, inpStyle, sendJson, type TabProps } from "../shared";
import { fmtDateTime } from "@/lib/format";

type CSEntry = { id: number; discipline: string; name: string | null; role: string | null; callTime: string | null; notes: string | null; email: string | null; linked: "crew" | "psg" | null; hasEmail: boolean };
type ScheduleItem = { id: number; title: string; type: string; startAt: string; endAt: string; location: string | null };
type CallSheet = {
  id: number; date: string; title: string | null; venue: string | null; generalNotes: string | null;
  entries: CSEntry[]; schedule: ScheduleItem[]; sentAt: string | null; changedSinceSent: boolean;
  lastSend: { sentAt: string; isUpdate: boolean; by: string | null; count: number; failed: number } | null;
};

const BLANK_SHEET = { date: "", title: "", venue: "", generalNotes: "", fill: true };
const BLANK_ENTRY = { discipline: "", name: "", role: "", callTime: "", notes: "", email: "" };
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const muted = { color: "var(--psg-muted)" };
const smallBtn = { color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" };

export default function CallSheetsTab({ prod }: TabProps) {
  const id = String(prod.id);
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const staff = role === "admin" || role === "member";
  const [callSheets, setCallSheets] = useState<CallSheet[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [sheetForm, setSheetForm] = useState<typeof BLANK_SHEET | null>(null); // new sheet
  const [editSheet, setEditSheet] = useState<{ date: string; title: string; venue: string; generalNotes: string } | null>(null);
  const [entryForm, setEntryForm] = useState(BLANK_ENTRY);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CSEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const active = callSheets.find(s => s.id === activeId) ?? null;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount
  useEffect(() => { reload(); }, [id]);

  // Keeps the selected sheet selected after a reload, or picks the first
  async function reload(select?: number) {
    const data: CallSheet[] = await fetch(`/api/productions/${id}/call-sheets`).then(r => (r.ok ? r.json() : []));
    setCallSheets(data);
    setActiveId(prev => (select && data.some(s => s.id === select) ? select : prev && data.some(s => s.id === prev) ? prev : data[0]?.id ?? null));
  }
  async function check(res: Response) {
    if (res.ok) return true;
    alertDialog((await res.json().catch(() => ({}))).error ?? "That didn't work");
    return false;
  }

  async function saveNewSheet(e: React.FormEvent) {
    e.preventDefault();
    if (!sheetForm) return;
    setBusy("new");
    const res = await sendJson(`/api/productions/${id}/call-sheets`, "POST", sheetForm);
    setBusy(null);
    if (!(await check(res))) return;
    const made = await res.json();
    setSheetForm(null);
    await reload(made.id);
  }
  async function saveSheetEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !editSheet) return;
    if (await check(await sendJson(`/api/call-sheets/${active.id}`, "PUT", editSheet))) { setEditSheet(null); await reload(); }
  }
  async function deleteSheet(sheetId: number) {
    await fetch(`/api/call-sheets/${sheetId}`, { method: "DELETE" });
    setActiveId(null);
    await reload();
  }
  async function fillFromBookings() {
    if (!active) return;
    setBusy("fill");
    const res = await fetch(`/api/call-sheets/${active.id}/fill`, { method: "POST" });
    setBusy(null);
    if (!(await check(res))) return;
    const { added } = await res.json();
    await reload();
    alertDialog(added ? `Added ${added} ${added === 1 ? "person" : "people"} booked that day.` : "Everyone booked that day is already on the sheet.");
  }

  function closeEntryForm() { setShowEntryForm(false); setEditingEntry(null); setEntryForm(BLANK_ENTRY); }
  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    const res = editingEntry
      ? await sendJson(`/api/call-sheet-entries/${editingEntry.id}`, "PUT", entryForm)
      : await sendJson(`/api/call-sheets/${active.id}/entries`, "POST", entryForm);
    if (!(await check(res))) return;
    closeEntryForm();
    await reload();
  }
  async function deleteEntry(entryId: number) {
    await fetch(`/api/call-sheet-entries/${entryId}`, { method: "DELETE" });
    await reload();
  }

  async function downloadPdf() {
    if (!active) return;
    setBusy("pdf");
    const { downloadCallSheetPDF } = await import("@/lib/callSheetPdf");
    await downloadCallSheetPDF(prod.name, active, { productionLogoUrl: prod.logoUrl });
    setBusy(null);
  }
  async function emailSheet() {
    if (!active) return;
    const preview = await fetch(`/api/call-sheets/${active.id}/send`);
    if (!(await check(preview))) return;
    const p: { to: { name: string }[]; noEmail: string[]; mailReady: boolean } = await preview.json();
    if (!p.mailReady) { alertDialog("Email isn't set up on this Hub, so the sheet can't be sent from here. Download the PDF instead."); return; }
    if (!p.to.length) { alertDialog("Nobody on this sheet has an email address. Add one to a row, or to their crew record."); return; }
    const updated = !!active.sentAt;
    const missing = p.noEmail.length ? `\n\nNo email for: ${p.noEmail.join(", ")}. They won't get it.` : "";
    if (!(await confirmDialog(`${updated ? "Send the UPDATED call sheet" : "Email the call sheet"} to ${p.to.length} ${p.to.length === 1 ? "person" : "people"}?${missing}`, { confirmLabel: updated ? "Send update" : "Send" }))) return;
    setBusy("send");
    const { callSheetPdfBase64 } = await import("@/lib/callSheetPdf");
    const pdf = await callSheetPdfBase64(prod.name, active, { updated, productionLogoUrl: prod.logoUrl });
    const res = await sendJson(`/api/call-sheets/${active.id}/send`, "POST", { pdf });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    await reload();
    if (!res.ok && !d.sent) { alertDialog(d.error ?? "The call sheet couldn't be sent"); return; }
    const failed = (d.failed ?? []) as { name: string }[];
    alertDialog(`Sent to ${d.sent} ${d.sent === 1 ? "person" : "people"}.${failed.length ? ` Couldn't reach: ${failed.map(f => f.name).join(", ")}.` : ""}`);
  }

  return (
    <>
      <div className="flex flex-col md:flex-row items-start gap-4">
        {/* Sheet list */}
        <div className="w-full md:w-48 shrink-0 space-y-1">
          {callSheets.map(s => (
            <button key={s.id} onClick={() => setActiveId(s.id)} className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
              style={activeId === s.id ? { backgroundColor: "var(--psg-blue)", color: "#fff" } : { backgroundColor: "var(--psg-card-bg)", color: "var(--psg-text)", border: "1px solid var(--psg-card-border)" }}>
              <div className="font-medium">{s.title || "Call Sheet"}</div>
              <div className="text-xs opacity-70">
                {new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                {s.changedSinceSent ? " · changed" : s.sentAt ? " · sent" : ""}
              </div>
            </button>
          ))}
          <button onClick={() => setSheetForm(BLANK_SHEET)} className="w-full text-left px-3 py-2 rounded text-sm border border-dashed transition-colors hover:border-white/40" style={{ borderColor: "var(--psg-card-border)", ...muted }}>
            + New Call Sheet
          </button>
        </div>

        <div className="flex-1 min-w-0 w-full">
          {active ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">{active.title || "Call Sheet"}</h3>
                    <div className="text-sm mt-0.5" style={muted}>
                      {new Date(active.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                      {active.venue && ` · ${active.venue}`}
                    </div>
                    {active.generalNotes && <div className="text-sm mt-2 whitespace-pre-wrap" style={muted}>{active.generalNotes}</div>}
                    {active.lastSend && (
                      <div className="text-xs mt-2" style={{ color: active.changedSinceSent ? "#fbbf24" : "var(--psg-muted)" }}>
                        {active.lastSend.isUpdate ? "Update sent" : "Sent"} {fmtDateTime(active.lastSend.sentAt)} to {active.lastSend.count} {active.lastSend.count === 1 ? "person" : "people"}
                        {active.lastSend.by ? ` by ${active.lastSend.by}` : ""}{active.lastSend.failed ? ` · ${active.lastSend.failed} failed` : ""}
                        {active.changedSinceSent && " · changed since sent"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={downloadPdf} disabled={!!busy} className="text-xs px-3 py-1.5 rounded disabled:opacity-50" style={smallBtn}>{busy === "pdf" ? "Making PDF…" : "Download PDF"}</button>
                    {staff && (
                      <button onClick={emailSheet} disabled={!!busy || active.entries.length === 0} className="text-xs px-3 py-1.5 rounded font-medium text-white disabled:opacity-50" style={{ backgroundColor: active.changedSinceSent ? "#d97706" : "var(--psg-blue)" }}>
                        {busy === "send" ? "Sending…" : active.changedSinceSent ? "Send update" : active.sentAt ? "Send again" : "Email to crew"}
                      </button>
                    )}
                    <button onClick={() => setEditSheet({ date: active.date.slice(0, 10), title: active.title ?? "", venue: active.venue ?? "", generalNotes: active.generalNotes ?? "" })} className="text-xs px-2 py-1.5 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Edit</button>
                    <button onClick={async () => { if (await confirmDialog("Delete this call sheet?", { danger: true, confirmLabel: "Delete" })) deleteSheet(active.id); }} className="text-xs px-2 py-1.5 rounded" style={smallBtn}>Delete</button>
                  </div>
                </div>
              </div>

              {/* The day's schedule */}
              <div className="rounded-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                <div className="px-4 py-3 border-b text-sm font-medium" style={{ borderColor: "var(--psg-card-border)" }}>The day&apos;s schedule</div>
                {active.schedule.length === 0 ? (
                  <div className="px-4 py-3 text-sm" style={muted}>Nothing on the Schedule tab for this day.</div>
                ) : (
                  <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
                    {active.schedule.map(e => (
                      <li key={e.id} className="px-4 py-2 text-sm flex flex-wrap gap-x-3" style={{ borderColor: "var(--psg-card-border)" }}>
                        <span className="font-mono tabular-nums" style={{ color: "var(--psg-blue)" }}>{time(e.startAt)}–{time(e.endAt)}</span>
                        <span>{e.title}</span>
                        {e.location && <span style={muted}>{e.location}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Calls, one list by call time */}
              <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                  <span className="text-sm font-medium">Calls <span className="font-normal" style={muted}>· by call time</span></span>
                  <div className="flex gap-2">
                    <button onClick={fillFromBookings} disabled={!!busy} className="text-xs px-3 py-1 rounded disabled:opacity-50" style={smallBtn}>{busy === "fill" ? "Checking…" : "Add people booked that day"}</button>
                    <button onClick={() => { setEditingEntry(null); setEntryForm(BLANK_ENTRY); setShowEntryForm(true); }} className="text-xs px-3 py-1 rounded font-medium text-white" style={{ backgroundColor: "var(--psg-blue)" }}>+ Add Row</button>
                  </div>
                </div>
                {active.entries.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm" style={muted}>Nobody on this sheet yet. Add people booked that day, or add a row.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ minWidth: 640 }}>
                      <thead>
                        <tr className="border-b text-left" style={{ borderColor: "var(--psg-card-border)" }}>
                          {["Call", "Name", "Department", "Role", "Notes", ""].map(h => <th key={h} className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={muted}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {active.entries.map((entry, i) => (
                          <tr key={entry.id} className="border-b last:border-0" style={{ borderColor: "var(--psg-card-border)", backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                            <td className="px-4 py-2.5">{entry.callTime ? <span className="font-mono font-semibold" style={{ color: "var(--psg-blue)" }}>{entry.callTime}</span> : <span style={{ color: "#fbbf24" }}>TBC</span>}</td>
                            <td className="px-4 py-2.5">
                              {entry.name || <span style={muted}>All {entry.discipline}</span>}
                              {entry.name && !entry.hasEmail && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded" title="No email on the row or their record, so they won't be emailed" style={{ backgroundColor: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>no email</span>}
                            </td>
                            <td className="px-4 py-2.5" style={muted}>{entry.discipline}</td>
                            <td className="px-4 py-2.5" style={muted}>{entry.role || "—"}</td>
                            <td className="px-4 py-2.5 text-xs" style={muted}>{entry.notes || ""}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex gap-1 justify-end">
                                <button onClick={() => { setEditingEntry(entry); setEntryForm({ discipline: entry.discipline, name: entry.name ?? "", role: entry.role ?? "", callTime: entry.callTime ?? "", notes: entry.notes ?? "", email: entry.email ?? "" }); setShowEntryForm(true); }} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Edit</button>
                                <button onClick={() => deleteEntry(entry.id)} aria-label={`Remove ${entry.name ?? entry.discipline}`} className="text-xs px-2 py-0.5 rounded" style={smallBtn}>✕</button>
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
            <div className="py-16 text-center" style={muted}>
              {callSheets.length === 0 ? "No call sheets yet. Create one for a day and it fills in the crew booked that day." : "Select a call sheet."}
            </div>
          )}
        </div>
      </div>

      {sheetForm && (
        <Modal title="New Call Sheet" onClose={() => setSheetForm(null)}>
          <form onSubmit={saveNewSheet} className="space-y-3">
            <F label="Date *"><input required type="date" className={inp} style={inpStyle} value={sheetForm.date} onChange={e => setSheetForm(f => f && { ...f, date: e.target.value })} /></F>
            <F label="Title"><input className={inp} style={inpStyle} placeholder="e.g. Get In Day 1, Show Day" value={sheetForm.title} onChange={e => setSheetForm(f => f && { ...f, title: e.target.value })} /></F>
            <F label="Venue"><input className={inp} style={inpStyle} placeholder="Leave blank to use that day's venue" value={sheetForm.venue} onChange={e => setSheetForm(f => f && { ...f, venue: e.target.value })} /></F>
            <F label="General Notes"><textarea rows={2} className={inp} style={inpStyle} value={sheetForm.generalNotes} onChange={e => setSheetForm(f => f && { ...f, generalNotes: e.target.value })} /></F>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={sheetForm.fill} onChange={e => setSheetForm(f => f && { ...f, fill: e.target.checked })} />
              <span>Fill in the crew and PSG staff booked that day <span className="block text-xs" style={muted}>From the Crew tab dates and PSG staff assignments. You add call times after.</span></span>
            </label>
            {busy === "new" ? <p className="text-sm" style={muted}>Creating…</p> : <Btns onCancel={() => setSheetForm(null)} label="Create Call Sheet" />}
          </form>
        </Modal>
      )}

      {editSheet && (
        <Modal title="Edit Call Sheet" onClose={() => setEditSheet(null)}>
          <form onSubmit={saveSheetEdit} className="space-y-3">
            <F label="Date *"><input required type="date" className={inp} style={inpStyle} value={editSheet.date} onChange={e => setEditSheet(f => f && { ...f, date: e.target.value })} /></F>
            <F label="Title"><input className={inp} style={inpStyle} value={editSheet.title} onChange={e => setEditSheet(f => f && { ...f, title: e.target.value })} /></F>
            <F label="Venue"><input className={inp} style={inpStyle} value={editSheet.venue} onChange={e => setEditSheet(f => f && { ...f, venue: e.target.value })} /></F>
            <F label="General Notes"><textarea rows={3} className={inp} style={inpStyle} value={editSheet.generalNotes} onChange={e => setEditSheet(f => f && { ...f, generalNotes: e.target.value })} /></F>
            <Btns onCancel={() => setEditSheet(null)} label="Save Changes" />
          </form>
        </Modal>
      )}

      {showEntryForm && (
        <Modal title={editingEntry ? "Edit Row" : "Add Crew Call"} onClose={closeEntryForm}>
          <form onSubmit={saveEntry} className="space-y-3">
            <F label="Department *"><input required className={inp} style={inpStyle} placeholder="e.g. Lighting, Sound, Staging" value={entryForm.discipline} onChange={e => setEntryForm(f => ({ ...f, discipline: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name"><input className={inp} style={inpStyle} placeholder="Blank for a department call" value={entryForm.name} onChange={e => setEntryForm(f => ({ ...f, name: e.target.value }))} /></F>
              <F label="Role"><input className={inp} style={inpStyle} placeholder="e.g. Head of LX" value={entryForm.role} onChange={e => setEntryForm(f => ({ ...f, role: e.target.value }))} /></F>
            </div>
            <F label="Call Time"><input type="time" className={inp} style={inpStyle} value={entryForm.callTime} onChange={e => setEntryForm(f => ({ ...f, callTime: e.target.value }))} /></F>
            {!editingEntry?.linked && (
              <F label="Email (for sending the sheet)"><input type="email" className={inp} style={inpStyle} placeholder="Only needed for people not on the Crew tab or the Hub" value={entryForm.email} onChange={e => setEntryForm(f => ({ ...f, email: e.target.value }))} /></F>
            )}
            <F label="Notes"><input className={inp} style={inpStyle} value={entryForm.notes} onChange={e => setEntryForm(f => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={closeEntryForm} label={editingEntry ? "Save Changes" : "Add Row"} />
          </form>
        </Modal>
      )}
    </>
  );
}
