"use client";

import { useState } from "react";
import { sendJson, useList, type Production, type TabProps, type TourStop } from "../shared";

export default function AdvancingTab({ prod, setProd }: TabProps) {
  const id = String(prod.id);
  const [tourStops, , reloadTourStops] = useList<TourStop>(`/api/productions/${id}/tour-stops`);

  return (
    <AdvancingBoard tourStops={tourStops}
      production={prod.isTour ? null : prod}
      onStatusChange={async (stopId, status) => {
        await sendJson(`/api/tour-stops/${stopId}`, "PUT", { advancingStatus: status });
        reloadTourStops();
      }}
      onContraChange={async (stopId, field, value) => {
        await sendJson(`/api/tour-stops/${stopId}`, "PUT", { [field]: value === "" ? null : Number(value) });
        reloadTourStops();
      }}
      onProdStatusChange={async (status) => {
        await sendJson(`/api/productions/${prod.id}`, "PATCH", { advancingStatus: status });
        setProd(p => p ? { ...p, advancingStatus: status } : p);
      }}
      onProdContraChange={async (field, value) => {
        await sendJson(`/api/productions/${prod.id}`, "PATCH", { [field]: value === "" ? null : Number(value) });
        setProd(p => p ? { ...p, [field]: value === "" ? null : Number(value) } : p);
      }}
    />
  );
}

const ADVANCING_COLUMNS = [
  { key: "triage",           label: "Triage",              color: "#6b7280" },
  { key: "rider_released",   label: "Rider Released",      color: "#b45309" },
  { key: "contra_in",        label: "Contra Estimate In",  color: "#1d4ed8" },
  { key: "plans_drawn",      label: "Plans Drawn",         color: "#6d28d9" },
  { key: "email_released",   label: "Full Email Released", color: "#0e7490" },
  { key: "in_venue",         label: "In Venue",            color: "#15803d" },
  { key: "closed",           label: "Closed / Pre Contra", color: "#b91c1c" },
];

