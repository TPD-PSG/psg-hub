"use client";

import { useEffect, useRef, useState } from "react";
import { exportMeetingMinutesPDF } from "@/lib/exports";
import { confirmDialog, alertDialog } from "@/components/Dialogs";
import MeetingActions from "@/components/MeetingActions";
import { parseTranscript, TRANSCRIPT_MAX_CHARS } from "@/lib/transcript";
import { inp, inpStyle, sendJson, useList, type ProdContact, type TabProps } from "../shared";

export default function MeetingsTab({ prod, canEdit }: TabProps & { canEdit: boolean }) {
  const id = String(prod.id);
  type Meeting = { id: number; title: string; meetingDate: string; location: string | null; attendees: string | null; agenda: string | null; minutes: string | null; transcript: string | null; recordingUrl: string | null; createdByUser: { id: number; name: string } | null };
  const BLANK_MEETING = { title: "", meetingDate: "", location: "", attendees: "", agenda: "", minutes: "", recordingUrl: "" };
  const [meetings, , reloadMeetingList] = useList<Meeting>(`/api/productions/${id}/meetings`);
  const [meetingContacts, , reloadMeetingContacts] = useList<ProdContact>(`/api/productions/${id}/contacts`);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [meetingForm, setMeetingForm] = useState(BLANK_MEETING);
  const [meetingAttendeeIds, setMeetingAttendeeIds] = useState<number[]>([]);
  const [meetingAttendeeExtra, setMeetingAttendeeExtra] = useState("");
  const [expandedMeetings, setExpandedMeetings] = useState<Record<number, { agenda?: boolean; minutes?: boolean; transcript?: boolean }>>({});
  const [meetingRecording, setMeetingRecording] = useState(false);
  const [meetingTranscript, setMeetingTranscript] = useState("");
  const [generatingMinutes, setGeneratingMinutes] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptFileRef = useRef<HTMLInputElement>(null);

  // A transcript file from Zoom or Teams (.vtt), .srt, or Word's Transcribe saved as .txt
  async function loadTranscriptFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alertDialog("That file is over 5 MB. A transcript file is usually much smaller: check it's the transcript (.vtt or .txt), not the recording."); return; }
    if (/^(video|audio)\//.test(file.type) || /\.(mp4|m4a|mp3|mov|wav)$/i.test(file.name)) { alertDialog("That's the recording itself. Upload its transcript (.vtt or .txt) instead, or paste the recording's link below."); return; }
    const text = parseTranscript(await file.text());
    if (!text.trim()) { alertDialog("Couldn't find any words in that file."); return; }
    if (meetingTranscript.trim() && !(await confirmDialog("Replace the transcript that's already here?"))) return;
    setMeetingTranscript(text);
    if (text.length >= TRANSCRIPT_MAX_CHARS) alertDialog("That transcript is very long, so only the first part was kept.");
  }

  // Live transcription stops if you leave the tab
  useEffect(() => () => recognitionRef.current?.stop(), []);

  function serializeAttendees(ids: number[], extra: string) {
    return JSON.stringify({ contactIds: ids, extra });
  }
  function parseAttendees(raw: string | null) {
    if (!raw) return { contactIds: [] as number[], extra: "" };
    try { return JSON.parse(raw) as { contactIds: number[]; extra: string }; } catch { return { contactIds: [], extra: raw }; }
  }
  function attendeeNames(raw: string | null, contacts: ProdContact[]) {
    const { contactIds, extra } = parseAttendees(raw);
    const names = contactIds.map(cid => contacts.find(c => c.id === cid)?.name).filter(Boolean) as string[];
    if (extra.trim()) names.push(...extra.split(",").map(s => s.trim()).filter(Boolean));
    return names;
  }

  async function reloadMeetings() {
    await Promise.all([reloadMeetingList(), reloadMeetingContacts()]);
  }

  function openMeetingForm(m?: Meeting) {
    if (m) {
      const { contactIds, extra } = parseAttendees(m.attendees);
      setEditingMeeting(m);
      setMeetingForm({ title: m.title, meetingDate: m.meetingDate.slice(0, 16), location: m.location || "", attendees: m.attendees || "", agenda: m.agenda || "", minutes: m.minutes || "", recordingUrl: m.recordingUrl || "" });
      setMeetingTranscript(m.transcript || "");
      setMeetingAttendeeIds(contactIds);
      setMeetingAttendeeExtra(extra);
    } else {
      setEditingMeeting(null);
      setMeetingForm(BLANK_MEETING);
      setMeetingAttendeeIds([]);
      setMeetingAttendeeExtra("");
      setMeetingTranscript("");
    }
    setShowMeetingForm(true);
  }

  async function saveMeeting(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...meetingForm, transcript: meetingTranscript, attendees: serializeAttendees(meetingAttendeeIds, meetingAttendeeExtra) };
    if (editingMeeting) {
      await sendJson(`/api/meetings/${editingMeeting.id}`, "PUT", payload);
    } else {
      await sendJson(`/api/productions/${id}/meetings`, "POST", payload);
    }
    setShowMeetingForm(false);
    setEditingMeeting(null);
    setMeetingTranscript("");
    stopRecording();
    reloadMeetings();
  }

  async function deleteMeeting(mid: number) {
    if (!await confirmDialog("Delete this meeting?")) return;
    await fetch(`/api/meetings/${mid}`, { method: "DELETE" });
    reloadMeetings();
  }

  function startRecording() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alertDialog("Your browser doesn't support live transcription. Please use Chrome."); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-GB";
    recognition.onresult = (e: any) => {
      const text = Array.from(e.results).slice(e.resultIndex).map((r: any) => r[0].transcript).join(" ");
      setMeetingTranscript(prev => prev + (prev ? " " : "") + text);
    };
    recognition.start();
    recognitionRef.current = recognition;
    setMeetingRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setMeetingRecording(false);
  }

  async function generateMinutes(meetingId?: number) {
    const transcript = meetingTranscript.trim();
    if (!transcript) { alertDialog("No transcript to generate minutes from."); return; }
    setGeneratingMinutes(true);
    try {
      const mid = meetingId ?? editingMeeting?.id ?? 0;
      const res = await sendJson(`/api/meetings/${mid || "_"}/generate-minutes`, "POST", {
          productionId: prod.id, // checked when the meeting isn't saved yet
          transcript,
          agenda: meetingForm.agenda,
          title: meetingForm.title,
          attendees: attendeeNames(serializeAttendees(meetingAttendeeIds, meetingAttendeeExtra), meetingContacts).join(", "),
          meetingDate: meetingForm.meetingDate,
        });
      const data = await res.json();
      if (data.minutes) setMeetingForm(f => ({ ...f, minutes: data.minutes }));
    } finally {
      setGeneratingMinutes(false);
    }
  }

  function toggleMeetingSection(mid: number, section: "agenda" | "minutes") {
    setExpandedMeetings(prev => ({ ...prev, [mid]: { ...prev[mid], [section]: !prev[mid]?.[section] } }));
  }

  function exportMeetingPDF(m: Meeting) {
    const names = attendeeNames(m.attendees, meetingContacts);
    exportMeetingMinutesPDF(m, names, prod?.name ?? "", prod?.logoUrl);
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: "var(--psg-text)", fontSize: 18, fontWeight: 600 }}>Meetings</h2>
        {canEdit && (
          <button onClick={() => openMeetingForm()} className="px-3 py-1.5 rounded text-sm font-medium" style={{ background: "var(--psg-blue)", color: "#fff" }}>
            + New Meeting
          </button>
        )}
      </div>

      {showMeetingForm && (
        <form onSubmit={saveMeeting} style={{ background: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input required placeholder="Title *" value={meetingForm.title} onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))} className={inp} style={inpStyle} />
              </div>
              <input required type="datetime-local" value={meetingForm.meetingDate} onChange={e => setMeetingForm(f => ({ ...f, meetingDate: e.target.value }))} className={inp} style={inpStyle} />
              <input placeholder="Location" value={meetingForm.location} onChange={e => setMeetingForm(f => ({ ...f, location: e.target.value }))} className={inp} style={inpStyle} />
              <input type="url" aria-label="Recording link" placeholder="Recording link (Zoom, Teams, OneDrive…)" value={meetingForm.recordingUrl} onChange={e => setMeetingForm(f => ({ ...f, recordingUrl: e.target.value }))} className={`${inp} col-span-2`} style={inpStyle} />
            </div>

            <div>
              <p style={{ color: "var(--psg-muted)", fontSize: 12, marginBottom: 6 }}>Attendees</p>
              {meetingContacts.length > 0 && (() => {
                const sections = Array.from(new Set(meetingContacts.map(c => c.section)));
                return (
                  <div style={{ border: "1px solid var(--psg-card-border)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
                    {sections.map((sec, si) => {
                      const secContacts = meetingContacts.filter(c => c.section === sec);
                      const allChecked = secContacts.every(c => meetingAttendeeIds.includes(c.id));
                      const anyChecked = secContacts.some(c => meetingAttendeeIds.includes(c.id));
                      return (
                        <details key={sec} style={{ borderTop: si > 0 ? "1px solid var(--psg-card-border)" : undefined }}>
                          <summary style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--psg-text)", listStyle: "none", userSelect: "none" }}>
                            <span style={{ flex: 1 }}>{sec}</span>
                            {anyChecked && <span style={{ fontSize: 11, color: "var(--psg-blue)" }}>{secContacts.filter(c => meetingAttendeeIds.includes(c.id)).length}/{secContacts.length}</span>}
                            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--psg-muted)", cursor: "pointer" }} onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={allChecked} onChange={e => {
                                if (e.target.checked) setMeetingAttendeeIds(prev => [...new Set([...prev, ...secContacts.map(c => c.id)])]);
                                else setMeetingAttendeeIds(prev => prev.filter(id => !secContacts.find(c => c.id === id)));
                              }} />
                              All
                            </label>
                          </summary>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6, padding: "8px 12px 10px", backgroundColor: "rgba(0,0,0,0.15)" }}>
                            {secContacts.map(c => (
                              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--psg-text)" }}>
                                <input type="checkbox" checked={meetingAttendeeIds.includes(c.id)}
                                  onChange={e => setMeetingAttendeeIds(prev => e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id))} />
                                <span>{c.name}{c.role ? ` (${c.role})` : ""}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                );
              })()}
              <input placeholder="Additional attendees (comma-separated)" value={meetingAttendeeExtra} onChange={e => setMeetingAttendeeExtra(e.target.value)} className={inp} style={inpStyle} />
            </div>

            <textarea placeholder="Agenda" value={meetingForm.agenda} onChange={e => setMeetingForm(f => ({ ...f, agenda: e.target.value }))} rows={4} className={inp} style={{ ...inpStyle, resize: "vertical" }} />
            <div style={{ border: "1px solid var(--psg-card-border)", borderRadius: 6, padding: 10 }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: "var(--psg-muted)", fontSize: 12, fontWeight: 500 }}>GENERATE MINUTES FROM TRANSCRIPT</span>
                <div className="flex gap-2 ml-auto">
                  {!meetingRecording ? (
                    <button type="button" onClick={startRecording} className="px-3 py-1 rounded text-xs font-medium" style={{ background: "#ef4444", color: "#fff" }}>
                      🎙 Record
                    </button>
                  ) : (
                    <button type="button" onClick={stopRecording} className="px-3 py-1 rounded text-xs font-medium" style={{ background: "#6b7280", color: "#fff" }}>
                      ⏹ Stop
                    </button>
                  )}
                  <button type="button" onClick={() => transcriptFileRef.current?.click()} className="px-3 py-1 rounded text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "var(--psg-text)", border: "1px solid var(--psg-card-border)" }}>
                    📄 Upload transcript
                  </button>
                  <input ref={transcriptFileRef} type="file" accept=".vtt,.srt,.txt,text/vtt,text/plain" className="hidden" onChange={e => { loadTranscriptFile(e.target.files?.[0]); e.target.value = ""; }} />
                  <button type="button" onClick={() => generateMinutes()} disabled={generatingMinutes || !meetingTranscript.trim()}
                    className="px-3 py-1 rounded text-xs font-medium"
                    style={{ background: generatingMinutes || !meetingTranscript.trim() ? "rgba(255,255,255,0.06)" : "#8b5cf6", color: generatingMinutes || !meetingTranscript.trim() ? "var(--psg-muted)" : "#fff", border: "1px solid var(--psg-card-border)", opacity: generatingMinutes || !meetingTranscript.trim() ? 0.6 : 1 }}>
                    {generatingMinutes ? "Generating…" : "✨ Generate"}
                  </button>
                  {meetingTranscript && <button type="button" onClick={() => setMeetingTranscript("")} className="px-2 py-1 rounded text-xs" style={{ color: "var(--psg-muted)", background: "none", border: "none", cursor: "pointer" }}>Clear</button>}
                </div>
              </div>
              {meetingRecording && <p style={{ color: "#ef4444", fontSize: 11, marginBottom: 4 }}>● Recording… speak clearly</p>}
              <textarea placeholder="Transcript appears here as you record. Or upload a Zoom/Teams transcript (.vtt) or Word transcript (.txt), or paste one. It's saved with the meeting." value={meetingTranscript} onChange={e => setMeetingTranscript(e.target.value)}
                rows={3} className={inp} style={{ ...inpStyle, fontSize: 12, resize: "vertical" }} />
            </div>
            <textarea placeholder="Minutes" value={meetingForm.minutes} onChange={e => setMeetingForm(f => ({ ...f, minutes: e.target.value }))} rows={4} className={inp} style={{ ...inpStyle, resize: "vertical" }} />

            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1.5 rounded text-sm font-medium" style={{ background: "#10b981", color: "#fff" }}>
                {editingMeeting ? "Save" : "Create"}
              </button>
              <button type="button" onClick={() => { setShowMeetingForm(false); setEditingMeeting(null); }} className="px-3 py-1.5 rounded text-sm" style={{ background: "rgba(255,255,255,0.1)", color: "var(--psg-text)", border: "1px solid var(--psg-card-border)" }}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {meetings.length === 0 && !showMeetingForm ? (
        <p style={{ color: "var(--psg-muted)", fontSize: 14 }}>No meetings yet.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => {
            const exp = expandedMeetings[m.id] ?? {};
            const names = attendeeNames(m.attendees, meetingContacts);
            const dt = new Date(m.meetingDate);
            return (
              <div key={m.id} style={{ background: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)", borderRadius: 8, overflow: "hidden" }}>
                <div className="flex items-start justify-between gap-3" style={{ padding: "12px 16px" }}>
                  <div>
                    <p style={{ color: "var(--psg-text)", fontWeight: 600, fontSize: 15 }}>{m.title}</p>
                    <p style={{ color: "var(--psg-muted)", fontSize: 13, marginTop: 2 }}>
                      {dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      {" · "}{dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      {m.location ? ` · ${m.location}` : ""}
                    </p>
                    {names.length > 0 && (
                      <p style={{ color: "var(--psg-muted)", fontSize: 12, marginTop: 4 }}>👥 {names.join(", ")}</p>
                    )}
                    {m.recordingUrl && (
                      <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs mt-1 text-blue-300 hover:underline">▶ Watch the recording</a>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
                    {m.minutes && (
                      <button onClick={() => exportMeetingPDF(m)} title="Export PDF" className="px-2 py-1 rounded text-xs border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>↓ PDF</button>
                    )}
                    {canEdit && (<>
                      <button onClick={() => openMeetingForm(m)} style={{ color: "var(--psg-muted)", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>✏️</button>
                      <button onClick={() => deleteMeeting(m.id)} style={{ color: "#ef4444", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>🗑</button>
                    </>)}
                  </div>
                </div>

                {m.agenda && (
                  <div style={{ borderTop: "1px solid var(--psg-card-border)" }}>
                    <button onClick={() => toggleMeetingSection(m.id, "agenda")} className="w-full flex items-center justify-between" style={{ padding: "8px 16px", background: "none", border: "none", cursor: "pointer", color: "var(--psg-text)", fontSize: 13, fontWeight: 500 }}>
                      <span>📋 Agenda</span>
                      <span style={{ color: "var(--psg-muted)" }}>{exp.agenda ? "▲" : "▼"}</span>
                    </button>
                    {exp.agenda && (
                      <div style={{ padding: "8px 16px 12px", color: "var(--psg-muted)", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.agenda}</div>
                    )}
                  </div>
                )}

                {m.minutes && (
                  <div style={{ borderTop: "1px solid var(--psg-card-border)" }}>
                    <button onClick={() => toggleMeetingSection(m.id, "minutes")} className="w-full flex items-center justify-between" style={{ padding: "8px 16px", background: "none", border: "none", cursor: "pointer", color: "var(--psg-text)", fontSize: 13, fontWeight: 500 }}>
                      <span>📝 Minutes</span>
                      <span style={{ color: "var(--psg-muted)" }}>{exp.minutes ? "▲" : "▼"}</span>
                    </button>
                    {exp.minutes && (
                      <div style={{ padding: "8px 16px 12px", color: "var(--psg-muted)", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.minutes}</div>
                    )}
                  </div>
                )}

                {m.transcript && (
                  <div style={{ borderTop: "1px solid var(--psg-card-border)" }}>
                    <button onClick={() => setExpandedMeetings(prev => ({ ...prev, [m.id]: { ...prev[m.id], transcript: !prev[m.id]?.transcript } }))} className="w-full flex items-center justify-between" style={{ padding: "8px 16px", background: "none", border: "none", cursor: "pointer", color: "var(--psg-text)", fontSize: 13, fontWeight: 500 }}>
                      <span>🗒 Transcript</span>
                      <span style={{ color: "var(--psg-muted)" }}>{exp.transcript ? "▲" : "▼"}</span>
                    </button>
                    {exp.transcript && (
                      <div style={{ padding: "8px 16px 12px", color: "var(--psg-muted)", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 420, overflowY: "auto" }}>{m.transcript}</div>
                    )}
                  </div>
                )}

                {/* Action items from the minutes, and the tasks made from them */}
                <MeetingActions meetingId={m.id} hasMinutes={!!m.minutes?.trim()} canEdit={canEdit} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
