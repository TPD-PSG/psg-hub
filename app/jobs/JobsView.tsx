"use client";

// All jobs: type, company, client, days logged and, for those who may see money, price, actual
// cost and margin. Directors, BD and finance can open a job by hand.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertDialog } from "@/components/Dialogs";
import { JOB_TYPES, jobTypeLabel } from "@/lib/quotes";
import { marginBy, type JobFigures } from "@/lib/jobCosting";

export type JobRow = {
  id: number; number: string; title: string; jobType: string; status: string;
  entity: { id: number; name: string } | null; client: { id: number; name: string } | null; production: { id: number; name: string } | null;
  days: number; figures: JobFigures | null;
};
type Option = { id: number; name: string };

const gbp = (n: number | null) => (n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n));
const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
export const JOB_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#5b8def" }, complete: { label: "Complete", color: "#1fae7a" }, cancelled: { label: "Cancelled", color: "#9aabc8" },
};

export default function JobsView({ initial, entities, clients }: { initial: { seeMoney: boolean; jobs: JobRow[] } | null; entities: Option[]; clients: Option[] }) {
  const router = useRouter();
  const seeMoney = initial?.seeMoney ?? false;
  const jobs = initial?.jobs ?? [];
  const [status, setStatus] = useState("active");
  const [groupBy, setGroupBy] = useState<"entity" | "client" | "type">("entity");
  const [form, setForm] = useState<{ title: string; jobType: string; entityId: string; clientId: string; price: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const res = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(body.error ?? "Couldn't open the job");
    router.push(`/jobs/${body.id}`);
  }

  const shown = status === "all" ? jobs : jobs.filter(j => j.status === status);
  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>Every piece of work we&apos;re doing, with days logged{seeMoney ? ", costs and margin" : ""}. Won deals open their job automatically.</p>
        </div>
        {seeMoney && <button type="button" onClick={() => setForm({ title: "", jobType: "workshop", entityId: "", clientId: "", price: "" })} className="text-white px-4 py-2 rounded text-sm font-medium" style={{ backgroundColor: "var(--psg-blue)" }}>+ Job</button>}
      </div>

      {form && (
        <form onSubmit={create} className="rounded-lg border p-4 grid gap-3 md:grid-cols-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="md:col-span-3"><label htmlFor="nj-title" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Title *</label>
            <input id="nj-title" required autoFocus className={inp} style={inpStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label htmlFor="nj-type" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
            <select id="nj-type" className={inp} style={inpStyle} value={form.jobType} onChange={e => setForm({ ...form, jobType: e.target.value })}>{JOB_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
          <div><label htmlFor="nj-entity" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Company</label>
            <select id="nj-entity" className={inp} style={inpStyle} value={form.entityId} onChange={e => setForm({ ...form, entityId: e.target.value })}><option value="">—</option>{entities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div><label htmlFor="nj-client" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Client</label>
            <select id="nj-client" className={inp} style={inpStyle} value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}><option value="">—</option>{clients.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div><label htmlFor="nj-price" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Agreed price (£, if no quote)</label>
            <input id="nj-price" type="number" min={0} className={inp} style={inpStyle} value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
          <div className="flex gap-2 items-end md:col-span-2">
            <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium" style={{ backgroundColor: "var(--psg-blue)" }}>Open job</button>
            <button type="button" onClick={() => setForm(null)} className="text-sm px-2 py-2" style={{ color: "var(--psg-muted)" }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Margin by company, client or type of work (directors, BD, finance) */}
      {seeMoney && (() => {
        const groups = marginBy(jobs, groupBy, jobTypeLabel);
        if (!groups.length) return null;
        const tot = groups.reduce((t, g) => ({ price: t.price + g.price, actual: t.actual + g.actual }), { price: 0, actual: 0 });
        return (
          <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-white">Margin</h2>
                <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Active and complete jobs with a price. Actual cost so far, so active jobs will fall as more is logged.</p>
              </div>
              <div className="flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: "var(--psg-card-border)" }}>
                {([["entity", "By company"], ["client", "By client"], ["type", "By type"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setGroupBy(k)} className="px-3 py-1.5"
                    style={{ backgroundColor: groupBy === k ? "var(--psg-blue)" : "transparent", color: groupBy === k ? "#fff" : "var(--psg-muted)" }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 560 }}>
                <thead><tr className="text-xs" style={{ color: "var(--psg-muted)" }}>
                  <th className="text-left font-medium py-1.5">{groupBy === "entity" ? "Company" : groupBy === "client" ? "Client" : "Type of work"}</th>
                  <th className="text-right font-medium py-1.5">Jobs</th><th className="text-right font-medium py-1.5">Price</th>
                  <th className="text-right font-medium py-1.5">Actual cost</th><th className="text-right font-medium py-1.5">Margin</th>
                </tr></thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.key} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                      <td className="py-1.5 text-white">{g.label}</td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--psg-muted)" }}>{g.jobs}</td>
                      <td className="py-1.5 text-right tabular-nums text-white">{gbp(g.price)}</td>
                      <td className="py-1.5 text-right tabular-nums text-white">{gbp(g.actual)}</td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: g.margin < 0 ? "#f87171" : "#1fae7a" }}>{gbp(g.margin)}{g.marginPct != null && <span className="text-xs"> · {Math.round(g.marginPct)}%</span>}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="py-1.5 text-white">Total</td><td />
                    <td className="py-1.5 text-right tabular-nums text-white">{gbp(tot.price)}</td>
                    <td className="py-1.5 text-right tabular-nums text-white">{gbp(tot.actual)}</td>
                    <td className="py-1.5 text-right tabular-nums" style={{ color: tot.price - tot.actual < 0 ? "#f87171" : "#1fae7a" }}>{gbp(tot.price - tot.actual)}{tot.price ? <span className="text-xs"> · {Math.round(((tot.price - tot.actual) / tot.price) * 100)}%</span> : null}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div className="flex gap-1 flex-wrap">
        {["active", "complete", "cancelled", "all"].map(s => (
          <button key={s} type="button" onClick={() => setStatus(s)} className="px-3 py-1 rounded text-xs"
            style={{ backgroundColor: status === s ? "rgba(255,255,255,0.1)" : "transparent", color: JOB_STATUS[s]?.color ?? "var(--psg-muted)" }}>
            {JOB_STATUS[s]?.label ?? "All"} ({s === "all" ? jobs.length : jobs.filter(j => j.status === s).length})
          </button>
        ))}
      </div>

      <div className="rounded-lg border overflow-x-auto" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <table className="w-full text-sm" style={{ minWidth: seeMoney ? 860 : 560 }}>
          <thead><tr className="text-xs" style={{ color: "var(--psg-muted)" }}>
            <th className="text-left font-medium px-4 py-3">Job</th><th className="text-left font-medium px-4 py-3">Company · client</th>
            <th className="text-right font-medium px-4 py-3">Days</th>
            {seeMoney && <><th className="text-right font-medium px-4 py-3">Price</th><th className="text-right font-medium px-4 py-3">Actual cost</th><th className="text-right font-medium px-4 py-3">Margin</th></>}
          </tr></thead>
          <tbody>
            {shown.map(j => (
              <tr key={j.id} className="border-t hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)" }}>
                <td className="px-4 py-3"><Link href={`/jobs/${j.id}`} className="text-white hover:underline">{j.title}</Link>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{j.number} · {jobTypeLabel(j.jobType)}{j.status !== "active" ? ` · ${JOB_STATUS[j.status]?.label}` : ""}</div></td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{j.entity?.name ?? "—"}<div>{j.client?.name ?? ""}</div></td>
                <td className="px-4 py-3 text-right tabular-nums text-white">{j.days || "—"}</td>
                {seeMoney && j.figures && <>
                  <td className="px-4 py-3 text-right tabular-nums text-white">{gbp(j.figures.price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white">{gbp(j.figures.actual)}</td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: j.figures.margin != null && j.figures.margin < 0 ? "#f87171" : "#1fae7a" }}>
                    {gbp(j.figures.margin)}{j.figures.marginPct != null && <span className="text-xs"> · {Math.round(j.figures.marginPct)}%</span>}
                  </td>
                </>}
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={seeMoney ? 6 : 3} className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No jobs here yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
