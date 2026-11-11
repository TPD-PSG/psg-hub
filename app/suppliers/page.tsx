"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Supplier = {
  id: number; name: string; category: string;
  contactName: string | null; email: string | null; phone: string | null;
  website: string | null; address: string | null; notes: string | null;
};

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "venue", label: "Venues" },
  { key: "contractor", label: "Contractors" },
  { key: "equipment", label: "Equipment" },
  { key: "transport", label: "Transport" },
  { key: "catering", label: "Catering" },
  { key: "marketing", label: "Marketing" },
  { key: "legal", label: "Legal" },
  { key: "insurance", label: "Insurance" },
  { key: "other", label: "Other" },
];

const CAT_COLORS: Record<string, string> = {
  venue: "bg-blue-900/50 text-blue-300",
  contractor: "bg-purple-900/50 text-purple-300",
  equipment: "bg-orange-900/50 text-orange-300",
  transport: "bg-cyan-900/50 text-cyan-300",
  catering: "bg-green-900/50 text-green-300",
  marketing: "bg-pink-900/50 text-pink-300",
  legal: "bg-yellow-900/50 text-yellow-300",
  insurance: "bg-teal-900/50 text-teal-300",
  other: "bg-gray-800 text-gray-400",
};

const inp = "w-full rounded-lg px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--psg-card-border)" };

const BLANK: Omit<Supplier, "id"> = {
  name: "", category: "other", contactName: "", email: "", phone: "", website: "", address: "", notes: "",
};

export default function SuppliersPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<Supplier, "id">>(BLANK);
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await fetch("/api/suppliers");
    const d = await r.json();
    if (Array.isArray(d)) setSuppliers(d);
  }

  useEffect(() => { load(); }, []);

  function startAdd() {
    setForm(BLANK);
    setEditing(null);
    setAdding(true);
  }

  function startEdit(s: Supplier) {
    setForm({ name: s.name, category: s.category, contactName: s.contactName ?? "", email: s.email ?? "", phone: s.phone ?? "", website: s.website ?? "", address: s.address ?? "", notes: s.notes ?? "" });
    setAdding(false);
    setEditing(s);
  }

  function cancel() { setAdding(false); setEditing(null); }

  async function save() {
    setSaving(true);
    const payload = { ...form, contactName: form.contactName || null, email: form.email || null, phone: form.phone || null, website: form.website || null, address: form.address || null, notes: form.notes || null };
    if (editing) {
      await fetch(`/api/suppliers/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    await load();
    cancel();
    setSaving(false);
  }

  async function del(id: number) {
    if (!confirm("Delete this supplier?")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    setSuppliers(s => s.filter(x => x.id !== id));
  }

  const visible = suppliers.filter(s => {
    if (catFilter !== "all" && s.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.contactName ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Supplier Register</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} on record</p>
        </div>
        {role === "admin" && !adding && !editing && (
          <button onClick={startAdd} className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
            + Add Supplier
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {(adding || editing) && (
        <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <h2 className="font-semibold text-white">{editing ? "Edit Supplier" : "New Supplier"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} style={inpStyle} placeholder="Supplier name" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp} style={inpStyle}>
                {CATEGORIES.filter(c => c.key !== "all").map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Contact name</label>
              <input value={form.contactName ?? ""} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className={inp} style={inpStyle} placeholder="Contact person" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Email</label>
              <input type="email" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} style={inpStyle} placeholder="contact@example.com" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Phone</label>
              <input value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} style={inpStyle} placeholder="+44 7700 900000" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Website</label>
              <input value={form.website ?? ""} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className={inp} style={inpStyle} placeholder="https://…" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Address</label>
              <input value={form.address ?? ""} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inp} style={inpStyle} placeholder="Street, City, Postcode" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
              <textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inp} style={inpStyle} placeholder="Any useful notes…" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={!form.name.trim() || saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add supplier"}
            </button>
            <button onClick={cancel} className="px-4 py-2 rounded-lg text-sm border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search suppliers…"
          className="sm:w-64 rounded-lg px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500"
          style={inpStyle}
        />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCatFilter(c.key)}
              className="px-3 py-1.5 rounded-lg text-xs border transition-colors"
              style={{
                borderColor: catFilter === c.key ? "var(--psg-blue)" : "var(--psg-card-border)",
                backgroundColor: catFilter === c.key ? "rgba(59,130,246,0.15)" : "transparent",
                color: catFilter === c.key ? "white" : "var(--psg-muted)",
              }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Supplier cards */}
      {visible.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
            {suppliers.length === 0 ? "No suppliers yet. Add your first one above." : "No suppliers match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(s => (
            <div key={s.id} className="rounded-xl border p-5 flex flex-col gap-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{s.name}</h3>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[s.category] ?? CAT_COLORS.other}`}>
                    {CATEGORIES.find(c => c.key === s.category)?.label ?? s.category}
                  </span>
                </div>
                {role === "admin" && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(s)} className="text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
                    <button onClick={() => del(s.id)} className="text-xs px-2 py-1 rounded border border-red-900/40 text-red-400 hover:bg-red-900/20 transition-colors">Del</button>
                  </div>
                )}
              </div>

              <div className="space-y-1 text-sm">
                {s.contactName && <div className="flex gap-2"><span style={{ color: "var(--psg-muted)" }}>Contact</span><span className="text-white">{s.contactName}</span></div>}
                {s.phone && <div className="flex gap-2"><span style={{ color: "var(--psg-muted)" }}>Phone</span><a href={`tel:${s.phone}`} className="text-blue-400 hover:text-blue-300">{s.phone}</a></div>}
                {s.email && <div className="flex gap-2 min-w-0"><span style={{ color: "var(--psg-muted)" }} className="shrink-0">Email</span><a href={`mailto:${s.email}`} className="text-blue-400 hover:text-blue-300 truncate">{s.email}</a></div>}
                {s.website && <div className="flex gap-2 min-w-0"><span style={{ color: "var(--psg-muted)" }} className="shrink-0">Web</span><a href={s.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">{s.website.replace(/^https?:\/\//, "")}</a></div>}
                {s.address && <div className="flex gap-2"><span style={{ color: "var(--psg-muted)" }}>Address</span><span className="text-white/70 text-xs">{s.address}</span></div>}
              </div>

              {s.notes && (
                <p className="text-xs pt-2 border-t" style={{ color: "var(--psg-muted)", borderColor: "var(--psg-card-border)" }}>{s.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
