"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = ["Play", "Musical", "Opera", "Dance", "Comedy", "Drama", "Physical Theatre", "Other"];
const STATUSES = ["planning", "in-production", "closed"];
const ANN_OPTS: Record<string, string> = { nda: "NDA", not_announced: "Not Announced", on_sale: "On Sale", open: "Open" };

const field = "w-full rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 border";
const fieldStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)", outlineColor: "var(--psg-blue)" };

export default function NewProductionPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", type: "Play", venue: "", startDate: "", endDate: "", status: "planning", announcementStatus: "not_announced", notes: "" });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/productions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    router.push(`/productions/${data.id}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-white">New Production</h1>
      <form onSubmit={submit} className="rounded-lg border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Production Name *</label>
          <input required className={field} style={fieldStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Hamlet" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type *</label>
            <select className={field} style={fieldStyle} value={form.type} onChange={(e) => set("type", e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Status</label>
            <select className={field} style={fieldStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Announcement</label>
            <select className={field} style={fieldStyle} value={form.announcementStatus} onChange={(e) => set("announcementStatus", e.target.value)}>
              {Object.entries(ANN_OPTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Venue</label>
          <input className={field} style={fieldStyle} value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. The Lyric Theatre" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Start Date</label>
            <input type="date" className={field} style={fieldStyle} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>End Date</label>
            <input type="date" className={field} style={fieldStyle} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
          <textarea rows={3} className={field} style={fieldStyle} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="text-white px-5 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
            {saving ? "Creating…" : "Create Production"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2 rounded text-sm font-medium border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
