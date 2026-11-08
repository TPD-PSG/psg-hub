"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

type Contact = { id: number; name: string; role: string; phone: string | null; email: string | null; notes: string | null };
type Document = { id: number; name: string; type: string; expiryDate: string | null; fileUrl: string | null; notes: string | null };
type Maintenance = { id: number; title: string; description: string | null; status: string; priority: string; contractor: string | null; cost: number | null; reportedAt: string; resolvedAt: string | null; notes: string | null };
type Rent = { amount: number | null; frequency: string | null; nextPaymentDate: string | null; nextReviewDate: string | null; landlordRef: string | null; notes: string | null } | null;
type Key = { id: number; description: string; holder: string | null; quantity: number; notes: string | null };
type Alarm = { id: number; name: string; code: string | null; zones: string | null; monitoringCo: string | null; monitoringPhone: string | null; keyholders: string | null; notes: string | null };
type Property = { id: number; name: string; address: string | null; notes: string | null; contacts: Contact[]; documents: Document[]; maintenance: Maintenance[]; rent: Rent; keys: Key[]; alarms: Alarm[] };

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_TYPES: Record<string, string> = {
  lease: "Lease", gas_safe: "Gas Safety", eicr: "EICR", insurance: "Insurance",
  pat: "PAT Test", fire_risk: "Fire Risk Assessment", asbestos: "Asbestos Survey", other: "Other",
};
const MAINT_STATUS: Record<string, string> = { reported: "Reported", in_progress: "In Progress", resolved: "Resolved" };
const MAINT_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-white/10 text-white/50", normal: "bg-blue-900/50 text-blue-300",
  high: "bg-orange-900/60 text-orange-300", urgent: "bg-red-900/60 text-red-300",
};
const MAINT_STATUS_COLORS: Record<string, string> = {
  reported: "bg-yellow-900/60 text-yellow-300", in_progress: "bg-blue-900/60 text-blue-300", resolved: "bg-green-900/60 text-green-300",
};
const FREQ_LABELS: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", annually: "Annually" };

