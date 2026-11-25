"use client";

// Quotes in a company space: its quotes with status, price and margin, and "+ New quote", which
// starts a quote for this company (optionally from a template) and opens it here.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import type { QuoteRow, TemplateRow } from "@/app/bd/quotes/QuotesView";
import { fmtDate } from "@/lib/format";
import { card, h2, muted, btnSolid, input, label as lbl, pageHeader } from "@/lib/twsUi";

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  draft: { label: "Draft", style: { background: "var(--tws-tint)", color: "#4e545b" } },
  sent: { label: "Sent", style: { background: "var(--tws-accent-light)", color: "var(--tws-ink)" } },
  accepted: { label: "Accepted", style: { background: "var(--tws-char)", color: "#fff" } },
  declined: { label: "Declined", style: { background: "transparent", color: "var(--tws-bad-ink)", border: "1px solid var(--tws-bad-line)" } },
};
const FILTERS = [["open", "Open"], ["accepted", "Accepted"], ["declined", "Declined"], ["all", "All"]] as const;

export default function SpaceQuotes({ space, canQuote, quotes, templates, clients, dayRate, isAdmin, jobs }: { space: SpaceTheme; canQuote: boolean; quotes: QuoteRow[]; templates: TemplateRow[]; clients: { id: number; name: string }[]; dayRate: number | null; isAdmin: boolean; jobs: { id: number; name: string }[] }) {
  const [rate, setRate] = useState(dayRate);
  const [rateEdit, setRateEdit] = useState<string | null>(null);
  async function saveRate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/spaces/${space.slug}/materials`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workshopDayRate: rateEdit }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't save the rate");
    setRate(d.workshopDayRate ?? null); setRateEdit(null);
  }
  const router = useRouter();
  const base = `/spaces/${space.slug}`;
  const [form, setForm] = useState<null | { title: string; clientId: string; templateId: string; jobId: string }>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("open");
  const shown = quotes.filter(q => filter === "all" ? true : filter === "open" ? q.status === "draft" || q.status === "sent" : q.status === filter);
  const open = quotes.filter(q => q.status === "draft" || q.status === "sent");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const res = await fetch("/api/quotes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, jobType: "workshop", entityId: space.id, clientId: form.clientId || undefined, templateId: form.templateId || undefined, jobId: form.jobId || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return alertDialog(body.error ?? "Couldn't start the quote");
    router.push(`${base}/quotes/${body.id}`);
  }

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-3">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Quotes</div>
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1">
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Quotes</h1>
            {canQuote && <span className="text-sm" style={muted}>{open.length} open · {gbp(open.reduce((s, q) => s + q.totals.net, 0))} quoted, ex VAT · PDFs go out in {space.shortName ?? space.name} branding</span>}
          </div>
          {canQuote && <button type="button" onClick={() => setForm({ title: "", clientId: "", templateId: "", jobId: "" })} style={btnSolid}>+ New quote</button>}
        </div>
      </header>

      <div className="px-4 sm:px-10 pt-6 pb-10 flex flex-col gap-6">
        {!canQuote ? (
          <p style={card} className="text-sm">Quoting needs Business Dev access. Ask an admin to tick <strong>Business Dev</strong> under Module access in Admin → Users (to keep it to {space.name} only, set &ldquo;Companies they can see&rdquo; to {space.name}).</p>
        ) : (
          <>
            {form && (
              <form onSubmit={create} style={{ ...card, borderTop: "6px solid var(--tws-accent)" }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1.3fr_1.3fr_auto] items-end" aria-label="New quote">
                <div><label htmlFor="nq-title" style={lbl}>What&apos;s it for?</label>
                  <input id="nq-title" required style={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Panto palace flats and portal" /></div>
                <div><label htmlFor="nq-client" style={lbl}>Client</label>
                  <select id="nq-client" style={input} value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}><option value="">Pick later</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label htmlFor="nq-job" style={lbl}>For build</label>
                  <select id="nq-job" style={input} value={form.jobId} onChange={e => setForm({ ...form, jobId: e.target.value })}><option value="">Not yet a build</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}</select></div>
                <div><label htmlFor="nq-tpl" style={lbl}>Start from</label>
                  <select id="nq-tpl" style={input} value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })}>
                    <option value="">A blank quote</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.lineCount} lines)</option>)}
                  </select></div>
                <div className="flex gap-3 items-center">
                  <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>{busy ? "Starting…" : "Start quote"}</button>
                  <button type="button" onClick={() => setForm(null)} className="text-sm underline" style={muted}>Cancel</button>
                </div>
              </form>
            )}

            <p className="text-[13px] flex flex-wrap items-center gap-2" style={muted}>
              <span>Quotes drafted from a build (&ldquo;Quote this build&rdquo; on its page) cost labour at each person&apos;s day rate, or the standard workshop rate: <strong style={{ color: "var(--tws-ink)" }}>{rate != null ? `${gbp(rate)} a day` : "not set"}</strong>.</span>
              {isAdmin && rateEdit == null && <button type="button" onClick={() => setRateEdit(rate != null ? String(rate) : "")} className="underline">Change</button>}
              {isAdmin && rateEdit != null && (
                <form onSubmit={saveRate} className="flex items-center gap-2">
                  <label htmlFor="wdr" className="sr-only">Standard workshop day rate (£)</label>
                  <input id="wdr" type="number" min={0} step="1" style={{ ...input, width: 100, padding: "4px 6px" }} value={rateEdit} onChange={e => setRateEdit(e.target.value)} placeholder="£ a day" />
                  <button type="submit" style={{ ...btnSolid, padding: "4px 10px", fontSize: 12 }}>Save</button>
                  <button type="button" onClick={() => setRateEdit(null)} className="underline">Cancel</button>
                </form>
              )}
            </p>
            <section style={card} className="flex flex-col gap-3 min-w-0">
              <div className="flex justify-between items-baseline gap-3 flex-wrap">
                <h2 style={h2}>{space.shortName ?? space.name} quotes</h2>
                <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Show">
                  {FILTERS.map(([k, l]) => (
                    <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className="text-xs font-bold px-2.5 py-1.5"
                      style={filter === k ? { background: "var(--tws-char)", color: "#fff" } : { background: "var(--tws-ground)", color: "var(--tws-ink)", border: "1px solid var(--tws-line)" }}>{l}</button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? <p className="text-sm" style={muted}>{quotes.length ? "None here." : "No quotes yet. Start one with “+ New quote”."}</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 640 }}>
                    <thead><tr className="text-xs text-left" style={{ ...muted, borderBottom: "1px solid var(--tws-line-soft)" }}>
                      <th className="py-2 pr-3 font-semibold">Quote</th><th className="py-2 pr-3 font-semibold">Client</th><th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold text-right">Price (ex VAT)</th><th className="py-2 font-semibold text-right">Margin</th>
                    </tr></thead>
                    <tbody>
                      {shown.map(q => {
                        const st = STATUS[q.status] ?? STATUS.draft;
                        return (
                          <tr key={q.id} style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
                            <td className="py-2.5 pr-3"><Link href={`${base}/quotes/${q.id}`} className="font-bold hover:underline" style={{ color: "var(--tws-ink)" }}>{q.title}</Link>
                              <div className="text-xs" style={muted}>{q.number} · {fmtDate(q.createdAt)}</div></td>
                            <td className="py-2.5 pr-3">{q.client?.name ?? <span style={muted}>—</span>}</td>
                            <td className="py-2.5 pr-3"><span className="text-[11px] font-bold px-2 py-1" style={st.style}>{st.label}</span></td>
                            <td className="py-2.5 pr-3 text-right tabular-nums font-bold">{gbp(q.totals.net)}</td>
                            <td className="py-2.5 text-right tabular-nums" style={{ color: q.totals.margin < 0 ? "var(--tws-bad-ink)" : "var(--tws-ink)" }}>{gbp(q.totals.margin)}{q.totals.marginPct != null && <span className="text-xs" style={muted}> · {Math.round(q.totals.marginPct)}%</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
