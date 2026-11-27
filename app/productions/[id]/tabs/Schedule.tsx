"use client";

import { useEffect, useState } from "react";
import ExportMenu from "@/components/ExportMenu";
import { exportSchedulePDF, exportScheduleXLSX } from "@/lib/exports";
import { confirmDialog } from "@/components/Dialogs";
import { F, Modal, Btns, inp, inpStyle, fmtDate, fmtTime, sendJson, useList, type PerfOverride, type PerfSchedule, type TabProps } from "../shared";

type KeyDate = { id: number; type: string; label: string | null; startDate: string; endDate: string | null; notes: string | null };

const KEY_DATE_TYPES: { value: string; label: string }[] = [
  { value: "design_presentation", label: "Design Presentation" },
  { value: "pre_production", label: "Pre-Production" },
  { value: "first_rehearsal", label: "First Rehearsal" },
  { value: "rehearsal_period", label: "Rehearsal Period" },
  { value: "load_in", label: "Load In" },
  { value: "fit_up", label: "Fit Up" },
  { value: "technical_rehearsal", label: "Technical Rehearsal" },
  { value: "dress_rehearsal", label: "Dress Rehearsal" },
  { value: "preview", label: "Preview" },
  { value: "press_night", label: "Press Night" },
  { value: "performance", label: "Performance" },
  { value: "get_out", label: "Get Out" },
  { value: "other", label: "Other" },
];
const KEY_DATE_LABEL: Record<string, string> = Object.fromEntries(KEY_DATE_TYPES.map(t => [t.value, t.label]));

const EVENT_TYPES = ["Rehearsal", "Tech", "Dress Rehearsal", "Performance", "Meeting", "Workshop", "Other"];

const EVENT_COLORS: Record<string, string> = {
  Rehearsal: "bg-blue-900/70 text-blue-300",
  Tech: "bg-purple-900/70 text-purple-300",
  "Dress Rehearsal": "bg-indigo-900/70 text-indigo-300",
  Performance: "bg-green-900/70 text-green-300",
  Meeting: "bg-yellow-900/70 text-yellow-300",
  Workshop: "bg-orange-900/70 text-orange-300",
  Other: "bg-white/10 text-white/60",
};

