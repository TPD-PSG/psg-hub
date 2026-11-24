"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import TasksPanel from "@/components/TasksPanel";
import { parsePerms } from "@/lib/permissions";
import { confirmDialog } from "@/components/Dialogs";
import { F, Modal, Btns, NoAccess, inp, inpStyle, fmtDate, sendJson, STATUS_OPTS, STATUS_COLORS, ANN_COLORS, ANN_LABELS, ANN_OPTS, type Production, type TabKey, type TabProps, type VenueRef } from "./shared";
import ScheduleTab from "./tabs/Schedule";
import BudgetTab from "./tabs/Budget";
import CrewTab from "./tabs/Crew";
import AccommodationTab from "./tabs/Accommodation";
import HaulageTab from "./tabs/Haulage";
import CallSheetsTab from "./tabs/CallSheets";
import TourTab from "./tabs/Tour";
import AdvancingTab from "./tabs/Advancing";
import ContactsTab from "./tabs/Contacts";
import DocumentsTab from "./tabs/Documents";
import LinksTab from "./tabs/Links";
import HealthSafetyTab from "./tabs/HealthSafety";
import ReportsTab from "./tabs/Reports";
import NotesTab from "./tabs/Notes";
import MeetingsTab from "./tabs/Meetings";

// Each tab is its own component in ./tabs, with its own state and fetches; only the open tab is mounted.
// This file keeps the shell: header, team, edit/archive/delete and picking the tab from ?section=.

// The production arrives with the page (loaded on the server by page.tsx), so there's no loading flash;
// reload() refreshes it from the API after edits.
function formFromProd(data: Production) {
  return {
    name: data.name, type: data.type, venue: data.venue ?? "",
    venueId: data.venueId ? String(data.venueId) : "",
    isTour: data.isTour ?? false,
    startDate: data.startDate ? data.startDate.slice(0, 10) : "",
    endDate: data.endDate ? data.endDate.slice(0, 10) : "",
    status: data.status, announcementStatus: data.announcementStatus ?? "not_announced", internalStatus: data.internalStatus ?? "pencil", productionManager: data.productionManager ?? "", color: data.color ?? "", notes: data.notes ?? "", reportEmail: data.reportEmail ?? "", sharepointUrl: data.sharepointUrl ?? "", bdClientId: data.bdClientId ? String(data.bdClientId) : "",
    entityId: data.entityId ? String(data.entityId) : "",
  };
}

