"use client";

import { useRef, useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { inp, inpStyle, sendJson, useList, type TabProps } from "../shared";

export default function NotesTab({ prod, canEdit }: TabProps & { canEdit: boolean }) {
  const id = String(prod.id);
  type ProdNote = { id: number; title: string; body: string; color: string | null; order: number; createdByUserId: number | null; createdByUser: { id: number; name: string; avatarUrl: string | null } | null; createdAt: string; updatedAt: string };
  const [notes, setNotes, reloadNotes] = useList<ProdNote>(`/api/productions/${id}/notes`);
  const [noteForm, setNoteForm] = useState({ title: "", body: "", color: "" });
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState<ProdNote | null>(null);
  const dragNote = useRef<number | null>(null);
  const dragOverNote = useRef<number | null>(null);



  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (editingNote) {
      await sendJson(`/api/production-notes/${editingNote.id}`, "PUT", noteForm);
    } else {
      await sendJson(`/api/productions/${id}/notes`, "POST", noteForm);
    }
    setNoteForm({ title: "", body: "", color: "" });
    setShowNoteForm(false);
    setEditingNote(null);
    reloadNotes();
  }

  async function deleteNote(noteId: number) {
    if (!await confirmDialog("Delete this note?")) return;
    await fetch(`/api/production-notes/${noteId}`, { method: "DELETE" });
    reloadNotes();
  }

  async function handleNoteDrop() {
    if (dragNote.current === null || dragOverNote.current === null || dragNote.current === dragOverNote.current) return;
    const reordered = [...notes];
    const from = reordered.findIndex(n => n.id === dragNote.current);
    const to = reordered.findIndex(n => n.id === dragOverNote.current);
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setNotes(reordered);
    dragNote.current = null;
    dragOverNote.current = null;
    await sendJson(`/api/productions/${id}/notes`, "PATCH", { ids: reordered.map(n => n.id) });
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: "var(--psg-text)", fontSize: 18, fontWeight: 600 }}>Notes</h2>
        {canEdit && (
          <button onClick={() => { setEditingNote(null); setNoteForm({ title: "", body: "", color: "" }); setShowNoteForm(true); }}
            className="px-3 py-1.5 rounded text-sm font-medium"
            style={{ background: "var(--psg-blue)", color: "#fff" }}>
            + Add Note
          </button>
        )}
      </div>

      {showNoteForm && (
        <form onSubmit={saveNote} style={{ background: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div className="space-y-3">
            <input required placeholder="Title" value={noteForm.title} onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))}
              className={inp} style={inpStyle} />
            <textarea placeholder="Body (optional)" value={noteForm.body} onChange={e => setNoteForm(f => ({ ...f, body: e.target.value }))}
              rows={4} className={inp} style={{ ...inpStyle, resize: "vertical" }} />
            <div className="flex items-center gap-2">
              <label style={{ color: "var(--psg-muted)", fontSize: 13 }}>Colour:</label>
              {["", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"].map(c => (
                <button key={c} type="button" onClick={() => setNoteForm(f => ({ ...f, color: c }))}
                  style={{ width: 20, height: 20, borderRadius: "50%", background: c || "var(--psg-card-border)", border: noteForm.color === c ? "2px solid var(--psg-text)" : "2px solid transparent", cursor: "pointer" }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1.5 rounded text-sm font-medium" style={{ background: "#10b981", color: "#fff" }}>
                {editingNote ? "Save" : "Add"}
              </button>
              <button type="button" onClick={() => { setShowNoteForm(false); setEditingNote(null); }} className="px-3 py-1.5 rounded text-sm" style={{ background: "rgba(255,255,255,0.1)", color: "var(--psg-text)", border: "1px solid var(--psg-card-border)" }}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {notes.length === 0 && !showNoteForm ? (
        <p style={{ color: "var(--psg-muted)", fontSize: 14 }}>No notes yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {notes.map(note => (
            <div key={note.id}
              draggable
              onDragStart={() => { dragNote.current = note.id; }}
              onDragEnter={() => { dragOverNote.current = note.id; }}
              onDragEnd={handleNoteDrop}
              onDragOver={e => e.preventDefault()}
              style={{ background: "var(--psg-card-bg)", border: `1px solid ${note.color || "var(--psg-card-border)"}`, borderTopWidth: note.color ? 3 : 1, borderRadius: 8, padding: 16, cursor: "grab" }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 style={{ color: "var(--psg-text)", fontWeight: 600, fontSize: 15 }}>{note.title}</h3>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingNote(note); setNoteForm({ title: note.title, body: note.body, color: note.color || "" }); setShowNoteForm(true); }}
                      style={{ color: "var(--psg-muted)", fontSize: 12, cursor: "pointer", background: "none", border: "none" }}>✏️</button>
                    <button onClick={() => deleteNote(note.id)}
                      style={{ color: "#ef4444", fontSize: 12, cursor: "pointer", background: "none", border: "none" }}>🗑</button>
                  </div>
                )}
              </div>
              <p style={{ color: "var(--psg-muted)", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{note.body}</p>
              <p style={{ color: "var(--psg-muted)", fontSize: 11, marginTop: 10 }}>
                {note.createdByUser?.name} · {new Date(note.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
