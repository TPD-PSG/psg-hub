// "Days logged" card: the log-days form and the list of time entries on the build.
import { useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import { fmtDate } from "@/lib/format";
import { card, h2, muted, btnSolid, input, label as lbl } from "@/lib/twsUi";
import { today, type Call, type Me } from "./spaceJobTypes";

export default function DaysLoggedPanel({ job, me, busy, call, reload }: { job: JobDetail; me: Me; busy: boolean; call: Call; reload: () => void }) {
  const [time, setTime] = useState({ date: today(), days: "1", note: "" });
  async function logTime(e: React.FormEvent) { e.preventDefault(); if (await call(`/api/jobs/${job.id}/time`, "POST", time)) { setTime(t => ({ ...t, note: "" })); reload(); } }
  async function removeTime(id: number) { if (await confirmDialog("Remove this time entry?") && await call(`/api/jobs/${job.id}/time/${id}`, "DELETE")) reload(); }

  return (
    <section id="log-days" style={card} className="flex flex-col gap-3.5 scroll-mt-20">
      <h2 style={h2}>Days logged</h2>
      <form onSubmit={logTime} className="grid gap-2 items-end sm:grid-cols-[1fr_90px_2fr_auto]">
        <div><label htmlFor="t-date" style={lbl}>Date</label><input id="t-date" type="date" required style={input} value={time.date} onChange={e => setTime({ ...time, date: e.target.value })} /></div>
        <div><label htmlFor="t-days" style={lbl}>Days</label>
          <select id="t-days" style={input} value={time.days} onChange={e => setTime({ ...time, days: e.target.value })}>{[0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div><label htmlFor="t-note" style={lbl}>Note</label><input id="t-note" style={input} value={time.note} onChange={e => setTime({ ...time, note: e.target.value })} placeholder="e.g. rostra and trial fit" /></div>
        <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Log days</button>
      </form>
      {job.time.length === 0 ? <p className="text-sm" style={muted}>No days logged yet.</p> : (
        <ul className="flex flex-col">
          {job.time.map(t => (
            <li key={t.id} className="py-2 flex justify-between gap-3 text-sm group" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
              <span><strong>{t.user.name}</strong> · {t.days} day{t.days === 1 ? "" : "s"} <span style={muted}>· {fmtDate(t.date)}{t.note ? ` · ${t.note}` : ""}</span></span>
              {(t.userId === me.id || me.isAdmin) && <button type="button" onClick={() => removeTime(t.id)} className="text-xs font-semibold" style={{ color: "var(--tws-bad-ink)" }} aria-label="Remove time entry">Remove</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
