"use client";

import { useEffect, useState } from "react";

type QuickLink = { id: number; label: string; url: string; icon: string; order: number };

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

export default function AdminSettingsPage() {
  const [news, setNews] = useState("");
  const [newsSaved, setNewsSaved] = useState(false);
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [addForm, setAddForm] = useState({ label: "", url: "", icon: "🔗" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => { if (d?.news) setNews(d.news); });
    fetch("/api/quicklinks").then(r => r.json()).then(d => { if (Array.isArray(d)) setLinks(d); });
  }, []);

  async function saveNews(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "news", value: news }) });
    setNewsSaved(true);
    setTimeout(() => setNewsSaved(false), 2000);
  }

  async function clearNews() {
    await fetch("/api/settings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "news" }) });
    setNews("");
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/quicklinks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...addForm, order: links.length }) });
    const link = await res.json();
    setLinks(l => [...l, link]);
    setAddForm({ label: "", url: "", icon: "🔗" });
    setAdding(false);
  }

  async function deleteLink(id: number) {
    await fetch("/api/quicklinks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setLinks(l => l.filter(x => x.id !== id));
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-white">Hub Settings</h1>

      {/* News banner */}
      <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <h2 className="font-semibold text-white">News Banner</h2>
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
          Shown at the top of the home screen for all users. Leave blank to hide it.
        </p>
        <form onSubmit={saveNews} className="space-y-3">
          <input
            value={news}
            onChange={e => setNews(e.target.value)}
            placeholder="e.g. Office will be closed on 25 Dec — Merry Christmas!"
            className={inp}
            style={inpStyle}
          />
          <div className="flex gap-2">
            <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
              {newsSaved ? "Saved ✓" : "Save banner"}
            </button>
            {news && (
              <button type="button" onClick={clearNews} className="border px-4 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Quick links */}
      <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Quick Links</h2>
          <button onClick={() => setAdding(a => !a)} className="text-sm px-3 py-1.5 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            + Add link
          </button>
        </div>

        {adding && (
          <form onSubmit={addLink} className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-dark-bg)" }}>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Icon (emoji)</label>
                <input value={addForm.icon} onChange={e => setAddForm(f => ({ ...f, icon: e.target.value }))} className={inp} style={inpStyle} maxLength={2} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Label</label>
                <input required value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} placeholder="Google Drive" className={inp} style={inpStyle} />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>URL</label>
              <input required value={addForm.url} onChange={e => setAddForm(f => ({ ...f, url: e.target.value }))} placeholder="https://drive.google.com/…" className={inp} style={inpStyle} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Add</button>
              <button type="button" onClick={() => setAdding(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        )}

        {links.length === 0 && !adding && (
          <p className="text-sm" style={{ color: "var(--psg-muted)" }}>No quick links yet. Add links to external tools, documents or resources.</p>
        )}

        <div className="space-y-2">
          {links.map(l => (
            <div key={l.id} className="flex items-center gap-3 rounded-lg border px-4 py-3" style={{ borderColor: "var(--psg-card-border)" }}>
              <span className="text-lg">{l.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{l.label}</div>
                <div className="text-xs truncate" style={{ color: "var(--psg-muted)" }}>{l.url}</div>
              </div>
              <button onClick={() => deleteLink(l.id)} className="text-xs hover:text-red-400 transition-colors shrink-0" style={{ color: "var(--psg-muted)" }}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
