"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

type UserInfo = { id: number; name: string; avatarUrl: string | null };
type RoadmapItem = {
  id: number;
  title: string;
  body: string | null;
  category: string;
  status: string;
  pinned: boolean;
  createdAt: string;
  createdByUser: UserInfo | null;
};

const STATUSES = [
  { key: "idea", label: "Ideas", color: "text-yellow-300", bg: "bg-yellow-900/20", border: "border-yellow-800/40" },
  { key: "planned", label: "Planned", color: "text-blue-300", bg: "bg-blue-900/20", border: "border-blue-800/40" },
  { key: "in_progress", label: "In Progress", color: "text-purple-300", bg: "bg-purple-900/20", border: "border-purple-800/40" },
  { key: "done", label: "Done", color: "text-green-300", bg: "bg-green-900/20", border: "border-green-800/40" },
  { key: "wont_do", label: "Won't Do", color: "text-white/40", bg: "bg-white/5", border: "border-white/10" },
];

const CATEGORIES = ["general", "feature", "improvement", "bug", "infrastructure"];
const CAT_LABELS: Record<string, string> = {
  general: "General", feature: "Feature", improvement: "Improvement", bug: "Bug", infrastructure: "Infrastructure",
};
const CAT_COLORS: Record<string, string> = {
  general: "bg-white/10 text-white/60",
  feature: "bg-blue-900/60 text-blue-300",
  improvement: "bg-teal-900/60 text-teal-300",
  bug: "bg-red-900/60 text-red-300",
  infrastructure: "bg-orange-900/60 text-orange-300",
};

function Avatar({ user }: { user: UserInfo | null }) {
  if (!user) return null;
  const initials = user.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-white shrink-0 relative" style={{ backgroundColor: "var(--psg-blue)" }} title={user.name}>
      {user.avatarUrl ? <Image src={user.avatarUrl} alt={user.name} fill className="object-cover" /> : initials}
    </div>
  );
}

export default function RoadmapPage() {
  const { data: session } = useSession();
  const userId = Number((session?.user as any)?.id);
  const isAdmin = (session?.user as any)?.role === "admin";

  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<RoadmapItem | null>(null);
  const BLANK = { title: "", body: "", category: "general", status: "idea" };
  const [form, setForm] = useState(BLANK);

  async function reload() {
    const data = await fetch("/api/roadmap").then(r => r.json());
    if (Array.isArray(data)) setItems(data);
  }

  useEffect(() => { reload(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (editItem) {
      await fetch(`/api/roadmap/${editItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/roadmap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setShowForm(false);
    setEditItem(null);
    setForm(BLANK);
    reload();
  }

  async function moveStatus(item: RoadmapItem, status: string) {
    await fetch(`/api/roadmap/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    reload();
  }

  async function togglePin(item: RoadmapItem) {
    await fetch(`/api/roadmap/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !item.pinned }) });
    reload();
  }

  async function deleteItem(item: RoadmapItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    await fetch(`/api/roadmap/${item.id}`, { method: "DELETE" });
    reload();
  }

  const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
  const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roadmap</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>Ideas, plans, and things to build</p>
        </div>
        <button
          onClick={() => { setEditItem(null); setForm(BLANK); setShowForm(true); }}
          className="text-sm px-4 py-2 rounded text-white font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--psg-blue)" }}
        >+ Add Idea</button>
      </div>

      {/* New/Edit form */}
      {showForm && (
        <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          <h2 className="text-sm font-semibold text-white">{editItem ? "Edit Item" : "New Idea"}</h2>
          <form onSubmit={save} className="space-y-3">
            <input required className={inp} style={inpStyle} placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <textarea className={inp} style={inpStyle} placeholder="Description (optional)" rows={3} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
            <div className="flex gap-3">
              <select className={inp} style={inpStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
              <select className={inp} style={inpStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 rounded text-sm text-white font-medium" style={{ backgroundColor: "var(--psg-blue)" }}>
                {editItem ? "Save Changes" : "Add to Roadmap"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditItem(null); setForm(BLANK); }}
                className="px-4 py-2 rounded text-sm border hover:bg-white/5"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {STATUSES.map(col => {
          const colItems = items.filter(i => i.status === col.key);
          return (
            <div key={col.key}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 border ${col.bg} ${col.border}`}>
                <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{colItems.length}</span>
              </div>

              <div className="space-y-3">
                {colItems.map(item => (
                  <div key={item.id} className="rounded-lg border p-4 group" style={{ borderColor: item.pinned ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${CAT_COLORS[item.category] ?? "bg-white/10 text-white/60"}`}>
                        {CAT_LABELS[item.category] ?? item.category}
                      </span>
                      {item.pinned && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-900/60 text-blue-300 shrink-0">Pinned</span>}
                    </div>
                    <p className="text-sm font-medium text-white mb-1">{item.title}</p>
                    {item.body && <p className="text-xs mb-2 leading-relaxed" style={{ color: "var(--psg-muted)" }}>{item.body}</p>}

                    <div className="flex items-center gap-2 mt-3">
                      <Avatar user={item.createdByUser} />
                      <span className="text-[10px] flex-1" style={{ color: "var(--psg-muted)" }}>
                        {item.createdByUser?.name ?? "Unknown"} · {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      {STATUSES.filter(s => s.key !== item.status).map(s => (
                        <button key={s.key} onClick={() => moveStatus(item, s.key)}
                          className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-white/10 transition-colors"
                          style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                          → {s.label}
                        </button>
                      ))}
                      {(isAdmin || item.createdByUser?.id === userId) && (
                        <>
                          <button onClick={() => { setEditItem(item); setForm({ title: item.title, body: item.body ?? "", category: item.category, status: item.status }); setShowForm(true); }}
                            className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-white/10 transition-colors"
                            style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
                          {isAdmin && (
                            <button onClick={() => togglePin(item)}
                              className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-white/10 transition-colors"
                              style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>{item.pinned ? "Unpin" : "Pin"}</button>
                          )}
                          <button onClick={() => deleteItem(item)}
                            className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-red-900/20 text-red-400 transition-colors"
                            style={{ borderColor: "rgba(248,113,113,0.3)" }}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {colItems.length === 0 && (
                  <div className="rounded-lg border border-dashed flex items-center justify-center py-8" style={{ borderColor: "var(--psg-card-border)" }}>
                    <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Nothing here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
