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
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function deleteVenue(id: number) {
    if (!confirm("Delete this venue?")) return;
    await fetch(`/api/venues/${id}`, { method: "DELETE" });
    setSelected(null); await reload();
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

  async function uploadTechSpec(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selected || !e.target.files?.[0]) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", e.target.files[0]);
    await fetch(`/api/venues/${selected.id}/tech-spec`, { method: "POST", body: fd });
    setUploading(false);
    await reload();
  }

  async function deleteTechSpec() {
    if (!selected) return;
    await fetch(`/api/venues/${selected.id}/tech-spec`, { method: "DELETE" });
    await reload();
  }

  const filtered = venues.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !search || v.name.toLowerCase().includes(q) || (v.city ?? "").toLowerCase().includes(q) || (v.address ?? "").toLowerCase().includes(q);
    return matchSearch && (typeFilter === "all" || v.type === typeFilter);
  });

  const ts: TechSpecs = selected?.techSpecs ? JSON.parse(selected.techSpecs) : {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Venues</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{venues.length} venue{venues.length !== 1 ? "s" : ""} in directory</p>
        </div>
        <button onClick={() => { setEditVenue(null); setVenueForm(BLANK_VENUE); setShowForm(true); }} className="px-4 py-2 rounded font-medium text-white text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>+ Add Venue</button>
      </div>

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
                  <button onClick={() => deleteVenue(selected.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
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
                    {selected.techSpecName ? (
                      <div className="flex items-center gap-2 rounded p-2 text-sm" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                        <span className="flex-1 truncate">{selected.techSpecName}</span>
                        <a href={`/api/venues/${selected.id}/tech-spec`} target="_blank" rel="noreferrer" className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Download</a>
                        <button onClick={deleteTechSpec} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>✕</button>
                      </div>
                    ) : (
                      <div>
                        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls" className="hidden" onChange={uploadTechSpec} />
                        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs px-3 py-1.5 rounded border border-dashed" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                          {uploading ? "Uploading…" : "Upload tech spec (PDF, Word)"}
                        </button>
                        {ts.general?.techSpecDocName && <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>Ref: {ts.general.techSpecDocName}</div>}
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
                <div className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Load In</div>
                  <SpecRow label="Door width" value={ts.loadIn?.doorWidthMm ? `${ts.loadIn.doorWidthMm}mm` : null} />
                  <SpecRow label="Door height" value={ts.loadIn?.doorHeightMm ? `${ts.loadIn.doorHeightMm}mm` : null} />
                  <SpecRow label="Door notes" value={ts.loadIn?.doorNotes} />
                  <SpecRow label="Wagons at a time" value={ts.loadIn?.wagonsAtATime} />
                  <SpecRow label="Wagon parking" value={ts.loadIn?.wagonParking} />
                  <SpecRow label="Parking notes" value={ts.loadIn?.parkingNotes} />

                  <div className="text-xs font-semibold uppercase tracking-widest mt-4 mb-3" style={{ color: "var(--psg-muted)" }}>Stage</div>
                  <SpecRow label="Flat or raked" value={ts.stage?.flatOrRaked} />
                  <SpecRow label="Proscenium width" value={ts.stage?.proscWidthM} />
                  <SpecRow label="Proscenium height" value={ts.stage?.proscHeightM} />
                  <SpecRow label="Depth (SL to back wall)" value={ts.stage?.depthToBackWall} />
                  <SpecRow label="Setting line ref" value={ts.stage?.settingLineRef} />
                  <SpecRow label="Forestage depth" value={ts.stage?.forestageDepth} />
                  <SpecRow label="Stage width (wall to wall)" value={ts.stage?.stageWidthWallToWall} />
                  <SpecRow label="CL to SR" value={ts.stage?.clToSR} />
                  <SpecRow label="CL to SL" value={ts.stage?.clToSL} />
                  <SpecRow label="Fly floor height (u/s)" value={ts.stage?.flyFloorHeight} />
                  <SpecRow label="Fly floor distance" value={ts.stage?.flyFloorDistance} />
                  <SpecRow label="Height to grid" value={ts.stage?.heightToGrid} />
                  <SpecRow label="Height stage to aud" value={ts.stage?.heightToAud} />
                  <SpecRow label="Power" value={ts.stage?.power} />
                  <SpecRow label="Crossover" value={ts.stage?.crossover} />
                </div>
              )}

              {/* RIGGING TAB */}
              {detailTab === "rigging" && (
                <div className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Fly System</div>
                  <SpecRow label="CWT / Flying info" value={ts.rigging?.cwtInfo} />
                  <SpecRow label="First available bar" value={ts.rigging?.firstBar} />
                  <SpecRow label="SL to last bar" value={ts.rigging?.settingLineToLastBar} />
                  <SpecRow label="First to last bar" value={ts.rigging?.firstToLastBar} />
                  <SpecRow label="Bar width" value={ts.rigging?.barWidth} />
                  <SpecRow label="Bar centres" value={ts.rigging?.barCentres} />
                  <SpecRow label="SWL per bar" value={ts.rigging?.swl} />
                  <SpecRow label="Max trim height" value={ts.rigging?.maxTrimHeight} />
                  <SpecRow label="Standard trim height" value={ts.rigging?.standardTrimHeight} />
                  <SpecRow label="Notes" value={ts.rigging?.gridRiggingPoints} />

                  <div className="text-xs font-semibold uppercase tracking-widest mt-4 mb-3" style={{ color: "var(--psg-muted)" }}>FOH & Truss</div>
                  <SpecRow label="Advance truss in house?" value={ts.rigging?.advanceTrussInHouse} />
                  <SpecRow label="Advance truss points" value={ts.rigging?.advanceTrussPoints} />
                  <SpecRow label="FOH notes" value={ts.rigging?.fohNotes} />
                  <SpecRow label="Rigging equipment" value={ts.rigging?.riggingEquipment} />
                  <SpecRow label="Access equipment" value={ts.rigging?.accessEquipment} />

                  <div className="text-xs font-semibold uppercase tracking-widest mt-4 mb-3" style={{ color: "var(--psg-muted)" }}>Masking</div>
                  <SpecRow label="Masking available?" value={ts.masking?.available} />
                  <SpecRow label="Legs" value={ts.masking?.legs} />
                  <SpecRow label="Borders" value={ts.masking?.borders} />
                  <SpecRow label="Full blacks" value={ts.masking?.fullBlacks} />
                </div>
              )}

              {/* LX TAB */}
              {detailTab === "lx" && (
                <div className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Lighting</div>
                  <SpecRow label="LX desk" value={ts.lighting?.lxDesk} />
                  <SpecRow label="Dimmers" value={ts.lighting?.dimmers} />
                  <SpecRow label="Channels" value={ts.lighting?.channels} />
                  <SpecRow label="Follow spots" value={ts.lighting?.followSpotPositions} />
                  <SpecRow label="Followspot specs" value={ts.lighting?.followSpotSpecs} />
                  <SpecRow label="Production desks" value={ts.lighting?.productionDesks} />
                </div>
              )}

              {/* SOUND TAB */}
              {detailTab === "sound" && (
                <div className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Sound</div>
                  <SpecRow label="Control desk" value={ts.sound?.controlDesk} />
                  <SpecRow label="FOH mix location" value={ts.sound?.fohMixLocation} />
                  <SpecRow label="Seats off sale" value={ts.sound?.seatsOffSale} />
                  <SpecRow label="FOH PA" value={ts.sound?.fohPA} />
                  <SpecRow label="Cable run to FOH" value={ts.sound?.cableRunToFOH} />
                  <SpecRow label="Dedicated power" value={ts.sound?.dedicatedPower} />
                </div>
              )}

              {/* FACILITIES TAB */}
              {detailTab === "facilities" && (
                <div className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Wardrobe</div>
                  <SpecRow label="Location" value={ts.wardrobe?.location} />
                  <SpecRow label="Size" value={ts.wardrobe?.size} />
                  <SpecRow label="Laundry" value={ts.wardrobe?.laundry} />
                  <SpecRow label="Quick change" value={ts.wardrobe?.quickChange} />
                  <SpecRow label="WHAM room" value={ts.wardrobe?.whamRoom} />

                  <div className="text-xs font-semibold uppercase tracking-widest mt-4 mb-3" style={{ color: "var(--psg-muted)" }}>Dressing Rooms</div>
                  <SpecRow label="Details" value={ts.dressingRooms?.details} />

                  <div className="text-xs font-semibold uppercase tracking-widest mt-4 mb-3" style={{ color: "var(--psg-muted)" }}>Comms & Stage Management</div>
                  <SpecRow label="DSM location" value={ts.comms?.dsmLocation} />
                  <SpecRow label="Comms" value={ts.comms?.comms} />
                  <SpecRow label="Q lights" value={ts.comms?.qLights} />
                  <SpecRow label="CCTV" value={ts.comms?.cctv} />
                </div>
              )}

              {/* H&S TAB */}
              {detailTab === "hs" && (
                <div className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Health & Safety</div>
                  <SpecRow label="Live flame permitted?" value={ts.healthSafety?.liveFlame} />
                  <SpecRow label="Blackout" value={ts.healthSafety?.blackout} />
                  <SpecRow label="Safety curtain" value={ts.healthSafety?.safetyCurtain} />
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