// ── Helpers ───────────────────────────────────────────────────────────────────

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
function daysUntil(s: string | null) {
  if (!s) return null;
  return Math.round((new Date(s).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function expiryBadge(s: string | null) {
  const d = daysUntil(s);
  if (d === null) return null;
  if (d < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-300">Expired</span>;
  if (d <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/60 text-orange-300">Expires in {d}d</span>;
  if (d <= 90) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/60 text-yellow-300">Expires in {d}d</span>;
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]" style={{ backgroundColor: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)" }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: "var(--psg-muted)" }}>×</button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Btns({ onCancel, label = "Save" }: { onCancel: () => void; label?: string }) {
  return (
    <div className="flex gap-2 justify-end pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 rounded text-sm" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.08)" }}>Cancel</button>
      <button type="submit" className="px-4 py-2 rounded text-sm font-medium text-white" style={{ backgroundColor: "var(--psg-blue)" }}>{label}</button>
    </div>
  );
}

function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>{title}</h3>
      {onAdd && <button onClick={onAdd} className="text-xs px-2 py-1 rounded font-medium text-white" style={{ backgroundColor: "var(--psg-blue)" }}>+ Add</button>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm py-4 text-center" style={{ color: "var(--psg-muted)" }}>{text}</p>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────


function PropertyPageInner() {
  const searchParams = useSearchParams();
  const [prop, setProp] = useState<Property | null>(null);
  const tab = searchParams.get("tab") ?? "Overview";

  // Contact modal
  const [contactModal, setContactModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const BLANK_C = { name: "", role: "", phone: "", email: "", notes: "" };
  const [cForm, setCForm] = useState(BLANK_C);

  // Document modal
  const [docModal, setDocModal] = useState(false);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const BLANK_D = { name: "", type: "other", expiryDate: "", fileUrl: "", notes: "" };
  const [dForm, setDForm] = useState(BLANK_D);

  // Maintenance modal
  const [maintModal, setMaintModal] = useState(false);
  const [editMaint, setEditMaint] = useState<Maintenance | null>(null);
  const BLANK_M = { title: "", description: "", status: "reported", priority: "normal", contractor: "", cost: "", notes: "" };
  const [mForm, setMForm] = useState(BLANK_M);

  // Key modal
  const [keyModal, setKeyModal] = useState(false);
  const [editKey, setEditKey] = useState<Key | null>(null);
  const BLANK_K = { description: "", holder: "", quantity: "1", notes: "" };
  const [kForm, setKForm] = useState(BLANK_K);

  // Alarm modal
  const [alarmModal, setAlarmModal] = useState(false);
  const [editAlarm, setEditAlarm] = useState<Alarm | null>(null);
  const BLANK_A = { name: "", code: "", zones: "", monitoringCo: "", monitoringPhone: "", keyholders: "", notes: "" };
  const [aForm, setAForm] = useState(BLANK_A);

  // Rent modal
  const [rentModal, setRentModal] = useState(false);
  const BLANK_R = { amount: "", frequency: "monthly", nextPaymentDate: "", nextReviewDate: "", landlordRef: "", notes: "" };
  const [rForm, setRForm] = useState(BLANK_R);

  async function reload() {
    const data = await fetch("/api/property").then((r) => r.json());
    setProp(data);
  }
  useEffect(() => { reload(); }, []);

  // ── Contacts ──
  function openAddContact() { setEditContact(null); setCForm(BLANK_C); setContactModal(true); }
  function openEditContact(c: Contact) { setEditContact(c); setCForm({ name: c.name, role: c.role, phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" }); setContactModal(true); }
  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    if (editContact) await fetch(`/api/property/contacts/${editContact.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cForm) });
    else await fetch("/api/property/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cForm) });
    setContactModal(false); reload();
  }
  async function deleteContact(id: number) {
    if (!confirm("Delete contact?")) return;
    await fetch(`/api/property/contacts/${id}`, { method: "DELETE" }); reload();
  }

  // ── Documents ──
  function openAddDoc() { setEditDoc(null); setDForm(BLANK_D); setDocModal(true); }
  function openEditDoc(d: Document) { setEditDoc(d); setDForm({ name: d.name, type: d.type, expiryDate: d.expiryDate ? d.expiryDate.slice(0, 10) : "", fileUrl: d.fileUrl ?? "", notes: d.notes ?? "" }); setDocModal(true); }
  async function saveDoc(e: React.FormEvent) {
    e.preventDefault();
    if (editDoc) await fetch(`/api/property/documents/${editDoc.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dForm) });
    else await fetch("/api/property/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dForm) });
    setDocModal(false); reload();
  }
  async function deleteDoc(id: number) {
    if (!confirm("Delete document?")) return;
    await fetch(`/api/property/documents/${id}`, { method: "DELETE" }); reload();
  }

  // ── Maintenance ──
  function openAddMaint() { setEditMaint(null); setMForm(BLANK_M); setMaintModal(true); }
  function openEditMaint(m: Maintenance) { setEditMaint(m); setMForm({ title: m.title, description: m.description ?? "", status: m.status, priority: m.priority, contractor: m.contractor ?? "", cost: m.cost?.toString() ?? "", notes: m.notes ?? "" }); setMaintModal(true); }
  async function saveMaint(e: React.FormEvent) {
    e.preventDefault();
    if (editMaint) await fetch(`/api/property/maintenance/${editMaint.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mForm) });
    else await fetch("/api/property/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mForm) });
    setMaintModal(false); reload();
  }
  async function deleteMaint(id: number) {
    if (!confirm("Delete this maintenance log?")) return;
    await fetch(`/api/property/maintenance/${id}`, { method: "DELETE" }); reload();
  }
  async function quickStatus(id: number, status: string) {
    await fetch(`/api/property/maintenance/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...prop!.maintenance.find(m => m.id === id)!, status }) });
    reload();
  }

  // ── Keys ──
  function openAddKey() { setEditKey(null); setKForm(BLANK_K); setKeyModal(true); }
  function openEditKey(k: Key) { setEditKey(k); setKForm({ description: k.description, holder: k.holder ?? "", quantity: k.quantity.toString(), notes: k.notes ?? "" }); setKeyModal(true); }
  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (editKey) await fetch(`/api/property/keys/${editKey.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kForm) });
    else await fetch("/api/property/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kForm) });
    setKeyModal(false); reload();
  }
  async function deleteKey(id: number) {
    if (!confirm("Delete key record?")) return;
    await fetch(`/api/property/keys/${id}`, { method: "DELETE" }); reload();
  }

  // ── Alarms ──
  function openAddAlarm() { setEditAlarm(null); setAForm(BLANK_A); setAlarmModal(true); }
  function openEditAlarm(a: Alarm) { setEditAlarm(a); setAForm({ name: a.name, code: a.code ?? "", zones: a.zones ?? "", monitoringCo: a.monitoringCo ?? "", monitoringPhone: a.monitoringPhone ?? "", keyholders: a.keyholders ?? "", notes: a.notes ?? "" }); setAlarmModal(true); }
  async function saveAlarm(e: React.FormEvent) {
    e.preventDefault();
    if (editAlarm) await fetch(`/api/property/alarms/${editAlarm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aForm) });
    else await fetch("/api/property/alarms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aForm) });
    setAlarmModal(false); reload();
  }
  async function deleteAlarm(id: number) {
    if (!confirm("Delete alarm record?")) return;
    await fetch(`/api/property/alarms/${id}`, { method: "DELETE" }); reload();
  }

  // ── Rent ──
  function openRent() {
    const r = prop?.rent;
    setRForm({ amount: r?.amount?.toString() ?? "", frequency: r?.frequency ?? "monthly", nextPaymentDate: r?.nextPaymentDate ? r.nextPaymentDate.slice(0, 10) : "", nextReviewDate: r?.nextReviewDate ? r.nextReviewDate.slice(0, 10) : "", landlordRef: r?.landlordRef ?? "", notes: r?.notes ?? "" });
    setRentModal(true);
  }
  async function saveRent(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/property/rent", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rForm) });
    setRentModal(false); reload();
  }

  if (!prop) return <div className="text-sm p-8" style={{ color: "var(--psg-muted)" }}>Loading…</div>;

  const openMaint = prop.maintenance.filter(m => m.status !== "resolved");
  const urgentMaint = prop.maintenance.filter(m => m.priority === "urgent" && m.status !== "resolved");
  const expiringDocs = prop.documents.filter(d => { const days = daysUntil(d.expiryDate); return days !== null && days <= 90; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{prop.name}</h1>
          {prop.address && <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{prop.address}</p>}
        </div>
      </div>

      {/* Alert strip */}
      {(urgentMaint.length > 0 || expiringDocs.length > 0) && (
        <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.06)" }}>
          {urgentMaint.map(m => (
            <div key={m.id} className="flex items-center gap-2 text-sm text-red-300">
              <span className="text-red-400">⚠</span> Urgent maintenance: {m.title}
            </div>
          ))}
          {expiringDocs.map(d => {
            const days = daysUntil(d.expiryDate)!;
            return (
              <div key={d.id} className="flex items-center gap-2 text-sm text-orange-300">
                <span className="text-orange-400">⚠</span> {d.name} {days < 0 ? "has expired" : `expires in ${days} days`}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Overview ── */}
      {tab === "Overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Rent card */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Rent</h3>
              <button onClick={openRent} className="text-xs px-2 py-1 rounded font-medium text-white" style={{ backgroundColor: "var(--psg-blue)" }}>Edit</button>
            </div>
            {prop.rent ? (
              <div className="space-y-2">
                {prop.rent.amount && <div className="text-2xl font-bold text-white">{fmt(prop.rent.amount)} <span className="text-sm font-normal" style={{ color: "var(--psg-muted)" }}>{FREQ_LABELS[prop.rent.frequency ?? ""] ?? prop.rent.frequency}</span></div>}
                {prop.rent.nextPaymentDate && <div className="text-sm" style={{ color: "var(--psg-muted)" }}>Next payment: <span className="text-white">{fmtDate(prop.rent.nextPaymentDate)}</span></div>}
                {prop.rent.nextReviewDate && <div className="text-sm" style={{ color: "var(--psg-muted)" }}>Rent review: <span className="text-white">{fmtDate(prop.rent.nextReviewDate)}</span></div>}
                {prop.rent.landlordRef && <div className="text-sm" style={{ color: "var(--psg-muted)" }}>Landlord ref: <span className="text-white">{prop.rent.landlordRef}</span></div>}
                {prop.rent.notes && <div className="text-xs mt-2" style={{ color: "var(--psg-muted)" }}>{prop.rent.notes}</div>}
              </div>
            ) : <EmptyState text="No rent details added yet." />}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Open issues", value: openMaint.length, alert: openMaint.length > 0 },
              { label: "Urgent", value: urgentMaint.length, alert: urgentMaint.length > 0 },
              { label: "Docs expiring soon", value: expiringDocs.length, alert: expiringDocs.length > 0 },
              { label: "Contacts", value: prop.contacts.length, alert: false },
            ].map(({ label, value, alert }) => (
              <div key={label} className="rounded-xl border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>{label}</div>
                <div className={`text-xl font-bold ${alert ? "text-red-400" : "text-white"}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Maintenance ── */}
      {tab === "Maintenance" && (
        <div className="rounded-xl border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="p-5 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            <SectionHeader title="Maintenance Log" onAdd={openAddMaint} />
          </div>
          {prop.maintenance.length === 0 ? <EmptyState text="No maintenance issues logged." /> : (
            <div className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
              {prop.maintenance.map(m => (
                <div key={m.id} className="p-4 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-white">{m.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MAINT_PRIORITY_COLORS[m.priority]}`}>{m.priority}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MAINT_STATUS_COLORS[m.status]}`}>{MAINT_STATUS[m.status]}</span>
                    </div>
                    {m.description && <div className="text-sm mb-1" style={{ color: "var(--psg-muted)" }}>{m.description}</div>}
                    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--psg-muted)" }}>
                      <span>Reported {fmtDate(m.reportedAt)}</span>
                      {m.contractor && <span>Contractor: {m.contractor}</span>}
                      {m.cost && <span>Cost: {fmt(m.cost)}</span>}
                      {m.resolvedAt && <span>Resolved {fmtDate(m.resolvedAt)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    {m.status === "reported" && <button onClick={() => quickStatus(m.id, "in_progress")} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#93c5fd" }}>Start</button>}
                    {m.status === "in_progress" && <button onClick={() => quickStatus(m.id, "resolved")} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#6ee7b7" }}>Resolve</button>}
                    <button onClick={() => openEditMaint(m)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Edit</button>
                    <button onClick={() => deleteMaint(m.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Documents ── */}
      {tab === "Documents" && (
        <div className="rounded-xl border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="p-5 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            <SectionHeader title="Documents & Certificates" onAdd={openAddDoc} />
          </div>
          {prop.documents.length === 0 ? <EmptyState text="No documents added yet." /> : (
            <div className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
              {prop.documents.map(d => (
                <div key={d.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">{d.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">{DOC_TYPES[d.type] ?? d.type}</span>
                      {expiryBadge(d.expiryDate)}
                    </div>
                    {d.expiryDate && <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Expires {fmtDate(d.expiryDate)}</div>}
                    {d.notes && <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{d.notes}</div>}
                    {d.fileUrl && <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 mt-0.5 block">View file →</a>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditDoc(d)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Edit</button>
                    <button onClick={() => deleteDoc(d.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Contacts ── */}
      {tab === "Contacts" && (
        <div className="rounded-xl border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="p-5 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            <SectionHeader title="Contacts" onAdd={openAddContact} />
          </div>
          {prop.contacts.length === 0 ? <EmptyState text="No contacts added yet." /> : (
            <div className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
              {prop.contacts.map(c => (
                <div key={c.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{c.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">{c.role}</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-sm" style={{ color: "var(--psg-muted)" }}>
                      {c.phone && <a href={`tel:${c.phone}`} className="hover:text-white transition-colors">{c.phone}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="hover:text-white transition-colors">{c.email}</a>}
                    </div>
                    {c.notes && <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{c.notes}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditContact(c)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Edit</button>
                    <button onClick={() => deleteContact(c.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Keys & Alarms ── */}
      {tab === "Keys & Alarms" && (
        <div className="space-y-4">
          {/* Keys */}
          <div className="rounded-xl border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="p-5 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <SectionHeader title="Keys" onAdd={openAddKey} />
            </div>
            {prop.keys.length === 0 ? <EmptyState text="No key records added yet." /> : (
              <div className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
                {prop.keys.map(k => (
                  <div key={k.id} className="p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{k.description}</span>
                        {k.quantity > 1 && <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/60">×{k.quantity}</span>}
                      </div>
                      {k.holder && <div className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>Held by: <span className="text-white">{k.holder}</span></div>}
                      {k.notes && <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{k.notes}</div>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditKey(k)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Edit</button>
                      <button onClick={() => deleteKey(k.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alarms */}
          <div className="rounded-xl border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="p-5 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <SectionHeader title="Alarms" onAdd={openAddAlarm} />
            </div>
            {prop.alarms.length === 0 ? <EmptyState text="No alarm records added yet." /> : (
              <div className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
                {prop.alarms.map(a => (
                  <div key={a.id} className="p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white mb-1">{a.name}</div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                        {a.code && <div style={{ color: "var(--psg-muted)" }}>Code: <span className="text-white font-mono">{a.code}</span></div>}
                        {a.zones && <div style={{ color: "var(--psg-muted)" }}>Zones: <span className="text-white">{a.zones}</span></div>}
                        {a.monitoringCo && <div style={{ color: "var(--psg-muted)" }}>Monitoring: <span className="text-white">{a.monitoringCo}</span></div>}
                        {a.monitoringPhone && <div style={{ color: "var(--psg-muted)" }}>Phone: <a href={`tel:${a.monitoringPhone}`} className="text-white hover:text-blue-300">{a.monitoringPhone}</a></div>}
                        {a.keyholders && <div className="col-span-2" style={{ color: "var(--psg-muted)" }}>Keyholders: <span className="text-white">{a.keyholders}</span></div>}
                      </div>
                      {a.notes && <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>{a.notes}</div>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditAlarm(a)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Edit</button>
                      <button onClick={() => deleteAlarm(a.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}

      {contactModal && (
        <Modal title={editContact ? "Edit Contact" : "Add Contact"} onClose={() => setContactModal(false)}>
          <form onSubmit={saveContact} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *"><input required className={inp} style={inpStyle} value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Role *"><input required className={inp} style={inpStyle} value={cForm.role} placeholder="e.g. Landlord, Electrician" onChange={e => setCForm(f => ({ ...f, role: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><input className={inp} style={inpStyle} value={cForm.phone} onChange={e => setCForm(f => ({ ...f, phone: e.target.value }))} /></Field>
              <Field label="Email"><input type="email" className={inp} style={inpStyle} value={cForm.email} onChange={e => setCForm(f => ({ ...f, email: e.target.value }))} /></Field>
            </div>
            <Field label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={cForm.notes} onChange={e => setCForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            <Btns onCancel={() => setContactModal(false)} />
          </form>
        </Modal>
      )}

      {docModal && (
        <Modal title={editDoc ? "Edit Document" : "Add Document"} onClose={() => setDocModal(false)}>
          <form onSubmit={saveDoc} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *"><input required className={inp} style={inpStyle} value={dForm.name} onChange={e => setDForm(f => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Type">
                <select className={inp} style={inpStyle} value={dForm.type} onChange={e => setDForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.entries(DOC_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry Date"><input type="date" className={inp} style={inpStyle} value={dForm.expiryDate} onChange={e => setDForm(f => ({ ...f, expiryDate: e.target.value }))} /></Field>
              <Field label="File URL"><input className={inp} style={inpStyle} value={dForm.fileUrl} placeholder="https://…" onChange={e => setDForm(f => ({ ...f, fileUrl: e.target.value }))} /></Field>
            </div>
            <Field label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={dForm.notes} onChange={e => setDForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            <Btns onCancel={() => setDocModal(false)} />
          </form>
        </Modal>
      )}

      {maintModal && (
        <Modal title={editMaint ? "Edit Issue" : "Log Issue"} onClose={() => setMaintModal(false)}>
          <form onSubmit={saveMaint} className="space-y-3">
            <Field label="Title *"><input required className={inp} style={inpStyle} value={mForm.title} onChange={e => setMForm(f => ({ ...f, title: e.target.value }))} /></Field>
            <Field label="Description"><textarea rows={2} className={inp} style={inpStyle} value={mForm.description} onChange={e => setMForm(f => ({ ...f, description: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <select className={inp} style={inpStyle} value={mForm.priority} onChange={e => setMForm(f => ({ ...f, priority: e.target.value }))}>
                  {["low", "normal", "high", "urgent"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inp} style={inpStyle} value={mForm.status} onChange={e => setMForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(MAINT_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contractor"><input className={inp} style={inpStyle} value={mForm.contractor} onChange={e => setMForm(f => ({ ...f, contractor: e.target.value }))} /></Field>
              <Field label="Cost (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={mForm.cost} onChange={e => setMForm(f => ({ ...f, cost: e.target.value }))} /></Field>
            </div>
            <Field label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={mForm.notes} onChange={e => setMForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            <Btns onCancel={() => setMaintModal(false)} />
          </form>
        </Modal>
      )}

      {keyModal && (
        <Modal title={editKey ? "Edit Key" : "Add Key"} onClose={() => setKeyModal(false)}>
          <form onSubmit={saveKey} className="space-y-3">
            <Field label="Description *"><input required className={inp} style={inpStyle} value={kForm.description} placeholder="e.g. Front door, Shutter padlock" onChange={e => setKForm(f => ({ ...f, description: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Held by"><input className={inp} style={inpStyle} value={kForm.holder} onChange={e => setKForm(f => ({ ...f, holder: e.target.value }))} /></Field>
              <Field label="Quantity"><input type="number" min="1" className={inp} style={inpStyle} value={kForm.quantity} onChange={e => setKForm(f => ({ ...f, quantity: e.target.value }))} /></Field>
            </div>
            <Field label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={kForm.notes} onChange={e => setKForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            <Btns onCancel={() => setKeyModal(false)} />
          </form>
        </Modal>
      )}

      {alarmModal && (
        <Modal title={editAlarm ? "Edit Alarm" : "Add Alarm"} onClose={() => setAlarmModal(false)}>
          <form onSubmit={saveAlarm} className="space-y-3">
            <Field label="Name *"><input required className={inp} style={inpStyle} value={aForm.name} placeholder="e.g. Intruder Alarm, Fire Alarm" onChange={e => setAForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code"><input className={inp} style={inpStyle} value={aForm.code} onChange={e => setAForm(f => ({ ...f, code: e.target.value }))} /></Field>
              <Field label="Zones"><input className={inp} style={inpStyle} value={aForm.zones} placeholder="e.g. Front, Rear, Office" onChange={e => setAForm(f => ({ ...f, zones: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monitoring company"><input className={inp} style={inpStyle} value={aForm.monitoringCo} onChange={e => setAForm(f => ({ ...f, monitoringCo: e.target.value }))} /></Field>
              <Field label="Monitoring phone"><input className={inp} style={inpStyle} value={aForm.monitoringPhone} onChange={e => setAForm(f => ({ ...f, monitoringPhone: e.target.value }))} /></Field>
            </div>
            <Field label="Keyholders"><input className={inp} style={inpStyle} value={aForm.keyholders} placeholder="e.g. Toby, Dave" onChange={e => setAForm(f => ({ ...f, keyholders: e.target.value }))} /></Field>
            <Field label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={aForm.notes} onChange={e => setAForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            <Btns onCancel={() => setAlarmModal(false)} />
          </form>
        </Modal>
      )}

      {rentModal && (
        <Modal title="Rent Details" onClose={() => setRentModal(false)}>
          <form onSubmit={saveRent} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={rForm.amount} onChange={e => setRForm(f => ({ ...f, amount: e.target.value }))} /></Field>
              <Field label="Frequency">
                <select className={inp} style={inpStyle} value={rForm.frequency} onChange={e => setRForm(f => ({ ...f, frequency: e.target.value }))}>
                  {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Next payment"><input type="date" className={inp} style={inpStyle} value={rForm.nextPaymentDate} onChange={e => setRForm(f => ({ ...f, nextPaymentDate: e.target.value }))} /></Field>
              <Field label="Rent review date"><input type="date" className={inp} style={inpStyle} value={rForm.nextReviewDate} onChange={e => setRForm(f => ({ ...f, nextReviewDate: e.target.value }))} /></Field>
            </div>
            <Field label="Landlord ref"><input className={inp} style={inpStyle} value={rForm.landlordRef} onChange={e => setRForm(f => ({ ...f, landlordRef: e.target.value }))} /></Field>
            <Field label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={rForm.notes} onChange={e => setRForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            <Btns onCancel={() => setRentModal(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function PropertyPage() {
  return (
    <Suspense>
      <PropertyPageInner />
    </Suspense>
  );
}