export default function ScheduleTab({ prod, reload }: TabProps) {
  const id = String(prod.id);
  const BLANK_KD = { type: "first_rehearsal", label: "", startDate: "", endDate: "", notes: "" };
  const [keyDates, , reloadKeyDates] = useList<KeyDate>(`/api/productions/${id}/key-dates`);
  const [showKdForm, setShowKdForm] = useState(false);
  const [editKd, setEditKd] = useState<KeyDate | null>(null);
  const [kdForm, setKdForm] = useState(BLANK_KD);

  // Performance schedule
  const [perfSchedule, setPerfSchedule] = useState<PerfSchedule>(null);
  const [perfOverrides, setPerfOverrides] = useState<PerfOverride[]>([]);
  async function reloadPerfSchedule() {
    const data = await fetch(`/api/productions/${id}/performance-schedule`).then(r => r.json());
    setPerfSchedule(data.schedule ?? null);
    if (Array.isArray(data.overrides)) setPerfOverrides(data.overrides);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { reloadPerfSchedule(); }, [id]);

  const BLANK_EVENT = { title: "", type: "Rehearsal", startAt: "", endAt: "", location: "", notes: "" };
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState(BLANK_EVENT);

  async function saveKd(e: React.FormEvent) {
    e.preventDefault();
    if (editKd) {
      await sendJson(`/api/key-dates/${editKd.id}`, "PUT", kdForm);
    } else {
      await sendJson(`/api/productions/${id}/key-dates`, "POST", kdForm);
    }
    setShowKdForm(false);
    setEditKd(null);
    setKdForm(BLANK_KD);
    reloadKeyDates();
  }

  async function deleteKd(kdId: number) {
    await fetch(`/api/key-dates/${kdId}`, { method: "DELETE" });
    reloadKeyDates();
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    await sendJson(`/api/productions/${id}/events`, "POST", eventForm);
    setShowEventForm(false);
    setEventForm(BLANK_EVENT);
    reload();
  }

  async function deleteEvent(eid: number) {
    if (!await confirmDialog("Delete this event?")) return;
    await fetch(`/api/events/${eid}`, { method: "DELETE" });
    reload();
  }

  return (
    <>
      <div className="space-y-6">

        {/* ── Key Dates ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Key Dates</h3>
            <button onClick={() => { setEditKd(null); setKdForm(BLANK_KD); setShowKdForm(true); }}
              className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
              style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              + Add Key Date
            </button>
          </div>

          {showKdForm && (
            <form onSubmit={saveKd} className="rounded-lg border p-4 mb-3 space-y-3" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-dark-bg)" }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
                  <select required value={kdForm.type} onChange={e => setKdForm(f => ({ ...f, type: e.target.value }))} className={inp} style={inpStyle}>
                    {KEY_DATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Custom label <span style={{ color: "var(--psg-muted)" }}>(optional)</span></label>
                  <input value={kdForm.label} onChange={e => setKdForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Press Night — Lyttelton" className={inp} style={inpStyle} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Start date</label>
                  <input required type="date" value={kdForm.startDate} onChange={e => setKdForm(f => ({ ...f, startDate: e.target.value }))} className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>End date <span style={{ color: "var(--psg-muted)" }}>(optional)</span></label>
                  <input type="date" value={kdForm.endDate} onChange={e => setKdForm(f => ({ ...f, endDate: e.target.value }))} className={inp} style={inpStyle} />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
                <input value={kdForm.notes} onChange={e => setKdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" className={inp} style={inpStyle} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>
                  {editKd ? "Save" : "Add"}
                </button>
                <button type="button" onClick={() => { setShowKdForm(false); setEditKd(null); }} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
              </div>
            </form>
          )}

          {keyDates.length === 0 && !showKdForm && (
            <p className="text-sm py-3" style={{ color: "var(--psg-muted)" }}>No key dates yet. Add milestones to show on the central calendar.</p>
          )}
          <div className="space-y-1.5">
            {keyDates.map(kd => (
              <div key={kd.id} className="rounded-lg border px-4 py-3 flex items-center gap-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{kd.label || KEY_DATE_LABEL[kd.type] || kd.type}</span>
                    {kd.label && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">{KEY_DATE_LABEL[kd.type]}</span>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                    {fmtDate(kd.startDate)}
                    {kd.endDate && kd.endDate.slice(0,10) !== kd.startDate.slice(0,10) && ` → ${fmtDate(kd.endDate)}`}
                    {kd.notes && ` · ${kd.notes}`}
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => { setEditKd(kd); setKdForm({ type: kd.type, label: kd.label ?? "", startDate: kd.startDate.slice(0,10), endDate: kd.endDate?.slice(0,10) ?? "", notes: kd.notes ?? "" }); setShowKdForm(true); }}
                    className="text-xs hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>Edit</button>
                  <button onClick={() => deleteKd(kd.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Performance Schedule ── */}
        {!prod.isTour && (
          <PerformanceSchedulePanel
            productionId={prod.id}
            openingNight={keyDates.find(k => k.type === "preview" || k.type === "press_night" || k.type === "performance")?.startDate ?? prod.startDate}
            closingNight={(() => {
              const getOut = keyDates.find(k => k.type === "get_out");
              if (getOut) return getOut.startDate;
              const perfsWithEnd = keyDates.filter(k => k.type === "performance" && k.endDate);
              if (perfsWithEnd.length > 0) return perfsWithEnd[perfsWithEnd.length - 1].endDate;
              const anyPerfs = keyDates.filter(k => k.type === "performance");
              if (anyPerfs.length > 0) return anyPerfs[anyPerfs.length - 1].startDate;
              return prod.endDate;
            })()}
            schedule={perfSchedule}
            overrides={perfOverrides}
            onSave={reloadPerfSchedule}
          />
        )}

        {/* ── Daily Schedule ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Daily Schedule</h3>
            <div className="flex gap-2">
              <ExportMenu actions={[
                { label: "Export PDF", onClick: () => exportSchedulePDF(prod.name, prod.events, prod.logoUrl) },
                { label: "Export Excel", onClick: () => void exportScheduleXLSX(prod.name, prod.events) },
              ]} />
              <button onClick={() => setShowEventForm(true)} className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                + Add Event
              </button>
            </div>
          </div>
          {prod.events.length === 0 && <p className="text-sm py-3" style={{ color: "var(--psg-muted)" }}>No events yet.</p>}
          <div className="space-y-1.5">
            {prod.events.map((ev) => (
              <div key={ev.id} className="rounded-lg border px-4 py-3 flex items-start justify-between gap-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-white">{ev.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${EVENT_COLORS[ev.type] ?? "bg-white/10 text-white/60"}`}>{ev.type}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                    {fmtDate(ev.startAt)} · {fmtTime(ev.startAt)}–{fmtTime(ev.endAt)}
                    {ev.location && ` · ${ev.location}`}
                  </p>
                  {ev.notes && <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{ev.notes}</p>}
                </div>
                <button onClick={() => deleteEvent(ev.id)} className="text-xs text-red-400 hover:text-red-300 shrink-0">Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showEventForm && (
        <Modal title="Add Event" onClose={() => setShowEventForm(false)}>
          <form onSubmit={saveEvent} className="space-y-3">
            <F label="Title *"><input required className={inp} style={inpStyle} value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} /></F>
            <F label="Type"><select className={inp} style={inpStyle} value={eventForm.type} onChange={(e) => setEventForm((f) => ({ ...f, type: e.target.value }))}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Start *"><input required type="datetime-local" className={inp} style={inpStyle} value={eventForm.startAt} onChange={(e) => setEventForm((f) => ({ ...f, startAt: e.target.value }))} /></F>
              <F label="End *"><input required type="datetime-local" className={inp} style={inpStyle} value={eventForm.endAt} onChange={(e) => setEventForm((f) => ({ ...f, endAt: e.target.value }))} /></F>
            </div>
            <F label="Location"><input className={inp} style={inpStyle} value={eventForm.location} onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))} /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={eventForm.notes} onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => setShowEventForm(false)} />
          </form>
        </Modal>
      )}
    </>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function PerformanceSchedulePanel({
  productionId, openingNight, closingNight, schedule, overrides, onSave,
}: {
  productionId: number;
  openingNight: string | null | undefined;
  closingNight: string | null | undefined;
  schedule: PerfSchedule;
  overrides: PerfOverride[];
  onSave: () => void;
}) {
  const [weekPattern, setWeekPattern] = useState(schedule?.weekPattern ?? 0);
  const [matineePattern, setMatineePattern] = useState(schedule?.matineePattern ?? 0);
  const [saving, setSaving] = useState(false);

  // Sync when schedule prop changes (e.g. after first save) — adjusted during render rather than in an effect
  const [syncedPatterns, setSyncedPatterns] = useState({ week: schedule?.weekPattern, matinee: schedule?.matineePattern });
  if (syncedPatterns.week !== schedule?.weekPattern || syncedPatterns.matinee !== schedule?.matineePattern) {
    setSyncedPatterns({ week: schedule?.weekPattern, matinee: schedule?.matineePattern });
    setWeekPattern(schedule?.weekPattern ?? 0);
    setMatineePattern(schedule?.matineePattern ?? 0);
  }

  function toggleBit(pattern: number, bit: number) { return pattern ^ (1 << bit); }
  function hasBit(pattern: number, bit: number) { return !!(pattern & (1 << bit)); }

  async function savePattern() {
    setSaving(true);
    await sendJson(`/api/productions/${productionId}/performance-schedule`, "PUT", { weekPattern, matineePattern });
    setSaving(false);
    onSave();
  }

  async function toggleOverride(dateStr: string, isCurrentlyOn: boolean, isMatinee: boolean) {
    const type = isMatinee
      ? (isCurrentlyOn ? "matinee_remove" : "matinee_add")
      : (isCurrentlyOn ? "remove" : "add");
    // Remove any conflicting override for this date+kind first
    const conflicting = overrides.find(o => o.date === dateStr && (
      isMatinee ? (o.type === "matinee_add" || o.type === "matinee_remove")
                : (o.type === "add" || o.type === "remove")
    ));
    if (conflicting) {
      await sendJson(`/api/productions/${productionId}/performance-schedule`, "POST", { date: dateStr, type: conflicting.type });
    }
    await sendJson(`/api/productions/${productionId}/performance-schedule`, "POST", { date: dateStr, type });
    onSave();
  }

  // Build calendar grid
  const start = openingNight ? new Date(openingNight) : null;
  const end = closingNight ? new Date(closingNight) : null;

  const overrideMap = new Map<string, string>();
  overrides.forEach(o => overrideMap.set(`${o.date}:${o.type.startsWith("matinee") ? "matinee" : "evening"}`, o.type));

  function getDayBit(date: Date) {
    const d = date.getDay(); // 0=Sun
    return d === 0 ? 6 : d - 1; // Mon=0 ... Sun=6
  }

  function isPerformance(date: Date) {
    const dateStr = date.toISOString().slice(0, 10);
    const bit = getDayBit(date);
    const baseOn = hasBit(weekPattern, bit);
    const override = overrideMap.get(`${dateStr}:evening`);
    if (override === "add") return true;
    if (override === "remove") return false;
    return baseOn;
  }

  function isMatinee(date: Date) {
    const dateStr = date.toISOString().slice(0, 10);
    const bit = getDayBit(date);
    const baseOn = hasBit(matineePattern, bit);
    const override = overrideMap.get(`${dateStr}:matinee`);
    if (override === "matinee_add") return true;
    if (override === "matinee_remove") return false;
    return baseOn;
  }

  // Build weeks
  type CalDay = { date: Date; dateStr: string; inRun: boolean; perf: boolean; matinee: boolean };
  const weeks: CalDay[][] = [];
  if (start && end) {
    // Go back to Monday of opening week
    const cur = new Date(start);
    const startDay = cur.getDay(); // 0=Sun
    const daysBack = startDay === 0 ? 6 : startDay - 1;
    cur.setDate(cur.getDate() - daysBack);

    while (cur <= end || weeks.length === 0) {
      const week: CalDay[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(cur);
        const dateStr = date.toISOString().slice(0, 10);
        const inRun = date >= start && date <= end;
        week.push({ date, dateStr, inRun, perf: inRun && isPerformance(date), matinee: inRun && isMatinee(date) });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
      if (cur > end) break;
    }
  }

  const totalPerf = weeks.flat().filter(d => d.perf).length;
  const totalMatineeOnly = weeks.flat().filter(d => d.matinee && !d.perf).length;
  const totalMatinee = weeks.flat().filter(d => d.matinee).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Performance Schedule</h3>
        {(totalPerf > 0 || totalMatineeOnly > 0) && (
          <span className="text-xs" style={{ color: "var(--psg-muted)" }}>
            {totalPerf > 0 ? `${totalPerf} evening${totalPerf !== 1 ? "s" : ""}` : ""}
            {totalPerf > 0 && totalMatineeOnly > 0 ? " · " : ""}
            {totalMatineeOnly > 0 ? `${totalMatineeOnly} matinee-only` : ""}
            {totalMatinee > 0 && totalPerf > 0 ? ` · ${totalMatinee} matinee${totalMatinee !== 1 ? "s" : ""} total` : ""}
          </span>
        )}
      </div>

      {/* Pattern pickers — grid of days × Eve/Mat */}
      <div className="rounded-lg border p-4 mb-4" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse" style={{ minWidth: 360 }}>
            <thead>
              <tr>
                <th className="text-right pr-3 pb-1.5 font-normal w-12" style={{ color: "var(--psg-muted)" }}></th>
                {DAYS.map(d => (
                  <th key={d} className="text-center pb-1.5 font-medium px-1" style={{ color: "var(--psg-muted)", minWidth: 44 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-right pr-3 py-1 font-medium" style={{ color: "#c4b5fd", whiteSpace: "nowrap" }}>Matinee</td>
                {DAYS.map((day, i) => (
                  <td key={day} className="text-center px-1 py-1">
                    <button type="button"
                      onClick={() => setMatineePattern(p => toggleBit(p, i))}
                      className="w-9 h-7 rounded text-xs font-medium transition-colors"
                      style={hasBit(matineePattern, i)
                        ? { backgroundColor: "#7c3aed", color: "#fff" }
                        : { backgroundColor: "rgba(255,255,255,0.05)", color: "var(--psg-muted)", border: "1px solid var(--psg-card-border)" }}>
                      M
                    </button>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="text-right pr-3 py-1 font-medium" style={{ color: "#93c5fd", whiteSpace: "nowrap" }}>Evening</td>
                {DAYS.map((day, i) => (
                  <td key={day} className="text-center px-1 py-1">
                    <button type="button"
                      onClick={() => setWeekPattern(p => toggleBit(p, i))}
                      className="w-9 h-7 rounded text-xs font-medium transition-colors"
                      style={hasBit(weekPattern, i)
                        ? { backgroundColor: "var(--psg-blue)", color: "#fff" }
                        : { backgroundColor: "rgba(255,255,255,0.05)", color: "var(--psg-muted)", border: "1px solid var(--psg-card-border)" }}>
                      E
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-2 mb-3" style={{ color: "var(--psg-muted)" }}>
          A day can have Evening only, Matinee only, or both. Matinee-only days appear in purple.
        </p>
        <button onClick={savePattern} disabled={saving}
          className="text-white text-xs px-3 py-1.5 rounded font-medium hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--psg-blue)" }}>
          {saving ? "Saving…" : "Save pattern"}
        </button>
      </div>

      {/* Calendar grid */}
      {!start || !end ? (
        <p className="text-sm py-2" style={{ color: "var(--psg-muted)" }}>
          Set an opening night and closing night in Key Dates to see the calendar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full" style={{ minWidth: 420 }}>
            <thead>
              <tr>
                {DAYS.map(d => (
                  <th key={d} className="text-center pb-1.5 font-medium" style={{ color: "var(--psg-muted)", width: "14.28%" }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map(({ date, dateStr, inRun, perf, matinee }) => {
                    const hasOverride = overrideMap.has(`${dateStr}:evening`) || overrideMap.has(`${dateStr}:matinee`);
                    return (
                      <td key={dateStr} className="p-0.5" style={{ verticalAlign: "top" }}>
                        <div
                          className="rounded p-1 text-center transition-colors"
                          style={{
                            backgroundColor: !inRun ? "transparent"
                              : perf && matinee ? "rgba(99,60,219,0.2)"
                              : perf ? "rgba(59,130,246,0.15)"
                              : matinee ? "rgba(124,58,237,0.15)"
                              : "rgba(255,255,255,0.03)",
                            border: inRun ? `1px solid ${perf ? "rgba(59,130,246,0.3)" : matinee ? "rgba(124,58,237,0.4)" : "var(--psg-card-border)"}` : "1px solid transparent",
                            opacity: !inRun ? 0.3 : 1,
                            cursor: inRun ? "pointer" : "default",
                            minHeight: 44,
                          }}
                          onClick={() => inRun && toggleOverride(dateStr, perf, false)}
                          onContextMenu={e => { if (inRun) { e.preventDefault(); toggleOverride(dateStr, matinee, true); } }}
                          title={inRun ? `${dateStr}${perf && matinee ? " · Evening + Matinee" : perf ? " · Evening" : matinee ? " · Matinee only" : " · Dark"}\nClick to toggle evening · Right-click to toggle matinee` : undefined}
                        >
                          <div className="font-medium" style={{ color: (perf || matinee) ? "#fff" : "var(--psg-muted)" }}>
                            {date.getDate()}
                          </div>
                          <div className="mt-0.5 flex gap-0.5 justify-center">
                            {matinee && (
                              <span style={{ fontSize: 8, lineHeight: 1, padding: "1px 3px", borderRadius: 3, backgroundColor: "rgba(124,58,237,0.4)", color: "#c4b5fd" }}>M</span>
                            )}
                            {perf && (
                              <span style={{ fontSize: 8, lineHeight: 1, padding: "1px 3px", borderRadius: 3, backgroundColor: "rgba(59,130,246,0.4)", color: "#93c5fd" }}>E</span>
                            )}
                          </div>
                          {hasOverride && (
                            <div className="mt-0.5 mx-auto w-1 h-1 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs mt-2" style={{ color: "var(--psg-muted)" }}>
            Click to toggle evening · Right-click to toggle matinee · <span style={{ color: "#93c5fd" }}>E</span> = evening · <span style={{ color: "#c4b5fd" }}>M</span> = matinee · <span style={{ color: "#f59e0b" }}>●</span> = overridden
          </p>
        </div>
      )}
    </div>
  );
}