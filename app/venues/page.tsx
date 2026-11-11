"use client";

import { useEffect, useState, useRef } from "react";

type VenueContact = { id: number; name: string; role: string | null; phone: string | null; email: string | null; notes: string | null };
type TechSpecs = {
  general?: Record<string, string | null>;
  loadIn?: Record<string, string | null>;
  stage?: Record<string, string | null>;
  rigging?: Record<string, string | null>;
  masking?: Record<string, string | null>;
  lighting?: Record<string, string | null>;
  sound?: Record<string, string | null>;
  wardrobe?: Record<string, string | null>;
  dressingRooms?: Record<string, string | null>;
  comms?: Record<string, string | null>;
  healthSafety?: Record<string, string | null>;
};
type Venue = {
  id: number; name: string; type: string; city: string | null; address: string | null; postcode: string | null;
  phone: string | null; email: string | null; website: string | null; capacity: number | null;
  techNotes: string | null; techSpecs: string | null; techSpecName: string | null; notes: string | null;
  contacts: VenueContact[];
  _count: { contacts: number };
};

const VENUE_TYPES = ["theatre", "arena", "outdoor", "club", "conference", "hotel", "other"];
const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

// pct: 0-100 = upload progress, -1 = indeterminate AI processing
function UploadProgress({ pct, label }: { pct: number; label?: string }) {
  const indeterminate = pct === -1;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--psg-blue)" }}>
        <span>{indeterminate ? (label ?? "Analysing with AI…") : `Uploading… ${pct}%`}</span>
        {!indeterminate && <span>{pct}%</span>}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(61,68,212,0.2)" }}>
        {indeterminate ? (
          <div className="h-full w-1/3 rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" style={{ backgroundColor: "var(--psg-blue)" }} />
        ) : (
          <div className="h-full rounded-full transition-all duration-150" style={{ width: `${pct}%`, backgroundColor: "var(--psg-blue)" }} />
        )}
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === "None" || value === "null") return null;
  return (
    <div className="flex gap-2 py-1.5 border-b last:border-0 text-sm" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <span className="w-48 shrink-0 text-xs" style={{ color: "var(--psg-muted)" }}>{label}</span>
      <span className="flex-1 whitespace-pre-wrap">{value}</span>
    </div>
  );
}

const BLANK_VENUE = { name: "", type: "theatre", city: "", address: "", postcode: "", phone: "", email: "", website: "", capacity: "", techNotes: "", notes: "" };
const BLANK_CONTACT = { name: "", role: "", phone: "", email: "", notes: "" };

