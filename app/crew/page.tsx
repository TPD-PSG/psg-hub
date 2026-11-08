"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ExportMenu from "@/components/ExportMenu";
import { exportCrewPDF, exportCrewXLSX } from "@/lib/exports";

type CrewMember = {
  id: number;
  name: string;
  discipline: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  isFreelance: boolean;
  insuranceProvider: string | null;
  insurancePolicyNo: string | null;
  insuranceExpiry: string | null;
  insuranceCoverType: string | null;
  notes: string | null;
  productions: { id: number; production: { id: number; name: string } }[];
};

const DISCIPLINES = [
  "Production Manager", "Stage Manager", "Deputy Stage Manager", "Assistant Stage Manager",
  "Set Designer", "Costume Designer", "Lighting Designer", "Sound Designer",
  "Video Designer", "Choreographer", "Musical Director", "Director",
  "Head of Lighting", "Head of Sound", "Head of Video", "Head of Wardrobe",
  "Head of Wigs", "Head of Props", "Head of Scenery",
  "Carpenter", "Rigger", "Electrician", "Audio Technician", "Video Technician",
  "Wardrobe Supervisor", "Dresser", "Driver", "Production Assistant", "Other",
];

const COVER_TYPES = ["PLI", "Employers Liability", "PLI & Employers Liability", "Public Liability", "Other"];

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

