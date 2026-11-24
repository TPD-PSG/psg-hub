"use client";

// All quotes, with sell total and margin, plus templates. "New quote" can start from a template.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { JOB_TYPES, jobTypeLabel } from "@/lib/quotes";
import { fmtDate } from "@/lib/format";

export type QuoteRow = {
  id: number; number: string; title: string; jobType: string; status: string; createdAt: string;
  client: { id: number; name: string } | null; entity: { id: number; name: string } | null; opportunity: { id: number; title: string } | null;
  totals: { net: number; gross: number; margin: number; marginPct: number | null };
};
export type TemplateRow = { id: number; name: string; jobType: string; lineCount: number; entity: { name: string } | null };

export const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#9aabc8" },
  sent: { label: "Sent", color: "#5b8def" },
  accepted: { label: "Accepted", color: "#1fae7a" },
  declined: { label: "Declined", color: "#f87171" },
};
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

export default function QuotesView({ initial }: { initial: { quotes: QuoteRow[]; templates: TemplateRow[] } | null }) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initial?.quotes ?? []);
  const [templates, setTemplates] = useState(initial?.templates ?? []);
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState<{ title: string; jobType: string; templateId: string; saving: boolean } | null>(null);

  useEffect(() => {
    if (initial) return;
    fetch("/api/quotes").then(r => r.json()).then(d => { if (Array.isArray(d)) setQuotes(d); }).catch(() => {});
    fetch("/api/quote-templates").then(r => r.json()).then(d => { if (Array.isArray(d)) setTemplates(d); }).catch(() => {});
  }, [initial]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setForm({ ...form, saving: true });
    const res = await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.title, jobType: form.jobType, templateId: form.templateId || undefined }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setForm(f => f && { ...f, saving: false }); return alertDialog(body.error ?? "Couldn't create the quote"); }
    router.push(`/bd/quotes/${body.id}`);
  }

  async function removeTemplate(t: TemplateRow) {
    if (!await confirmDialog(`Delete the template "${t.name}"? Quotes made from it keep their lines.`)) return;
    const res = await fetch(`/api/quote-templates/${t.id}`, { method: "DELETE" });
    if (res.ok) setTemplates(ts => ts.filter(x => x.id !== t.id));
  }

  const shown = status === "all" ? quotes : quotes.filter(q => q.status === status);
  const open = quotes.filter(q => q.status === "sent");

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Quotes</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
            {quotes.length} quote{quotes.length === 1 ? "" : "s"} · {open.length} waiting on the client ({gbp(open.reduce((s, q) => s + q.totals.net, 0))})
          </p>
        </div>
        <button type="button" onClick={() => setForm({ title: "", jobType: "pm", templateId: "", saving: false })} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>+ New quote</button>
      </div>

      {form && (
        <form onSubmit={create} className="rounded-lg border p-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div><label htmlFor="nq-title" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Title *</label>
            <input id="nq-title" required autoFocus className={inp} style={inpStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. PM: Jack and the Beanstalk tour" /></div>
          <div><label htmlFor="nq-type" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Type of work</label>
            <select id="nq-type" className={inp} style={inpStyle} value={form.jobType} onChange={e => setForm({ ...form, jobType: e.target.value })}>
              {JOB_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select></div>
          <div><label htmlFor="nq-tpl" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Start from</label>
            <select id="nq-tpl" className={inp} style={inpStyle} value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })}>
              <option value="">Blank quote</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.lineCount} lines)</option>)}
            </select></div>
          <div className="flex gap-2">
            <button type="submit" disabled={form.saving} className="text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>{form.saving ? "Creating…" : "Create"}</button>
            <button type="button" onClick={() => setForm(null)} className="text-sm px-2" style={{ color: "var(--psg-muted)" }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="flex gap-1 flex-wrap">
        {["all", "draft", "sent", "accepted", "declined"].map(s => (
          <button key={s} type="button" onClick={() => setStatus(s)} className="px-3 py-1 rounded text-xs capitalize"
            style={{ backgroundColor: status === s ? "rgba(255,255,255,0.1)" : "transparent", color: s === "all" ? "var(--psg-muted)" : STATUS_STYLE[s].color }}>
            {s === "all" ? "All" : STATUS_STYLE[s].label} ({s === "all" ? quotes.length : quotes.filter(q => q.status === s).length})
          </button>
        ))}
      </div>

      <div className="rounded-lg border overflow-x-auto" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <table className="w-full text-sm" style={{ minWidth: 760 }}>
          <thead>
            <tr className="text-xs" style={{ color: "var(--psg-muted)", borderBottom: "1px solid var(--psg-card-border)" }}>
              <th className="text-left font-medium px-4 py-3">Quote</th><th className="text-left font-medium px-4 py-3">Client · deal</th>
              <th className="text-left font-medium px-4 py-3">Type</th><th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-right font-medium px-4 py-3">Price (ex VAT)</th><th className="text-right font-medium px-4 py-3">Margin</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(q => (
              <tr key={q.id} className="border-t hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)" }}>
                <td className="px-4 py-3"><Link href={`/bd/quotes/${q.id}`} className="text-white hover:underline">{q.title}</Link>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{q.number} · {fmtDate(q.createdAt)}{q.entity ? ` · ${q.entity.name}` : ""}</div></td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{q.client?.name ?? "—"}{q.opportunity && <div>{q.opportunity.title}</div>}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{jobTypeLabel(q.jobType)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: STATUS_STYLE[q.status]?.color }}>{STATUS_STYLE[q.status]?.label ?? q.status}</td>
                <td className="px-4 py-3 text-right text-white tabular-nums">{gbp(q.totals.net)}</td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: q.totals.margin < 0 ? "#f87171" : "var(--psg-muted)" }}>
                  {gbp(q.totals.margin)}{q.totals.marginPct != null && <span className="text-xs"> · {Math.round(q.totals.marginPct)}%</span>}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No quotes yet</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <h2 className="text-sm font-semibold text-white">Templates</h2>
        <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--psg-muted)" }}>Starting points for new quotes. Open any quote and use &ldquo;Save as template&rdquo; to add one (for example a PM, Workshop or Night Run template).</p>
        {templates.length === 0 ? <p className="text-sm" style={{ color: "var(--psg-muted)" }}>No templates yet.</p> : (
          <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
            {templates.map(t => (
              <li key={t.id} className="py-2 flex items-center justify-between gap-3" style={{ borderColor: "var(--psg-card-border)" }}>
                <span className="text-sm text-white">{t.name} <span className="text-xs" style={{ color: "var(--psg-muted)" }}>· {jobTypeLabel(t.jobType)} · {t.lineCount} lines{t.entity ? ` · ${t.entity.name}` : ""}</span></span>
                <button type="button" onClick={() => removeTemplate(t)} className="text-xs text-red-400">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
