"use client";

import { Fragment, useState } from "react";
import { exportTourSchedulePDF, exportTourScheduleXLSX, exportVenueStopPDF } from "@/lib/exports";
import { orderForTourList, isFinishedStop } from "@/lib/tourStops";
import { confirmDialog } from "@/components/Dialogs";
import { inp, inpStyle, fmtDate, sendJson, useList, type TabProps, type TourStop, type VenueRef } from "../shared";

export default function TourTab({ prod, reload, allVenues }: TabProps & { allVenues: VenueRef[] }) {
  const id = String(prod.id);
  const [tourStops, , reloadTourStops] = useList<TourStop>(`/api/productions/${id}/tour-stops`);
  const [showTourForm, setShowTourForm] = useState(false);
  const [editStop, setEditStop] = useState<TourStop | null>(null);
  const [expandedStopNotes, setExpandedStopNotes] = useState<Set<number>>(new Set());
  const [stopNoteDrafts, setStopNoteDrafts] = useState<Record<number, string>>({});
  const BLANK_STOP = { venueId: "", loadInDate: "", startDate: "", endDate: "", performanceStart: "", performanceEnd: "", notes: "" };
  const [stopForm, setStopForm] = useState(BLANK_STOP);
  const [venueSearch, setVenueSearch] = useState("");
  function closeStopForm() {
    setShowTourForm(false);
    setEditStop(null);
    setStopForm(BLANK_STOP);
    setVenueSearch("");
  }

  // Adding or removing a stop also refetches the production so the header's stop count stays right
  async function saveStop(e: React.FormEvent) {
    e.preventDefault();
    if (editStop) {
      await sendJson(`/api/tour-stops/${editStop.id}`, "PUT", stopForm);
    } else {
      await sendJson(`/api/productions/${id}/tour-stops`, "POST", stopForm);
    }
    closeStopForm();
    reloadTourStops();
    if (!editStop) reload();
  }

  async function deleteStop(stopId: number) {
    if (!await confirmDialog("Remove this tour stop?")) return;
    await fetch(`/api/tour-stops/${stopId}`, { method: "DELETE" });
    reloadTourStops();
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Tour Schedule</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{tourStops.length} {tourStops.length === 1 ? "stop" : "stops"}</p>
        </div>
        <div className="flex items-center gap-2">
          {tourStops.length > 0 && (
            <>
              <button
                onClick={() => exportTourSchedulePDF(prod.name, tourStops, prod.logoUrl)}
                className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
              >↓ PDF</button>
              <button
                onClick={() => void exportTourScheduleXLSX(prod.name, tourStops)}
                className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
              >↓ XLSX</button>
            </>
          )}
          <button
            onClick={() => { setEditStop(null); setStopForm(BLANK_STOP); setShowTourForm(true); }}
            className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
            style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
          >+ Add Stop</button>
        </div>
      </div>

      {showTourForm && (
        <form onSubmit={saveStop} className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-dark-bg)" }}>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Venue *</label>
            <input
              className={inp} style={inpStyle}
              placeholder="Search venues…"
              value={venueSearch}
              onChange={e => setVenueSearch(e.target.value)}
            />
            {venueSearch.length > 0 && (
              <div className="mt-1 rounded border overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
                {allVenues.filter(v => `${v.name} ${v.city ?? ""}`.toLowerCase().includes(venueSearch.toLowerCase())).slice(0, 8).map(v => (
                  <button key={v.id} type="button"
                    className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/10 ${stopForm.venueId === String(v.id) ? "bg-white/10 text-white" : ""}`}
                    style={{ color: stopForm.venueId === String(v.id) ? "white" : "var(--psg-muted)" }}
                    onClick={() => { setStopForm(f => ({ ...f, venueId: String(v.id) })); setVenueSearch(`${v.name}${v.city ? " · " + v.city : ""}`); }}
                  >
                    {v.name}{v.city ? ` · ${v.city}` : ""}{v.capacity ? ` · ${v.capacity.toLocaleString()} cap` : ""}
                  </button>
                ))}
                {allVenues.filter(v => `${v.name} ${v.city ?? ""}`.toLowerCase().includes(venueSearch.toLowerCase())).length === 0 && (
                  <p className="px-3 py-2 text-xs" style={{ color: "var(--psg-muted)" }}>No venues match</p>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Load-in date</label>
              <input type="date" className={inp} style={inpStyle} value={stopForm.loadInDate} onChange={e => setStopForm(f => ({ ...f, loadInDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Get-out date</label>
              <input type="date" className={inp} style={inpStyle} value={stopForm.endDate} onChange={e => setStopForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>First performance</label>
              <input type="date" className={inp} style={inpStyle} value={stopForm.performanceStart} onChange={e => setStopForm(f => ({ ...f, performanceStart: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Last performance</label>
              <input type="date" className={inp} style={inpStyle} value={stopForm.performanceEnd} onChange={e => setStopForm(f => ({ ...f, performanceEnd: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
            <textarea rows={4} className={inp} style={inpStyle} value={stopForm.notes} onChange={e => setStopForm(f => ({ ...f, notes: e.target.value }))} placeholder="Venue-specific show information, special requirements, contacts…" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded text-sm text-white font-medium" style={{ backgroundColor: "var(--psg-blue)" }} disabled={!stopForm.venueId}>
              {editStop ? "Save Changes" : "Add Stop"}
            </button>
            <button type="button" onClick={closeStopForm} className="px-4 py-2 rounded text-sm border hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
          </div>
        </form>
      )}

      {tourStops.length === 0 && !showTourForm && (
        <p className="text-sm py-6 text-center" style={{ color: "var(--psg-muted)" }}>No tour stops added yet.</p>
      )}

      <div className="space-y-2">
        {orderForTourList(tourStops).map((stop, idx, ordered) => {
          // Stops the tour has already left sit at the bottom, under a "Finished" divider, slightly faded
          const left = isFinishedStop(stop, tourStops);
          const firstFinished = left && (idx === 0 || !isFinishedStop(ordered[idx - 1], tourStops));
          const notesOpen = expandedStopNotes.has(stop.id);
          const draft = stopNoteDrafts[stop.id] ?? stop.notes ?? "";
          const toggleNotes = () => {
            setExpandedStopNotes(prev => {
              const next = new Set(prev);
              if (next.has(stop.id)) { next.delete(stop.id); } else {
                next.add(stop.id);
                setStopNoteDrafts(d => ({ ...d, [stop.id]: stop.notes ?? "" }));
              }
              return next;
            });
          };
          const saveNotes = async () => {
            const val = stopNoteDrafts[stop.id] ?? stop.notes ?? "";
            if (val === (stop.notes ?? "")) return;
            await sendJson(`/api/tour-stops/${stop.id}`, "PUT", { notes: val || null });
            reloadTourStops();
          };
          return (
            <Fragment key={stop.id}>
{firstFinished && (
  <p className="text-xs font-semibold uppercase tracking-widest pt-4 pb-1" style={{ color: "var(--psg-muted)" }}>Finished</p>
)}
<div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)", opacity: left ? 0.6 : 1 }}>
              {/* Main row */}
              <div className="flex items-start gap-4 p-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ backgroundColor: "var(--psg-blue)" }}>
                  {stop.stopNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{stop.venue.name}</p>
                  <p className="text-xs" style={{ color: "var(--psg-muted)" }}>
                    {stop.venue.city ?? ""}
                    {stop.venue.capacity ? ` · ${stop.venue.capacity.toLocaleString()} cap` : ""}
                  </p>
                  {stop.loadInDate && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Load in: {fmtDate(stop.loadInDate)}</p>
                  )}
                  {(stop.performanceStart || stop.performanceEnd) && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                      Performances: {stop.performanceStart ? fmtDate(stop.performanceStart) : "?"}
                      {stop.performanceEnd && stop.performanceEnd !== stop.performanceStart ? ` → ${fmtDate(stop.performanceEnd)}` : ""}
                    </p>
                  )}
                  {stop.endDate && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Get out: {fmtDate(stop.endDate)}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => exportVenueStopPDF(prod.name, stop, prod.logoUrl)}
                    className="text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors"
                    style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
                    title="Export venue sheet as PDF"
                  >↓ PDF</button>
                  <button
                    onClick={toggleNotes}
                    className="text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors flex items-center gap-1"
                    style={{ borderColor: "var(--psg-card-border)", color: notesOpen ? "white" : "var(--psg-muted)" }}
                    title={notesOpen ? "Close notes" : "Open notes"}
                  >
                    Notes {stop.notes ? "●" : ""} {notesOpen ? "▲" : "▼"}
                  </button>
                  <button onClick={() => {
                    setEditStop(stop);
                    setStopForm({ venueId: String(stop.venueId), loadInDate: stop.loadInDate ? stop.loadInDate.slice(0, 10) : "", startDate: stop.startDate ? stop.startDate.slice(0, 10) : "", endDate: stop.endDate ? stop.endDate.slice(0, 10) : "", performanceStart: stop.performanceStart ? stop.performanceStart.slice(0, 10) : "", performanceEnd: stop.performanceEnd ? stop.performanceEnd.slice(0, 10) : "", notes: stop.notes ?? "" });
                    setVenueSearch(`${stop.venue.name}${stop.venue.city ? " · " + stop.venue.city : ""}`);
                    setShowTourForm(true);
                  }} className="text-xs px-2 py-1 rounded border hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
                  <button onClick={() => deleteStop(stop.id)} className="text-xs px-2 py-1 rounded border hover:bg-red-900/20 text-red-400" style={{ borderColor: "rgba(248,113,113,0.3)" }}>Remove</button>
                </div>
              </div>
              {/* Notes dropdown */}
              {notesOpen && (
                <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--psg-card-border)" }}>
                  <p className="text-xs pt-3 mb-1.5 font-medium" style={{ color: "var(--psg-muted)" }}>Notes</p>
                  <textarea
                    rows={5}
                    className="w-full text-sm rounded px-3 py-2 resize-y"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid var(--psg-card-border)", color: "white", outline: "none" }}
                    placeholder="Venue-specific show information, special requirements, local contacts…"
                    value={draft}
                    onChange={e => setStopNoteDrafts(d => ({ ...d, [stop.id]: e.target.value }))}
                    onBlur={saveNotes}
                  />
                  <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>Auto-saves when you click away</p>
                </div>
              )}
            </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