const BLANK = {
  name: "", discipline: "Production Manager", phone: "", email: "",
  company: "", isFreelance: true,
  insuranceProvider: "", insurancePolicyNo: "", insuranceExpiry: "", insuranceCoverType: "",
  notes: "",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isExpiringSoon(expiry: string | null) {
  if (!expiry) return false;
  const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days < 60;
}
function isExpired(expiry: string | null) {
  if (!expiry) return false;
  return new Date(expiry) < new Date();
}

export default function CrewPage() {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [search, setSearch] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState<CrewMember | null>(null);
  const [form, setForm] = useState<typeof BLANK & { id?: number }>(BLANK);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const data = await fetch("/api/crew").then((r) => r.json());
    setCrew(data);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.id) {
      await fetch(`/api/crew/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/crew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setShowForm(false);
    setEditMember(null);
    setForm(BLANK);
    reload();
  }

  async function deleteMember(id: number, name: string) {
    if (!confirm(`Delete ${name} from the crew database?`)) return;
    await fetch(`/api/crew/${id}`, { method: "DELETE" });
    reload();
  }

  function openEdit(m: CrewMember) {
    setForm({
      ...m,
      phone: m.phone ?? "",
      email: m.email ?? "",
      company: m.company ?? "",
      insuranceProvider: m.insuranceProvider ?? "",
      insurancePolicyNo: m.insurancePolicyNo ?? "",
      insuranceExpiry: m.insuranceExpiry ? m.insuranceExpiry.slice(0, 10) : "",
      insuranceCoverType: m.insuranceCoverType ?? "",
      notes: m.notes ?? "",
    });
    setEditMember(m);
    setShowForm(true);
  }

  const disciplines = ["All", ...Array.from(new Set(crew.map((c) => c.discipline))).sort()];

  const filtered = crew.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.discipline.toLowerCase().includes(search.toLowerCase()) || (m.company ?? "").toLowerCase().includes(search.toLowerCase());
    const matchDiscipline = filterDiscipline === "All" || m.discipline === filterDiscipline;
    return matchSearch && matchDiscipline;
  });

  const expiredCount = crew.filter((m) => isExpired(m.insuranceExpiry)).length;
  const expiringSoonCount = crew.filter((m) => !isExpired(m.insuranceExpiry) && isExpiringSoon(m.insuranceExpiry)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Crew</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{crew.length} members</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu actions={[
            { label: "Export PDF", onClick: () => exportCrewPDF("All Crew", filtered) },
            { label: "Export Excel", onClick: () => exportCrewXLSX("All Crew", filtered) },
          ]} />
          <button
            onClick={() => { setForm(BLANK); setEditMember(null); setShowForm(true); }}
            className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--psg-blue)" }}
          >
            + Add Crew Member
          </button>
        </div>
      </div>

      {/* Insurance alerts */}
      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="flex gap-3 flex-wrap">
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-900/20 text-sm text-red-300">
              <span className="font-semibold">⚠ {expiredCount} expired</span> insurance {expiredCount === 1 ? "policy" : "policies"}
            </div>
          )}
          {expiringSoonCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-yellow-500/40 bg-yellow-900/20 text-sm text-yellow-300">
              <span className="font-semibold">⚠ {expiringSoonCount}</span> expiring within 60 days
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          className={inp + " max-w-xs"}
          style={inpStyle}
          placeholder="Search name, discipline, company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={inp + " w-auto"} style={inpStyle} value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value)}>
          {disciplines.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Crew table */}
      {filtered.length === 0 ? (
        <p className="text-center py-16" style={{ color: "var(--psg-muted)" }}>
          {crew.length === 0 ? "No crew members yet." : "No results."}
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3 text-left font-medium text-white">Name</th>
                <th className="px-4 py-3 text-left font-medium text-white">Discipline</th>
                <th className="px-4 py-3 text-left font-medium text-white">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-white">Company</th>
                <th className="px-4 py-3 text-left font-medium text-white">Insurance</th>
                <th className="px-4 py-3 text-left font-medium text-white">Productions</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const expired = isExpired(m.insuranceExpiry);
                const expiringSoon = !expired && isExpiringSoon(m.insuranceExpiry);
                return (
                  <tr key={m.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-3">
                      <Link href={`/crew/${m.id}`} className="font-medium text-white hover:underline">{m.name}</Link>
                      {m.isFreelance && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-white/10" style={{ color: "var(--psg-muted)" }}>Freelance</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{m.discipline}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                      {m.email && <div>{m.email}</div>}
                      {m.phone && <div>{m.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>{m.company || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {m.insuranceExpiry ? (
                        <span className={`px-2 py-0.5 rounded-full font-medium ${expired ? "bg-red-900/60 text-red-300" : expiringSoon ? "bg-yellow-900/60 text-yellow-300" : "bg-green-900/40 text-green-400"}`}>
                          {expired ? "Expired" : expiringSoon ? "Expiring" : "Valid"} · {fmtDate(m.insuranceExpiry)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--psg-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                      {m.productions.length > 0 ? m.productions.map((p) => p.production.name).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(m)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                        <button onClick={() => deleteMember(m.id, m.name)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add / Edit */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold text-white">{editMember ? "Edit Crew Member" : "Add Crew Member"}</h2>
              <button onClick={() => { setShowForm(false); setForm(BLANK); }} className="text-xl hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <form onSubmit={save} className="px-5 py-4 space-y-4">
              {/* Personal */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Personal Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Name *" full>
                    <input required className={inp} style={inpStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </F>
                  <F label="Discipline">
                    <select className={inp} style={inpStyle} value={form.discipline} onChange={(e) => setForm((f) => ({ ...f, discipline: e.target.value }))}>
                      {DISCIPLINES.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </F>
                  <F label="Phone">
                    <input type="tel" className={inp} style={inpStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </F>
                  <F label="Email">
                    <input type="email" className={inp} style={inpStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </F>
                  <F label="Company">
                    <input className={inp} style={inpStyle} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Leave blank if freelance" />
                  </F>
                  <F label="">
                    <label className="flex items-center gap-2 mt-6 text-sm text-white cursor-pointer">
                      <input type="checkbox" checked={form.isFreelance} onChange={(e) => setForm((f) => ({ ...f, isFreelance: e.target.checked }))} />
                      Freelance
                    </label>
                  </F>
                </div>
              </div>

              {/* Insurance */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Insurance</p>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Provider">
                    <input className={inp} style={inpStyle} value={form.insuranceProvider} onChange={(e) => setForm((f) => ({ ...f, insuranceProvider: e.target.value }))} />
                  </F>
                  <F label="Policy Number">
                    <input className={inp} style={inpStyle} value={form.insurancePolicyNo} onChange={(e) => setForm((f) => ({ ...f, insurancePolicyNo: e.target.value }))} />
                  </F>
                  <F label="Expiry Date">
                    <input type="date" className={inp} style={inpStyle} value={form.insuranceExpiry} onChange={(e) => setForm((f) => ({ ...f, insuranceExpiry: e.target.value }))} />
                  </F>
                  <F label="Cover Type">
                    <select className={inp} style={inpStyle} value={form.insuranceCoverType} onChange={(e) => setForm((f) => ({ ...f, insuranceCoverType: e.target.value }))}>
                      <option value="">— select —</option>
                      {COVER_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </F>
                </div>
              </div>

              {/* Notes */}
              <F label="Notes">
                <textarea rows={2} className={inp} style={inpStyle} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </F>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
                  {editMember ? "Save Changes" : "Add Member"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setForm(BLANK); }} className="border px-4 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      {label && <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{label}</label>}
      {children}
    </div>
  );
}