const TYPE_COLORS: Record<string, string> = {
  theatre: "bg-purple-900/60 text-purple-300",
  arena: "bg-blue-900/60 text-blue-300",
  outdoor: "bg-green-900/60 text-green-300",
  club: "bg-pink-900/60 text-pink-300",
  conference: "bg-yellow-900/60 text-yellow-300",
  hotel: "bg-orange-900/60 text-orange-300",
  other: "bg-white/10 text-white/50",
};

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Venue | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "stage" | "rigging" | "lx" | "sound" | "facilities" | "hs">("info");
  const [showForm, setShowForm] = useState(false);
  const [editVenue, setEditVenue] = useState<Venue | null>(null);
  const [venueForm, setVenueForm] = useState(BLANK_VENUE);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact, setEditContact] = useState<VenueContact | null>(null);
  const [contactForm, setContactForm] = useState(BLANK_CONTACT);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null); // null=idle, 0-100=uploading, -1=processing
  const [uploadStatus, setUploadStatus] = useState<{ parsed: boolean; error?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPct, setImportPct] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<{ name: string; ok: boolean; error?: string }[] | null>(null);
  const [importDrag, setImportDrag] = useState(false);
  const [techSpecDrag, setTechSpecDrag] = useState(false);
  const [dupDialog, setDupDialog] = useState<{ file: File; existing: { id: number; name: string; city: string | null }; extractedName: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const data = await fetch("/api/venues").then((r) => r.json());
    setVenues(data);
    setSelected((prev) => prev ? (data.find((v: Venue) => v.id === prev.id) ?? null) : null);
  }

  async function saveVenue(e: React.FormEvent) {
    e.preventDefault();
    if (editVenue) {
      await fetch(`/api/venues/${editVenue.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(venueForm) });
    } else {
      await fetch("/api/venues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(venueForm) });
    }
    setShowForm(false); setEditVenue(null); setVenueForm(BLANK_VENUE);
    await reload();
  }

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  async function deleteVenue(id: number) {
    await fetch(`/api/venues/${id}`, { method: "DELETE" });
    setSelected(null); setConfirmDelete(null); await reload();
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (editContact) {
      await fetch(`/api/venue-contacts/${editContact.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contactForm) });
    } else {
      await fetch(`/api/venues/${selected.id}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contactForm) });
    }
    setShowContactForm(false); setEditContact(null); setContactForm(BLANK_CONTACT);
    await reload();
  }

  async function deleteContact(id: number) {
    await fetch(`/api/venue-contacts/${id}`, { method: "DELETE" });
    await reload();
  }

  function xhrPost(url: string, fd: FormData, onProgress: (pct: number) => void): Promise<{ ok: boolean; status: number; data: unknown }> {
    return new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
      xhr.onload = () => {
        let data: unknown = {};
        try { data = JSON.parse(xhr.responseText); } catch {}
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0, data: { error: "Network error" } });
      xhr.send(fd);
    });
  }

  async function uploadTechSpecFile(file: File) {
    if (!selected) return;
    setUploading(true);
    setUploadPct(0);
    setUploadStatus(null);
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await xhrPost(`/api/venues/${selected.id}/tech-spec`, fd, pct => {
      setUploadPct(pct < 100 ? pct : -1); // -1 = processing
    });
    const d = data as { parsed?: boolean; error?: string };
    setUploading(false);
    setUploadPct(null);
    setUploadStatus({ parsed: d.parsed ?? false, error: d.error });
    await reload();
    setTimeout(() => setUploadStatus(null), 6000);
  }

  async function uploadTechSpec(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) await uploadTechSpecFile(e.target.files[0]);
  }

  function onTechSpecDrop(e: React.DragEvent) {
    e.preventDefault();
    setTechSpecDrag(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.type === "application/pdf");
    if (file) uploadTechSpecFile(file);
  }

  function onImportDrop(e: React.DragEvent) {
    e.preventDefault();
    setImportDrag(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (files.length) doImport(files);
  }

  async function resolveDuplicate(action: "update" | "create") {
    if (!dupDialog) return;
    const { file, existing } = dupDialog;
    setDupDialog(null);
    setImporting(true);
    setImportError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (action === "update") fd.append("updateId", String(existing.id));
    else fd.append("forceCreate", "true");
    const res = await fetch("/api/venues/import-pdf", { method: "POST", body: fd });
    const data = res.ok ? await res.json().catch(() => ({})) : {};
    setImporting(false);
    if (!res.ok) {
      setImportError(data.error ?? "Import failed");
      setTimeout(() => setImportError(null), 6000);
    } else {
      await reload();
      setSelected(data.venue);
      setDetailTab("stage");
    }
  }

  async function deleteTechSpec() {
    if (!selected) return;
    await fetch(`/api/venues/${selected.id}/tech-spec`, { method: "DELETE" });
    await reload();
  }

  async function doImport(files: File[]) {
    if (!files.length) return;
    setImporting(true);
    setImportPct(0);
    setImportError(null);
    setImportResults(null);

    if (files.length === 1) {
      const fd = new FormData();
      fd.append("file", files[0]);
      const { ok, data } = await xhrPost("/api/venues/import-pdf", fd, pct => {
        setImportPct(pct < 100 ? pct : -1);
      });
      const d = data as { duplicate?: boolean; existing?: { id: number; name: string; city: string | null }; extractedName?: string; error?: string; venue?: Venue };
      setImporting(false);
      setImportPct(null);
      if (d.duplicate) {
        setDupDialog({ file: files[0], existing: d.existing!, extractedName: d.extractedName! });
      } else if (!ok) {
        setImportError(d.error ?? "Import failed");
        setTimeout(() => setImportError(null), 6000);
      } else {
        await reload();
        setSelected(d.venue!);
        setDetailTab("stage");
      }
    } else {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      const { ok, data } = await xhrPost("/api/venues/import-pdfs", fd, pct => {
        setImportPct(pct < 100 ? pct : -1);
      });
      const d = data as { results?: { ok: boolean; name: string; error?: string }[]; error?: string };
      setImporting(false);
      setImportPct(null);
      if (!ok) {
        setImportError(d.error ?? "Import failed");
        setTimeout(() => setImportError(null), 6000);
      } else {
        setImportResults((d.results ?? []).map(r => ({ name: r.name, ok: r.ok, error: r.error })));
        await reload();
      }
    }
  }

  async function importFromPDFs(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    doImport(files);
  }

  const filtered = venues.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !search || v.name.toLowerCase().includes(q) || (v.city ?? "").toLowerCase().includes(q) || (v.address ?? "").toLowerCase().includes(q);
    return matchSearch && (typeFilter === "all" || v.type === typeFilter);
  });

  const ts: TechSpecs = selected?.techSpecs ? JSON.parse(selected.techSpecs) : {};

  return (
    <div className="space-y-5">
      {/* Duplicate venue dialog */}
      {dupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-xl border p-6 max-w-md w-full space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <h2 className="text-base font-semibold text-white">Possible duplicate venue</h2>
            <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
              The PDF appears to be for <span className="text-white font-medium">{dupDialog.extractedName}</span>, but a venue called{" "}
              <span className="text-white font-medium">{dupDialog.existing.name}</span>
              {dupDialog.existing.city ? ` (${dupDialog.existing.city})` : ""} already exists.
            </p>
            <p className="text-sm" style={{ color: "var(--psg-muted)" }}>What would you like to do?</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => resolveDuplicate("update")}
                className="flex-1 px-4 py-2 rounded font-medium text-white text-sm"
                style={{ backgroundColor: "var(--psg-blue)" }}
              >
                Update existing venue
              </button>
              <button
                onClick={() => resolveDuplicate("create")}
                className="flex-1 px-4 py-2 rounded font-medium text-sm border"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-text)" }}
              >
                Create new venue
              </button>
              <button
                onClick={() => setDupDialog(null)}
                className="px-3 py-2 rounded text-sm"
                style={{ color: "var(--psg-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Venues</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{venues.length} venue{venues.length !== 1 ? "s" : ""} in directory</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={importRef} type="file" accept=".pdf" multiple className="hidden" onChange={importFromPDFs} />
          <div
            onDragOver={e => { e.preventDefault(); setImportDrag(true); }}
            onDragLeave={() => setImportDrag(false)}
            onDrop={onImportDrop}
            onClick={() => !importing && importRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded font-medium text-sm border cursor-pointer select-none transition-colors"
            style={{
              borderColor: importDrag ? "var(--psg-blue)" : "var(--psg-card-border)",
              borderStyle: "dashed",
              color: importing ? "var(--psg-muted)" : importDrag ? "var(--psg-blue)" : "var(--psg-text)",
              backgroundColor: importDrag ? "rgba(61,68,212,0.08)" : undefined,
            }}
          >
            {importing ? (importPct === -1 ? "Analysing with AI…" : importPct !== null ? `Uploading… ${importPct}%` : "Importing…") : importDrag ? "Drop PDF(s) here" : "⬆ Import PDF(s)"}
          </div>
          {importPct !== null && importing && (
            <div className="w-48"><UploadProgress pct={importPct} label="Analysing with AI…" /></div>
          )}
          {importError && <span className="text-xs" style={{ color: "#f87171" }}>{importError}</span>}
          <button onClick={() => { setEditVenue(null); setVenueForm(BLANK_VENUE); setShowForm(true); }} className="px-4 py-2 rounded font-medium text-white text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>+ Add Venue</button>
        </div>
      </div>

      {/* Bulk import results */}
      {importResults && (
        <div className="rounded-lg border p-4 space-y-2" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">
              Import complete — {importResults.filter(r => r.ok).length} of {importResults.length} imported
            </span>
            <button onClick={() => setImportResults(null)} className="text-xs hover:text-white" style={{ color: "var(--psg-muted)" }}>Dismiss</button>
          </div>
          <div className="space-y-1">
            {importResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span>{r.ok ? "✓" : "✕"}</span>
                <span style={{ color: r.ok ? "#10b981" : "#f87171" }}>{r.name}</span>
                {!r.ok && r.error && <span style={{ color: "var(--psg-muted)" }}>— {r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input type="search" placeholder="Search name, city, address…" value={search} onChange={(e) => setSearch(e.target.value)} className={inp + " max-w-xs"} style={inpStyle} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inp + " w-auto"} style={inpStyle}>
          <option value="all">All types</option>
          {VENUE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      <div className="flex gap-4 items-start min-h-0">
        {/* Venue list */}
        <div className="flex-1 min-w-0 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-16 text-center rounded-lg border" style={{ color: "var(--psg-muted)", borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
              {venues.length === 0 ? "No venues yet — add your first." : "No venues match your search."}
            </div>
          ) : filtered.map((v) => (
            <button key={v.id} onClick={() => { setSelected(selected?.id === v.id ? null : v); setDetailTab("info"); }}
              className="w-full text-left rounded-lg border p-4 transition-all"
              style={{ backgroundColor: selected?.id === v.id ? "rgba(59,130,246,0.1)" : "var(--psg-card-bg)", borderColor: selected?.id === v.id ? "var(--psg-blue)" : "var(--psg-card-border)" }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{v.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[v.type] ?? TYPE_COLORS.other}`}>{v.type}</span>
                    {v.techSpecName && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">Tech spec</span>}
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
                    {[v.city, v.postcode].filter(Boolean).join(" · ")}
                    {v.capacity ? ` · Cap: ${v.capacity.toLocaleString()}` : ""}
                    {v._count.contacts > 0 ? ` · ${v._count.contacts} contact${v._count.contacts !== 1 ? "s" : ""}` : ""}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-96 shrink-0 rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            {/* Panel header */}
            <div className="p-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-sm">{selected.name}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[selected.type] ?? TYPE_COLORS.other}`}>{selected.type}</span>
                    {selected.capacity && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>Cap: {selected.capacity.toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditVenue(selected); setVenueForm({ name: selected.name, type: selected.type, city: selected.city ?? "", address: selected.address ?? "", postcode: selected.postcode ?? "", phone: selected.phone ?? "", email: selected.email ?? "", website: selected.website ?? "", capacity: selected.capacity?.toString() ?? "", techNotes: selected.techNotes ?? "", notes: selected.notes ?? "" }); setShowForm(true); }}
                    className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Edit</button>
                  {confirmDelete === selected.id ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: "#f87171" }}>Sure?</span>
                      <button onClick={() => deleteVenue(selected.id)} className="text-xs px-2 py-1 rounded" style={{ color: "#f87171", backgroundColor: "rgba(239,68,68,0.15)" }}>Yes, delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Cancel</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(selected.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
                  )}
                </div>
              </div>
            </div>

            {/* Detail tabs */}
            <div className="flex border-b overflow-x-auto" style={{ borderColor: "var(--psg-card-border)" }}>
              {(["info", "stage", "rigging", "lx", "sound", "facilities", "hs"] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className="px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors"
                  style={detailTab === t ? { borderColor: "var(--psg-blue)", color: "var(--psg-text)" } : { borderColor: "transparent", color: "var(--psg-muted)" }}>
                  {t === "info" ? "Info" : t === "stage" ? "Stage" : t === "rigging" ? "Rigging" : t === "lx" ? "LX" : t === "sound" ? "Sound" : t === "facilities" ? "Facilities" : "H&S"}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
              {/* INFO TAB */}
              {detailTab === "info" && (
                <div className="p-4 space-y-4">
                  {/* Contact details */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--psg-muted)" }}>Venue Details</div>
                    {selected.address && <div className="text-sm mb-1">{selected.address}{selected.postcode ? `, ${selected.postcode}` : ""}</div>}
                    {selected.city && <div className="text-sm mb-1" style={{ color: "var(--psg-muted)" }}>{selected.city}</div>}
                    {selected.phone && <div className="text-sm">{selected.phone}</div>}
                    {selected.email && <div className="text-sm">{selected.email}</div>}
                    {selected.website && <a href={selected.website} target="_blank" rel="noreferrer" className="text-sm underline" style={{ color: "var(--psg-blue)" }}>{selected.website.replace(/^https?:\/\//, "")}</a>}
                    {ts.general?.stageDoorAddress && <div className="text-xs mt-2" style={{ color: "var(--psg-muted)" }}>Stage door: {ts.general.stageDoorAddress}</div>}
                    {ts.general?.stageDoorTimes && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Hours: {ts.general.stageDoorTimes}</div>}
                    {ts.general?.loadInAddress && ts.general.loadInAddress !== ts.general.stageDoorAddress && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Load in: {ts.general.loadInAddress}</div>}
                  </div>

                  {/* Tech spec doc */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--psg-muted)" }}>Technical Specification Document</div>
                    <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={uploadTechSpec} />
                    {selected.techSpecName ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded p-2 text-sm" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                          <span className="flex-1 truncate">{selected.techSpecName}</span>
                          <a href={`/api/venues/${selected.id}/tech-spec`} target="_blank" rel="noreferrer" className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Download</a>
                          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Re-import</button>
                          <button onClick={deleteTechSpec} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>✕</button>
                        </div>
                        {uploading && uploadPct !== null && <UploadProgress pct={uploadPct} />}
                        {uploadStatus && !uploading && (uploadStatus.parsed
                          ? <div className="text-xs py-1.5 px-3 rounded" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399" }}>✓ Tech spec parsed and fields populated</div>
                          : <div className="text-xs py-1.5 px-3 rounded" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171" }}>{uploadStatus.error ?? "File saved but could not be parsed — add ANTHROPIC_API_KEY to enable AI extraction"}</div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div
                          onDragOver={e => { e.preventDefault(); setTechSpecDrag(true); }}
                          onDragLeave={() => setTechSpecDrag(false)}
                          onDrop={onTechSpecDrop}
                          onClick={() => !uploading && fileRef.current?.click()}
                          className="flex items-center justify-center text-xs px-3 py-4 rounded border border-dashed cursor-pointer transition-colors"
                          style={{
                            borderColor: techSpecDrag ? "var(--psg-blue)" : "var(--psg-card-border)",
                            color: uploading ? "var(--psg-muted)" : techSpecDrag ? "var(--psg-blue)" : "var(--psg-muted)",
                            backgroundColor: techSpecDrag ? "rgba(61,68,212,0.08)" : undefined,
                          }}
                        >
                          {uploading ? (uploadPct === -1 ? "Analysing with AI…" : "Uploading…") : techSpecDrag ? "Drop PDF here" : "⬆ Drag & drop or click to upload tech spec PDF"}
                        </div>
                        {uploading && uploadPct !== null && <UploadProgress pct={uploadPct} />}
                        {uploadStatus && !uploading && (uploadStatus.parsed
                          ? <div className="text-xs py-1.5 px-3 rounded" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399" }}>✓ Tech spec parsed and fields populated</div>
                          : <div className="text-xs py-1.5 px-3 rounded" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171" }}>{uploadStatus.error ?? "File saved but could not be parsed — add ANTHROPIC_API_KEY to enable AI extraction"}</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Contacts */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Contacts</div>
                      <button onClick={() => { setEditContact(null); setContactForm(BLANK_CONTACT); setShowContactForm(true); }} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>+ Add</button>
                    </div>
                    {selected.contacts.length === 0 ? <div className="text-sm" style={{ color: "var(--psg-muted)" }}>No contacts.</div> : (
                      <div className="space-y-2">
                        {selected.contacts.map((c) => (
                          <div key={c.id} className="rounded p-2 text-sm" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <div className="font-medium">{c.name}{c.role ? <span className="font-normal text-xs ml-1" style={{ color: "var(--psg-muted)" }}>{c.role}</span> : ""}</div>
                                {c.phone && <div className="text-xs mt-0.5">{c.phone}</div>}
                                {c.email && <div className="text-xs">{c.email}</div>}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => { setEditContact(c); setContactForm({ name: c.name, role: c.role ?? "", phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" }); setShowContactForm(true); }} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Edit</button>
                                <button onClick={() => deleteContact(c.id)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>✕</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* General notes */}
                  {selected.notes && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div>
                      <div className="text-sm whitespace-pre-wrap">{selected.notes}</div>
                    </div>
                  )}
                </div>
              )}

              {/* STAGE TAB */}
              {detailTab === "stage" && (
                <div className="p-4 space-y-4">
                  {ts.loadIn && Object.values(ts.loadIn).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Load In</div>
                      {Object.entries(ts.loadIn).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {ts.stage && Object.values(ts.stage).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Stage</div>
                      {Object.entries(ts.stage).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {!ts.loadIn && !ts.stage && <div className="text-sm" style={{ color: "var(--psg-muted)" }}>No stage data — upload a tech spec PDF to populate.</div>}
                </div>
              )}

              {/* RIGGING TAB */}
              {detailTab === "rigging" && (
                <div className="p-4 space-y-4">
                  {ts.rigging && Object.values(ts.rigging).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Rigging</div>
                      {Object.entries(ts.rigging).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {ts.masking && Object.values(ts.masking).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Masking</div>
                      {Object.entries(ts.masking).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {!ts.rigging && !ts.masking && <div className="text-sm" style={{ color: "var(--psg-muted)" }}>No rigging data — upload a tech spec PDF to populate.</div>}
                </div>
              )}

              {/* LX TAB */}
              {detailTab === "lx" && (
                <div className="p-4 space-y-4">
                  {ts.lighting && Object.values(ts.lighting).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Lighting</div>
                      {Object.entries(ts.lighting).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {!ts.lighting && <div className="text-sm" style={{ color: "var(--psg-muted)" }}>No lighting data — upload a tech spec PDF to populate.</div>}
                </div>
              )}

              {/* SOUND TAB */}
              {detailTab === "sound" && (
                <div className="p-4 space-y-4">
                  {ts.sound && Object.values(ts.sound).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Sound</div>
                      {Object.entries(ts.sound).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {!ts.sound && <div className="text-sm" style={{ color: "var(--psg-muted)" }}>No sound data — upload a tech spec PDF to populate.</div>}
                </div>
              )}

              {/* FACILITIES TAB */}
              {detailTab === "facilities" && (
                <div className="p-4 space-y-4">
                  {ts.wardrobe && Object.values(ts.wardrobe).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Wardrobe</div>
                      {Object.entries(ts.wardrobe).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {ts.dressingRooms && Object.values(ts.dressingRooms).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Dressing Rooms</div>
                      {Object.entries(ts.dressingRooms).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {ts.comms && Object.values(ts.comms).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Comms</div>
                      {Object.entries(ts.comms).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {!ts.wardrobe && !ts.dressingRooms && !ts.comms && <div className="text-sm" style={{ color: "var(--psg-muted)" }}>No facilities data — upload a tech spec PDF to populate.</div>}
                </div>
              )}

              {/* H&S TAB */}
              {detailTab === "hs" && (
                <div className="p-4 space-y-4">
                  {ts.healthSafety && Object.values(ts.healthSafety).some(Boolean) && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Health & Safety</div>
                      {Object.entries(ts.healthSafety).map(([k, v]) => <SpecRow key={k} label={k} value={v as string} />)}
                    </div>
                  )}
                  {!ts.healthSafety && <div className="text-sm" style={{ color: "var(--psg-muted)" }}>No H&S data — upload a tech spec PDF to populate.</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Venue */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]" style={{ backgroundColor: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)" }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold">{editVenue ? "Edit Venue" : "Add Venue"}</h2>
              <button onClick={() => { setShowForm(false); setEditVenue(null); setVenueForm(BLANK_VENUE); }} className="text-xl leading-none" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <form onSubmit={saveVenue} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <F label="Name *"><input required className={inp} style={inpStyle} value={venueForm.name} onChange={(e) => setVenueForm((f) => ({ ...f, name: e.target.value }))} /></F>
                <F label="Type"><select className={inp} style={inpStyle} value={venueForm.type} onChange={(e) => setVenueForm((f) => ({ ...f, type: e.target.value }))}>{VENUE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></F>
              </div>
              <F label="Address"><input className={inp} style={inpStyle} value={venueForm.address} onChange={(e) => setVenueForm((f) => ({ ...f, address: e.target.value }))} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="City"><input className={inp} style={inpStyle} value={venueForm.city} onChange={(e) => setVenueForm((f) => ({ ...f, city: e.target.value }))} /></F>
                <F label="Postcode"><input className={inp} style={inpStyle} value={venueForm.postcode} onChange={(e) => setVenueForm((f) => ({ ...f, postcode: e.target.value }))} /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Phone"><input className={inp} style={inpStyle} value={venueForm.phone} onChange={(e) => setVenueForm((f) => ({ ...f, phone: e.target.value }))} /></F>
                <F label="Email"><input type="email" className={inp} style={inpStyle} value={venueForm.email} onChange={(e) => setVenueForm((f) => ({ ...f, email: e.target.value }))} /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Website"><input className={inp} style={inpStyle} placeholder="https://" value={venueForm.website} onChange={(e) => setVenueForm((f) => ({ ...f, website: e.target.value }))} /></F>
                <F label="Capacity"><input type="number" className={inp} style={inpStyle} value={venueForm.capacity} onChange={(e) => setVenueForm((f) => ({ ...f, capacity: e.target.value }))} /></F>
              </div>
              <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={venueForm.notes} onChange={(e) => setVenueForm((f) => ({ ...f, notes: e.target.value }))} /></F>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditVenue(null); setVenueForm(BLANK_VENUE); }} className="px-4 py-2 rounded text-sm" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.08)" }}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded text-sm font-medium text-white" style={{ backgroundColor: "var(--psg-blue)" }}>{editVenue ? "Save Changes" : "Add Venue"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Contact */}
      {showContactForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-sm rounded-xl shadow-2xl" style={{ backgroundColor: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)" }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold">{editContact ? "Edit Contact" : "Add Contact"}</h2>
              <button onClick={() => { setShowContactForm(false); setEditContact(null); setContactForm(BLANK_CONTACT); }} className="text-xl leading-none" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <form onSubmit={saveContact} className="p-4 space-y-3">
              <F label="Name *"><input required className={inp} style={inpStyle} value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} /></F>
              <F label="Role"><input className={inp} style={inpStyle} placeholder="e.g. Technical Manager" value={contactForm.role} onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Phone"><input className={inp} style={inpStyle} value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} /></F>
                <F label="Email"><input type="email" className={inp} style={inpStyle} value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} /></F>
              </div>
              <F label="Notes"><input className={inp} style={inpStyle} value={contactForm.notes} onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))} /></F>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setShowContactForm(false); setEditContact(null); setContactForm(BLANK_CONTACT); }} className="px-4 py-2 rounded text-sm" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.08)" }}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded text-sm font-medium text-white" style={{ backgroundColor: "var(--psg-blue)" }}>{editContact ? "Save" : "Add Contact"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
