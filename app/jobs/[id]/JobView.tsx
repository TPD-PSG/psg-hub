"use client";

// One job: price vs actual cost and margin (for those who may see money), days logged by each
// person, costs, PSG expenses from the show's budget (PM jobs) and the job's quotes.
import { useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { jobTypeLabel } from "@/lib/quotes";
import { COST_CATEGORIES, type JobFigures } from "@/lib/jobCosting";
import { fmtDate } from "@/lib/format";
import { JOB_STATUS } from "../JobsView";

type Option = { id: number; name: string };
export type JobDetail = {
  id: number; number: string; title: string; jobType: string; status: string; price: number | null; notes: string | null;
  startDate: string | null; endDate: string | null;
  entity: Option | null; client: Option | null; opportunity: { id: number; title: string } | null; production: Option | null;
  quotes: { id: number; number: string; status: string; title: string }[];
  time: { id: number; userId: number; date: string; days: number; dayRate: number | null; note: string | null; user: Option }[];
  costs: { id: number; date: string; description: string; supplier: string | null; category: string | null; amount: number; createdBy: { name: string } | null }[];
  psgExpenses: { description: string; supplier: string | null; spent: number; committed: number }[];
  figures: JobFigures | null;
};

const gbp = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n));
const inp = "w-full rounded px-2 py-1.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
const card = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
const today = () => new Date().toISOString().slice(0, 10);
const DAY_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export default function JobView({ initial, seeMoney, me, staff }: { initial: JobDetail; seeMoney: boolean; me: { id: number; isAdmin: boolean }; staff: Option[] }) {
  const [job, setJob] = useState(initial);
  const [time, setTime] = useState({ date: today(), days: "1", note: "", userId: "" });
  const [cost, setCost] = useState({ date: today(), description: "", supplier: "", category: "", amount: "" });
  const [busy, setBusy] = useState(false);

  async function reload() {
    const d = await fetch(`/api/jobs/${job.id}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (d?.job) setJob(d.job);
  }
  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { await alertDialog((await res.json().catch(() => ({}))).error ?? "That didn't work"); return false; }
    return true;
  }
  async function logTime(e: React.FormEvent) {
    e.preventDefault();
    if (await call(`/api/jobs/${job.id}/time`, "POST", { ...time, userId: time.userId || undefined })) { setTime(t => ({ ...t, note: "" })); reload(); }
  }
  async function logCost(e: React.FormEvent) {
    e.preventDefault();
    if (await call(`/api/jobs/${job.id}/costs`, "POST", cost)) { setCost({ date: today(), description: "", supplier: "", category: "", amount: "" }); reload(); }
  }
  async function removeTime(id: number) {
    if (await confirmDialog("Remove this time entry?") && await call(`/api/jobs/${job.id}/time/${id}`, "DELETE")) reload();
  }
  async function removeCost(id: number) {
    if (await confirmDialog("Remove this cost?") && await call(`/api/jobs/${job.id}/costs/${id}`, "DELETE")) reload();
  }
  async function setStatus(status: string) {
    if (await call(`/api/jobs/${job.id}`, "PUT", { status })) reload();
  }

  const f = job.figures;
  const st = JOB_STATUS[job.status];
  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link href="/jobs" className="text-xs" style={{ color: "var(--psg-muted)" }}>← Jobs</Link>
          <h1 className="text-2xl font-bold text-white mt-1 break-words">{job.title}</h1>
          <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
            {job.number} · {jobTypeLabel(job.jobType)} · <span style={{ color: st?.color }}>{st?.label ?? job.status}</span>
            {job.entity && ` · ${job.entity.name}`}
            {job.client && <> · <Link href={`/bd/clients/${job.client.id}`} className="text-blue-400">{job.client.name}</Link></>}
            {job.production && <> · <Link href={`/productions/${job.production.id}`} className="text-blue-400">{job.production.name}</Link></>}
          </p>
        </div>
        {seeMoney && (
          <div className="flex gap-2">
            {job.status !== "complete" && <button type="button" onClick={() => setStatus("complete")} className="border px-3 py-2 rounded text-sm" style={{ borderColor: "#1fae7a", color: "#1fae7a" }}>Mark complete</button>}
            {job.status !== "active" && <button type="button" onClick={() => setStatus("active")} className="border px-3 py-2 rounded text-sm" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Reopen</button>}
            {job.status === "active" && <button type="button" onClick={() => setStatus("cancelled")} className="text-sm px-2" style={{ color: "var(--psg-muted)" }}>Cancel job</button>}
          </div>
        )}
      </div>

      {/* Quote vs actual */}
      {seeMoney && f && (
        <div className="rounded-lg border p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={card}>
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Price</div>
            <div className="text-xl font-bold text-white tabular-nums">{gbp(f.price)}</div>
            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{f.priceFrom === "quote" ? "accepted quote, ex VAT" : f.priceFrom === "agreed" ? "agreed price" : f.priceFrom === "pm fee" ? "the show's PM fee" : "no accepted quote yet"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Actual cost</div>
            <div className="text-xl font-bold text-white tabular-nums">{gbp(f.actual)}</div>
            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>
              {f.quotedCost != null ? `quoted ${gbp(f.quotedCost)} · ` : ""}{f.actual && f.quotedCost ? `${Math.round((f.actual / f.quotedCost) * 100)}% of quote` : ""}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Margin</div>
            <div className="text-xl font-bold tabular-nums" style={{ color: f.margin != null && f.margin < 0 ? "#f87171" : "#1fae7a" }}>{gbp(f.margin)}{f.marginPct != null && <span className="text-sm"> · {Math.round(f.marginPct)}%</span>}</div>
            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{f.quotedMargin != null ? `quoted ${gbp(f.quotedMargin)}` : ""}</div>
          </div>
          <div className="text-xs space-y-0.5" style={{ color: "var(--psg-muted)" }}>
            <div className="flex justify-between"><span>Staff time ({f.days} day{f.days === 1 ? "" : "s"})</span><span className="text-white tabular-nums">{gbp(f.timeCost)}</span></div>
            <div className="flex justify-between"><span>Costs logged</span><span className="text-white tabular-nums">{gbp(f.costs)}</span></div>
            {job.production && <div className="flex justify-between"><span>PSG expenses on the budget</span><span className="text-white tabular-nums">{gbp(f.psgExpenses)}</span></div>}
            {f.unratedDays > 0 && <div style={{ color: "#fbbf24" }}>⚠ {f.unratedDays} day{f.unratedDays === 1 ? "" : "s"} logged by people with no day rate (costed at £0). Set rates in Admin → Users.</div>}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Time */}
        <section className="rounded-lg border" style={card}>
          <h2 className="px-4 py-3 border-b text-sm font-semibold text-white" style={{ borderColor: "var(--psg-card-border)" }}>Days logged</h2>
          <form onSubmit={logTime} className="p-4 border-b grid gap-2 grid-cols-2 items-end" style={{ borderColor: "var(--psg-card-border)" }}>
            {me.isAdmin && staff.length > 0 && (
              <div className="col-span-2"><label htmlFor="t-user" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Who</label>
                <select id="t-user" className={inp} style={inpStyle} value={time.userId} onChange={e => setTime({ ...time, userId: e.target.value })}>
                  <option value="">Me</option>{staff.filter(s => s.id !== me.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
            )}
            <div><label htmlFor="t-date" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Date</label>
              <input id="t-date" type="date" required className={inp} style={inpStyle} value={time.date} onChange={e => setTime({ ...time, date: e.target.value })} /></div>
            <div><label htmlFor="t-days" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Days</label>
              <select id="t-days" className={inp} style={inpStyle} value={time.days} onChange={e => setTime({ ...time, days: e.target.value })}>{DAY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div className="col-span-2"><label htmlFor="t-note" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Note</label>
              <input id="t-note" className={inp} style={inpStyle} value={time.note} onChange={e => setTime({ ...time, note: e.target.value })} placeholder="e.g. site visit" /></div>
            <button type="submit" disabled={busy} className="col-span-2 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>Log days</button>
          </form>
          {job.time.length === 0 ? <p className="px-4 py-4 text-sm" style={{ color: "var(--psg-muted)" }}>No days logged yet.</p> : (
            <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
              {job.time.map(t => (
                <li key={t.id} className="px-4 py-2.5 flex items-start justify-between gap-3 group text-sm" style={{ borderColor: "var(--psg-card-border)" }}>
                  <div className="min-w-0">
                    <div className="text-white">{t.user.name} · {t.days} day{t.days === 1 ? "" : "s"}</div>
                    <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{fmtDate(t.date)}{t.note ? ` · ${t.note}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {seeMoney && <span className="text-xs tabular-nums" style={{ color: t.dayRate == null ? "#fbbf24" : "var(--psg-muted)" }}>{t.dayRate == null ? "no rate" : gbp(t.days * t.dayRate)}</span>}
                    {(t.userId === me.id || me.isAdmin) && <button type="button" onClick={() => removeTime(t.id)} aria-label="Remove time entry" className="text-xs text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100">Remove</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Costs (money only) */}
        {seeMoney && (
          <section className="rounded-lg border" style={card}>
            <h2 className="px-4 py-3 border-b text-sm font-semibold text-white" style={{ borderColor: "var(--psg-card-border)" }}>Costs</h2>
            <form onSubmit={logCost} className="p-4 border-b grid gap-2 grid-cols-2 items-end" style={{ borderColor: "var(--psg-card-border)" }}>
              <div className="col-span-2"><label htmlFor="c-desc" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>What for *</label>
                <input id="c-desc" required className={inp} style={inpStyle} value={cost.description} onChange={e => setCost({ ...cost, description: e.target.value })} /></div>
              <div><label htmlFor="c-amount" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Amount (£, ex VAT) *</label>
                <input id="c-amount" required type="number" step="any" className={inp} style={inpStyle} value={cost.amount} onChange={e => setCost({ ...cost, amount: e.target.value })} /></div>
              <div><label htmlFor="c-date" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Date</label>
                <input id="c-date" type="date" className={inp} style={inpStyle} value={cost.date} onChange={e => setCost({ ...cost, date: e.target.value })} /></div>
              <div><label htmlFor="c-supplier" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Supplier</label>
                <input id="c-supplier" className={inp} style={inpStyle} value={cost.supplier} onChange={e => setCost({ ...cost, supplier: e.target.value })} /></div>
              <div><label htmlFor="c-cat" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Category</label>
                <select id="c-cat" className={inp} style={inpStyle} value={cost.category} onChange={e => setCost({ ...cost, category: e.target.value })}><option value="">—</option>{COST_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <button type="submit" disabled={busy} className="col-span-2 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>Add cost</button>
            </form>
            {job.costs.length === 0 && job.psgExpenses.length === 0 ? <p className="px-4 py-4 text-sm" style={{ color: "var(--psg-muted)" }}>No costs yet.</p> : (
              <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
                {job.costs.map(c => (
                  <li key={c.id} className="px-4 py-2.5 flex justify-between gap-3 group text-sm" style={{ borderColor: "var(--psg-card-border)" }}>
                    <div className="min-w-0"><div className="text-white">{c.description}</div>
                      <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{[fmtDate(c.date), c.category, c.supplier].filter(Boolean).join(" · ")}</div></div>
                    <div className="flex items-center gap-3 shrink-0"><span className="text-white tabular-nums">{gbp(c.amount)}</span>
                      <button type="button" onClick={() => removeCost(c.id)} aria-label="Remove cost" className="text-xs text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100">Remove</button></div>
                  </li>
                ))}
                {job.psgExpenses.map((e, i) => (
                  <li key={`psg${i}`} className="px-4 py-2.5 flex justify-between gap-3 text-sm" style={{ borderColor: "var(--psg-card-border)" }}>
                    <div className="min-w-0"><div className="text-white">{e.description}</div>
                      <div className="text-xs" style={{ color: "var(--psg-muted)" }}>PSG expense on the show budget{e.supplier ? ` · ${e.supplier}` : ""}</div></div>
                    <span className="text-white tabular-nums shrink-0">{gbp(e.spent || e.committed)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {(job.quotes.length > 0 || job.opportunity) && (
        <div className="text-sm flex gap-4 flex-wrap" style={{ color: "var(--psg-muted)" }}>
          {job.quotes.map(q => <Link key={q.id} href={`/bd/quotes/${q.id}`} className="text-blue-400">Quote {q.number} ({q.status})</Link>)}
          {job.opportunity && <Link href="/bd" className="text-blue-400">Deal: {job.opportunity.title}</Link>}
        </div>
      )}
    </div>
  );
}
