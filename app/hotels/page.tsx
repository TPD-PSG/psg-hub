"use client";

import { useEffect, useState } from "react";

type Hotel = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  _count: { bookings: number };
};

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
const BLANK = { name: "", city: "", address: "", phone: "", email: "", website: "", notes: "" };

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editHotel, setEditHotel] = useState<Hotel | null>(null);
  const [form, setForm] = useState<typeof BLANK & { id?: number }>(BLANK);
  const [search, setSearch] = useState("");

  useEffect(() => { reload(); }, []);

  async function reload() {
    const data = await fetch("/api/hotels").then((r) => r.json());
    setHotels(data);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.id) {
      await fetch(`/api/hotels/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/hotels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setShowForm(false);
    setEditHotel(null);
    setForm(BLANK);
    reload();
  }

  async function deleteHotel(id: number, name: string) {
    if (!confirm(`Delete ${name}? This will also remove all its bookings.`)) return;
    await fetch(`/api/hotels/${id}`, { method: "DELETE" });
    reload();
  }

  function openEdit(h: Hotel) {
    setForm({ ...h, city: h.city ?? "", address: h.address ?? "", phone: h.phone ?? "", email: h.email ?? "", website: h.website ?? "", notes: h.notes ?? "" });
    setEditHotel(h);
    setShowForm(true);
  }

  const filtered = hotels.filter((h) =>
    !search || h.name.toLowerCase().includes(search.toLowerCase()) || (h.city ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Hotels</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{hotels.length} in directory</p>
        </div>
        <button onClick={() => { setForm(BLANK); setEditHotel(null); setShowForm(true); }} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
          + Add Hotel
        </button>
      </div>

      <input className={inp + " max-w-xs"} style={inpStyle} placeholder="Search name or city…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 ? (
        <p className="text-center py-16" style={{ color: "var(--psg-muted)" }}>{hotels.length === 0 ? "No hotels in the directory yet." : "No results."}</p>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3 text-left font-medium text-white">Hotel</th>
                <th className="px-4 py-3 text-left font-medium text-white">City</th>
                <th className="px-4 py-3 text-left font-medium text-white">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-white">Bookings</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{h.name}</p>
                    {h.address && <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{h.address}</p>}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{h.city || "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                    {h.phone && <div>{h.phone}</div>}
                    {h.email && <div>{h.email}</div>}
                    {h.website && <div><a href={h.website} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--psg-blue)" }}>{h.website}</a></div>}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>{h._count.bookings}</td>
                  <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(h)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                      <button onClick={() => deleteHotel(h.id, h.name)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold text-white">{editHotel ? "Edit Hotel" : "Add Hotel"}</h2>
              <button onClick={() => { setShowForm(false); setForm(BLANK); }} className="text-xl hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <form onSubmit={save} className="px-5 py-4 space-y-3">
              <F label="Name *"><input required className={inp} style={inpStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="City"><input className={inp} style={inpStyle} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></F>
                <F label="Phone"><input className={inp} style={inpStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></F>
              </div>
              <F label="Address"><input className={inp} style={inpStyle} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Email"><input type="email" className={inp} style={inpStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></F>
                <F label="Website"><input className={inp} style={inpStyle} value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://…" /></F>
              </div>
              <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></F>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>{editHotel ? "Save Changes" : "Add Hotel"}</button>
                <button type="button" onClick={() => { setShowForm(false); setForm(BLANK); }} className="border px-4 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{label}</label>}
      {children}
    </div>
  );
}