function ProductionPageInner({ id, initialProd }: { id: string; initialProd: Production }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const userRole = (session?.user as any)?.role ?? "member";
  const canManageTeam = isAdmin || userRole === "member";
  const DEFAULT_HIDDEN: Record<string, string[]> = { client: ["budget", "crew", "advancing", "links"], freelancer: ["budget", "crew", "advancing", "links"] };
  const userPermsHidden = parsePerms((session?.user as any)?.permissions ?? null);
  const hiddenSections = new Set<string>(isAdmin ? [] : (userPermsHidden.hiddenSections ?? DEFAULT_HIDDEN[userRole] ?? []));
  const searchParams = useSearchParams();
  const [prod, setProd] = useState<Production | null>(initialProd);
  const tab: TabKey = (searchParams.get("section") as TabKey) ?? "schedule";
  const [allUsers, setAllUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  useEffect(() => { fetch("/api/users").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllUsers(d); }); }, []);

  const [logoUploading, setLogoUploading] = useState(false);

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("logo", file);
    const res = await fetch(`/api/productions/${id}/logo`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.logoUrl) setProd((p) => p ? { ...p, logoUrl: data.logoUrl } : p);
    setLogoUploading(false);
  }

  async function removeLogo() {
    await fetch(`/api/productions/${id}/logo`, { method: "DELETE" });
    setProd((p) => p ? { ...p, logoUrl: null } : p);
  }

  // Venues feed the Edit Production form and the Tour tab's venue search
  const [allVenues, setAllVenues] = useState<VenueRef[]>([]);
  useEffect(() => { fetch("/api/venues").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllVenues(d); }); }, []);

  async function addTeamMember(userId: number) {
    await sendJson(`/api/productions/${id}/team`, "POST", { userId });
    reload();
  }
  async function removeTeamMember(userId: number) {
    await fetch(`/api/productions/${id}/team/${userId}`, { method: "DELETE" });
    reload();
  }

  const [editProd, setEditProd] = useState(false);
  const [prodForm, setProdForm] = useState(() => formFromProd(initialProd));
  const [allBdClients, setAllBdClients] = useState<{ id: number; name: string; type: string }[]>([]);
  useEffect(() => { fetch("/api/clients").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllBdClients(d); }); }, []);
  const [allEntities, setAllEntities] = useState<{ id: number; name: string; archived: boolean }[]>([]);
  useEffect(() => { fetch("/api/entities").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllEntities(d); }).catch(() => {}); }, []);

  async function reload() {
    const res = await fetch(`/api/productions/${id}`);
    if (!res.ok) return; // keep showing what we have rather than replacing it with an error
    const data: Production = await res.json();
    setProd(data);
    setProdForm(formFromProd(data));
  }

  async function saveProd(e: React.FormEvent) {
    e.preventDefault();
    await sendJson(`/api/productions/${id}`, "PUT", prodForm);
    setEditProd(false);
    reload();
  }

  async function deleteProd() {
    if (!await confirmDialog(`Permanently delete "${prod?.name}" and all its data?`)) return;
    await fetch(`/api/productions/${id}`, { method: "DELETE" });
    router.push("/");
  }

  async function archiveProd() {
    if (!await confirmDialog(`Archive "${prod?.name}"? It will move to Archived Productions and become read-only.`)) return;
    await sendJson(`/api/productions/${id}`, "PATCH", { archived: true });
    router.push("/productions/archived");
  }

  if (!prod) return <div className="py-20 text-center" style={{ color: "var(--psg-muted)" }}>Loading…</div>;

  const tabProps: TabProps = { prod, setProd, reload };
  const gated = (key: string, el: React.ReactNode) => hiddenSections.has(key) ? <NoAccess /> : el;

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* Wraps on phones so the Edit / Archive / Delete buttons drop below the title instead of widening the page */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Production logo — click opens SharePoint folder if URL set */}
          {prod.sharepointUrl ? (
            <a
              href={prod.sharepointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden flex items-center justify-center border transition-opacity hover:opacity-80"
              style={{ borderColor: prod.logoUrl ? "transparent" : "var(--psg-card-border)", backgroundColor: prod.logoUrl ? "transparent" : "var(--psg-card-bg)" }}
              title="Open SharePoint folder"
            >
              {prod.logoUrl ? (
                <Image src={prod.logoUrl} alt={prod.name} fill className="object-contain p-1" />
              ) : (
                <span className="text-sm font-bold" style={{ color: "var(--psg-muted)" }}>{prod.name.slice(0, 2).toUpperCase()}</span>
              )}
            </a>
          ) : (
            <div
              className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden flex items-center justify-center border"
              style={{ borderColor: prod.logoUrl ? "transparent" : "var(--psg-card-border)", backgroundColor: prod.logoUrl ? "transparent" : "var(--psg-card-bg)" }}
            >
              {prod.logoUrl ? (
                <Image src={prod.logoUrl} alt={prod.name} fill className="object-contain p-1" />
              ) : (
                <span className="text-sm font-bold" style={{ color: "var(--psg-muted)" }}>{prod.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
          )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {prod.color && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: prod.color }} />}
            <h1 className="text-2xl font-bold text-white">{prod.name}</h1>
            <span className="text-sm" style={{ color: "var(--psg-muted)" }}>{prod.type}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[prod.status] ?? "bg-white/10 text-white/50"}`}>{prod.status}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ANN_COLORS[prod.announcementStatus] ?? "bg-white/10 text-white/50"}`}>{ANN_LABELS[prod.announcementStatus] ?? prod.announcementStatus}</span>
            {prod.isTour && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-900/60 text-purple-300">Tour</span>}
            {prod.bdClient && (
              <div className="ml-2 flex flex-col gap-0.5">
                <span className="text-sm font-medium text-white">{prod.bdClient.name}</span>
                {prod.bdClient.billingName && prod.bdClient.billingName !== prod.bdClient.name && (
                  <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{prod.bdClient.billingName}</span>
                )}
                {prod.bdClient.billingAddress && (
                  <span className="text-xs whitespace-pre-line" style={{ color: "var(--psg-muted)" }}>{prod.bdClient.billingAddress}</span>
                )}
                {prod.bdClient.billingEmail && (
                  <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{prod.bdClient.billingEmail}</span>
                )}
              </div>
            )}
          </div>
          {prod.venueRef && <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{prod.venueRef.name}{prod.venueRef.city ? ` · ${prod.venueRef.city}` : ""}</p>}
          {!prod.venueRef && prod.venue && <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{prod.venue}</p>}
          {prod.isTour && prod.tourStops.length > 0 && <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{prod.tourStops.length} tour {prod.tourStops.length === 1 ? "stop" : "stops"}</p>}
          {(prod.startDate || prod.endDate) && (
            <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
              {prod.startDate ? fmtDate(prod.startDate) : "?"} → {prod.endDate ? fmtDate(prod.endDate) : "?"}
            </p>
          )}
          {/* Team */}
          <div className="flex items-center gap-2 mt-2 relative">
            {prod.team.map((m) => {
              const initials = m.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <button key={m.user.id} title={canManageTeam ? `Remove ${m.user.name}` : m.user.name} disabled={!canManageTeam} onClick={() => removeTeamMember(m.user.id)}
                  className="group relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-opacity hover:opacity-70"
                  style={{ backgroundColor: "var(--psg-blue)" }}>
                  {initials}
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">{m.user.name}</span>
                </button>
              );
            })}
            {canManageTeam && <div className="relative">
              <button onClick={() => setShowTeamPicker((o) => !o)}
                className="w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-sm transition-colors hover:bg-white/10"
                style={{ borderColor: "var(--psg-muted)", color: "var(--psg-muted)" }} title="Add team member">+</button>
              {showTeamPicker && (
                <div className="absolute left-0 top-9 z-20 w-48 rounded-lg shadow-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                  {allUsers.filter((u) => !prod.team.some((m) => m.user.id === u.id)).map((u) => (
                    <button key={u.id} onClick={() => { addTeamMember(u.id); setShowTeamPicker(false); }}
                      className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/10">{u.name}</button>
                  ))}
                  {allUsers.filter((u) => !prod.team.some((m) => m.user.id === u.id)).length === 0 && (
                    <div className="px-3 py-2 text-sm" style={{ color: "var(--psg-muted)" }}>All users added</div>
                  )}
                </div>
              )}
            </div>}
            {prod.team.length > 0 && (
              <span className="text-xs" style={{ color: "var(--psg-muted)" }}>
                {prod.team.map((m) => m.user.name.split(" ")[0]).join(", ")}
              </span>
            )}
          </div>
        </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditProd(true)} className="border px-3 py-1.5 rounded text-sm hover:bg-white/5 transition-colors text-white" style={{ borderColor: "var(--psg-card-border)" }}>Edit</button>
            <button onClick={archiveProd} className="border px-3 py-1.5 rounded text-sm transition-colors hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Archive</button>
            <button onClick={deleteProd} className="border px-3 py-1.5 rounded text-sm transition-colors text-red-400 hover:bg-red-900/20" style={{ borderColor: "rgba(248,113,113,0.3)" }}>Delete</button>
          </div>
        )}
      </div>

      {tab === "schedule" && <ScheduleTab {...tabProps} />}
      {tab === "budget" && gated("budget", <BudgetTab {...tabProps} isAdmin={isAdmin} userRole={userRole} />)}
      {tab === "crew" && gated("crew", <CrewTab {...tabProps} />)}
      {tab === "accommodation" && <AccommodationTab {...tabProps} />}
      {tab === "haulage" && <HaulageTab {...tabProps} />}
      {tab === "callsheets" && <CallSheetsTab {...tabProps} />}
      {tab === "tour" && prod.isTour && <TourTab {...tabProps} allVenues={allVenues} />}
      {tab === "advancing" && gated("advancing", <AdvancingTab {...tabProps} />)}
      {tab === "contacts" && <ContactsTab {...tabProps} />}
      {tab === "documents" && <DocumentsTab {...tabProps} />}
      {tab === "links" && gated("links", <LinksTab {...tabProps} />)}
      {tab === "hs" && <HealthSafetyTab {...tabProps} />}
      {tab === "reports" && <ReportsTab {...tabProps} />}
      {tab === "tasks" && <TasksPanel productionId={prod.id} />}
      {tab === "notes" && <NotesTab {...tabProps} canEdit={isAdmin || userRole === "member"} />}
      {tab === "meetings" && <MeetingsTab {...tabProps} canEdit={isAdmin || userRole === "member"} />}

      {/* Modal: Edit Production */}
      {editProd && (
        <Modal title="Edit Production" onClose={() => setEditProd(false)}>
          <form onSubmit={saveProd} className="space-y-3">
            <F label="Name *"><input required className={inp} style={inpStyle} value={prodForm.name} onChange={(e) => setProdForm((f) => ({ ...f, name: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Type"><input className={inp} style={inpStyle} value={prodForm.type} onChange={(e) => setProdForm((f) => ({ ...f, type: e.target.value }))} /></F>
              <F label="Status"><select className={inp} style={inpStyle} value={prodForm.status} onChange={(e) => setProdForm((f) => ({ ...f, status: e.target.value }))}>{STATUS_OPTS.map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Announcement"><select className={inp} style={inpStyle} value={prodForm.announcementStatus} onChange={(e) => setProdForm((f) => ({ ...f, announcementStatus: e.target.value }))}>{ANN_OPTS.map((s) => <option key={s} value={s}>{ANN_LABELS[s]}</option>)}</select></F>
              <F label="Internal status">
                <div className="flex gap-2">
                  {["pencil", "confirmed"].map(s => (
                    <button key={s} type="button" onClick={() => setProdForm(f => ({ ...f, internalStatus: s }))}
                      className="flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider border transition-colors"
                      style={{
                        borderColor: prodForm.internalStatus === s ? (s === "confirmed" ? "#10b981" : "#f59e0b") : "var(--psg-card-border)",
                        backgroundColor: prodForm.internalStatus === s ? (s === "confirmed" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)") : "transparent",
                        color: prodForm.internalStatus === s ? (s === "confirmed" ? "#10b981" : "#f59e0b") : "var(--psg-muted)",
                      }}>
                      {s === "confirmed" ? "Confirmed" : "Pencil"}
                    </button>
                  ))}
                </div>
              </F>
            </div>
            <F label="Proj Lead / Production Manager"><input className={inp} style={inpStyle} value={prodForm.productionManager} onChange={(e) => setProdForm((f) => ({ ...f, productionManager: e.target.value }))} placeholder="e.g. Toby / Tom" /></F>
            <F label="Company (entity)">
              <select className={inp} style={inpStyle} value={prodForm.entityId} onChange={e => setProdForm(f => ({ ...f, entityId: e.target.value }))}>
                <option value="">— none —</option>
                {allEntities.filter(en => !en.archived || String(en.id) === prodForm.entityId).map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
              </select>
            </F>
            <F label="Client (from BD)">
              <select className={inp} style={inpStyle} value={prodForm.bdClientId} onChange={e => setProdForm(f => ({ ...f, bdClientId: e.target.value }))}>
                <option value="">— none —</option>
                {allBdClients.map(c => <option key={c.id} value={c.id}>{c.name} · {c.type}</option>)}
              </select>
            </F>
            <F label="Venue (from database)">
              <select className={inp} style={inpStyle} value={prodForm.venueId} onChange={e => setProdForm(f => ({ ...f, venueId: e.target.value }))}>
                <option value="">— none / freetext below —</option>
                {allVenues.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? ` · ${v.city}` : ""}</option>)}
              </select>
            </F>
            <F label="Venue (freetext override)"><input className={inp} style={inpStyle} value={prodForm.venue} onChange={(e) => setProdForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Leave blank if using venue above" /></F>
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input type="checkbox" checked={prodForm.isTour} onChange={e => setProdForm(f => ({ ...f, isTour: e.target.checked }))} />
              This is a touring production
            </label>
            <div className="grid grid-cols-2 gap-3">
              <F label="Start Date"><input type="date" className={inp} style={inpStyle} value={prodForm.startDate} onChange={(e) => setProdForm((f) => ({ ...f, startDate: e.target.value }))} /></F>
              <F label="End Date"><input type="date" className={inp} style={inpStyle} value={prodForm.endDate} onChange={(e) => setProdForm((f) => ({ ...f, endDate: e.target.value }))} /></F>
            </div>
            <F label="Calendar Colour">
              <div className="flex items-center gap-2 flex-wrap">
                {["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16","#f97316","#a855f7"].map(c => (
                  <button key={c} type="button" onClick={() => setProdForm(f => ({ ...f, color: c }))}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: prodForm.color === c ? "white" : "transparent" }} />
                ))}
                <input type="color" value={prodForm.color || "#3b82f6"} onChange={e => setProdForm(f => ({ ...f, color: e.target.value }))}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0" title="Custom colour" style={{ backgroundColor: "transparent" }} />
              </div>
            </F>
            <F label="Show Report Email"><input type="email" className={inp} style={inpStyle} value={prodForm.reportEmail} onChange={(e) => setProdForm((f) => ({ ...f, reportEmail: e.target.value }))} placeholder="reports@example.com" /></F>
            <F label="SharePoint Folder URL"><input type="url" className={inp} style={inpStyle} value={prodForm.sharepointUrl} onChange={(e) => setProdForm((f) => ({ ...f, sharepointUrl: e.target.value }))} placeholder="https://..." /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={prodForm.notes} onChange={(e) => setProdForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--psg-muted)" }}>Production Logo</label>
              <div className="flex items-center gap-3">
                {prod.logoUrl && (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border shrink-0" style={{ borderColor: "var(--psg-card-border)" }}>
                    <Image src={prod.logoUrl} alt={prod.name} fill className="object-contain p-1" />
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="cursor-pointer text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                    {logoUploading ? "Uploading…" : prod.logoUrl ? "Replace logo" : "Upload logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                  </label>
                  {prod.logoUrl && (
                    <button type="button" onClick={removeLogo} className="text-xs px-3 py-1.5 rounded border transition-colors text-red-400 hover:bg-red-900/20" style={{ borderColor: "rgba(248,113,113,0.3)" }}>Remove</button>
                  )}
                </div>
              </div>
            </div>
            <Btns onCancel={() => setEditProd(false)} label="Save Changes" />
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function ProductionView({ id, initialProd }: { id: string; initialProd: Production }) {
  return (
    <Suspense>
      <ProductionPageInner id={id} initialProd={initialProd} />
    </Suspense>
  );
}