function AdvancingBoard({ tourStops, production, onStatusChange, onContraChange, onProdStatusChange, onProdContraChange }: {
  tourStops: TourStop[];
  production: Production | null;
  onStatusChange: (stopId: number, status: string) => Promise<void>;
  onContraChange: (stopId: number, field: "contraEstimate" | "contraActual", value: string) => Promise<void>;
  onProdStatusChange: (status: string) => Promise<void>;
  onProdContraChange: (field: "contraEstimate" | "contraActual", value: string) => Promise<void>;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [contraEdits, setContraEdits] = useState<Record<string, string>>({});
  const [contraOpen, setContraOpen] = useState<Record<number, boolean>>({});
  const [prodContraOpen, setProdContraOpen] = useState(false);
  const [prodContraEdits, setProdContraEdits] = useState<Record<string, string>>({});

  // Non-touring: show single-venue kanban
  if (production !== null) {
    const venue = production.venueRef ?? (production.venue ? { id: 0, name: production.venue, city: null } : null);
    if (!venue) {
      return <div className="p-6 text-sm" style={{ color: "var(--psg-muted)" }}>No venue set — add one in the production details.</div>;
    }
    const currentStatus = production.advancingStatus || "triage";
    return (
      <div className="p-4 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {ADVANCING_COLUMNS.map(col => {
            const isActive = currentStatus === col.key;
            return (
              <div
                key={col.key}
                className="flex flex-col rounded-lg w-52 shrink-0"
                style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--psg-card-border)" }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={async e => { e.preventDefault(); setDragOver(null); if (e.dataTransfer.getData("prod") === "1") await onProdStatusChange(col.key); }}
              >
                <div className="px-3 py-2.5 rounded-t-lg flex items-center justify-between"
                  style={{ backgroundColor: col.color + "22", borderBottom: `2px solid ${col.color}` }}>
                  <span className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</span>
                  <span className="text-xs rounded-full px-1.5 py-0.5 font-medium" style={{ backgroundColor: col.color + "33", color: col.color }}>{isActive ? 1 : 0}</span>
                </div>
                <div className="flex-1 p-2 space-y-2 min-h-20 transition-colors rounded-b-lg"
                  style={{ backgroundColor: dragOver === col.key ? col.color + "11" : undefined }}>
                  {isActive && (
                    <div
                      draggable
                      onDragStart={e => { e.dataTransfer.setData("prod", "1"); }}
                      className="rounded-lg p-2.5 cursor-grab active:cursor-grabbing select-none"
                      style={{ backgroundColor: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)" }}
                    >
                      <div className="text-xs font-semibold text-white mb-0.5">{venue.name}</div>
                      {venue.city && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{venue.city}</div>}
                      <div className="mt-2" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        <button
                          className="text-xs underline"
                          style={{ color: "var(--psg-muted)" }}
                          onClick={() => setProdContraOpen(o => !o)}
                        >
                          {prodContraOpen ? "Hide contra" : `Contra${production.contraEstimate != null ? ` £${production.contraEstimate.toLocaleString()}` : ""}`}
                        </button>
                        {prodContraOpen && (
                          <div className="mt-1.5 space-y-1">
                            {(["contraEstimate", "contraActual"] as const).map(f => (
                              <div key={f} className="flex items-center gap-1">
                                <span className="text-xs w-16 shrink-0" style={{ color: "var(--psg-muted)" }}>{f === "contraEstimate" ? "Est." : "Actual"}</span>
                                <input
                                  type="number"
                                  className="flex-1 rounded px-1.5 py-0.5 text-xs"
                                  style={{ background: "var(--psg-input-bg)", border: "1px solid var(--psg-card-border)", color: "white", width: "100%" }}
                                  value={prodContraEdits[f] ?? (production[f] != null ? String(production[f]) : "")}
                                  onChange={e => setProdContraEdits(v => ({ ...v, [f]: e.target.value }))}
                                  onBlur={async () => { if (f in prodContraEdits) { await onProdContraChange(f, prodContraEdits[f] ?? ""); setProdContraEdits(v => { const n = { ...v }; delete n[f]; return n; }); } }}
                                  placeholder="£"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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

  if (tourStops.length === 0) {
    return <div className="p-6 text-sm" style={{ color: "var(--psg-muted)" }}>No tour stops yet — add them in Tour Stops first.</div>;
  }

  function fmtDate(s: string | null) {
    if (!s) return null;
    return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <div className="p-4 overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {ADVANCING_COLUMNS.map(col => {
          const stops = tourStops.filter(s => (s.advancingStatus || "triage") === col.key);
          return (
            <div
              key={col.key}
              className="flex flex-col rounded-lg w-52 shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--psg-card-border)" }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={async e => {
                e.preventDefault();
                setDragOver(null);
                const stopId = Number(e.dataTransfer.getData("stopId"));
                if (stopId) await onStatusChange(stopId, col.key);
              }}
            >
              {/* Column header */}
              <div
                className="px-3 py-2.5 rounded-t-lg flex items-center justify-between"
                style={{ backgroundColor: col.color + "22", borderBottom: `2px solid ${col.color}` }}
              >
                <span className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</span>
                <span className="text-xs rounded-full px-1.5 py-0.5 font-medium" style={{ backgroundColor: col.color + "33", color: col.color }}>{stops.length}</span>
              </div>

              {/* Drop highlight */}
              <div
                className="flex-1 p-2 space-y-2 min-h-20 transition-colors rounded-b-lg"
                style={{ backgroundColor: dragOver === col.key ? col.color + "11" : undefined }}
              >
                {stops
                  .sort((a, b) => a.stopNumber - b.stopNumber)
                  .map(stop => (
                    <div
                      key={stop.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData("stopId", String(stop.id)); setDragging(stop.id); }}
                      onDragEnd={() => setDragging(null)}
                      className="rounded-lg p-2.5 cursor-grab active:cursor-grabbing select-none transition-opacity"
                      style={{
                        backgroundColor: "var(--psg-card-bg)",
                        border: "1px solid var(--psg-card-border)",
                        opacity: dragging === stop.id ? 0.4 : 1,
                      }}
                    >
                      <div className="text-xs font-semibold text-white mb-0.5">
                        {stop.stopNumber} · {stop.venue.name}
                      </div>
                      {stop.venue.city && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{stop.venue.city}</div>}
                      {(stop.loadInDate || stop.startDate) && (
                        <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
                          {fmtDate(stop.loadInDate ?? stop.startDate)}
                          {stop.endDate ? ` – ${fmtDate(stop.endDate)}` : ""}
                        </div>
                      )}
                      {/* Contra fields */}
                      <div className="mt-2" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setContraOpen(o => ({ ...o, [stop.id]: !o[stop.id] }))}
                          className="flex items-center gap-1 text-xs transition-colors hover:text-white"
                          style={{ color: (stop.contraEstimate != null || stop.contraActual != null) ? "#fde047" : "var(--psg-muted)" }}
                        >
                          <span>{contraOpen[stop.id] ? "▾" : "▸"}</span>
                          <span>Contra{stop.contraEstimate != null ? ` £${stop.contraEstimate.toLocaleString()}` : ""}{stop.contraActual != null ? ` / £${stop.contraActual.toLocaleString()}` : ""}</span>
                        </button>
                        {contraOpen[stop.id] && (
                          <div className="mt-1.5 space-y-1">
                            {(["contraEstimate", "contraActual"] as const).map(field => {
                              const key = `${stop.id}-${field}`;
                              const label = field === "contraEstimate" ? "Est." : "Act.";
                              const color = field === "contraEstimate" ? "#fde047" : "#fb923c";
                              const stored = stop[field];
                              const editing = contraEdits[key] !== undefined;
                              return (
                                <div key={field} className="flex items-center gap-1.5">
                                  <span className="text-xs w-6 shrink-0" style={{ color: "var(--psg-muted)" }}>{label}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="flex-1 text-xs rounded px-1.5 py-1 w-full"
                                    style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid var(--psg-card-border)", color, outline: "none", minWidth: 0 }}
                                    value={editing ? contraEdits[key] : (stored != null ? String(stored) : "")}
                                    placeholder="—"
                                    onFocus={() => setContraEdits(c => ({ ...c, [key]: stored != null ? String(stored) : "" }))}
                                    onChange={e => setContraEdits(c => ({ ...c, [key]: e.target.value }))}
                                    onBlur={async () => {
                                      const val = contraEdits[key] ?? "";
                                      setContraEdits(c => { const n = { ...c }; delete n[key]; return n; });
                                      if (val !== (stored != null ? String(stored) : "")) {
                                        await onContraChange(stop.id, field, val);
                                      }
                                    }}
                                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}