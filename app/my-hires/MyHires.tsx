"use client";

// A client's hires (client logins, stage 5): their quotes and hires with the kit, dates and totals;
// the quote or confirmation PDF; Accept on a quote they've been sent (PSG then confirms it); the
// rate card; and asking for a quote with kit picked from the rate card.
import { useEffect, useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { downloadHirePDF, type HireForPdf } from "@/lib/hirePdf";
import type { RateCard } from "@/lib/rateCardPdf";
import type { SpaceTheme } from "@/lib/spaces";
import RateCardView from "@/components/rentals/RateCardView";
import { card, h2, muted, btnSolid, btnLine, input, label as lbl, caps } from "@/lib/twsUi";

type Hire = HireForPdf & { id: number; acceptedAt: string | null; acceptedBy: string | null; requestedAt: string | null; priced: boolean; canAccept: boolean; totals: { days: number; net: number; vat: number; gross: number } | null };
export type MyHiresData = { me: { name: string; company: string }; hires: Hire[]; companies: { id: number; name: string }[]; brand: SpaceTheme | null };
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const iso = (d: Date) => d.toISOString().slice(0, 10);

const statusOf = (h: Hire) => h.status === "quote" ? (h.acceptedAt ? "Accepted: we'll confirm" : h.priced ? "Quote" : "Requested: we're pricing it")
  : h.status === "confirmed" ? "Confirmed" : h.status === "out" ? "With you" : "Returned";
const tone = (h: Hire): React.CSSProperties => h.status === "quote" ? (h.acceptedAt ? { background: "var(--tws-accent-light)" } : { border: "1px dashed var(--tws-muted)" })
  : h.status === "returned" ? { background: "var(--tws-tint)", color: "var(--tws-soft-ink, #4e545b)" } : { background: "var(--tws-char)", color: "var(--tws-on-char, #fff)" };

export default function MyHires({ initial, tab: tab0 }: { initial: MyHiresData; tab: "hires" | "rates" | "request" }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState(tab0);
  const [open, setOpen] = useState<number | null>(null);
  const [rates, setRates] = useState<RateCard | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(initial.companies[0]?.id ?? null);
  // Read the clock once (not on every render)
  const [today] = useState(() => iso(new Date()));
  const [req, setReq] = useState(() => ({ title: "", outDate: iso(new Date()), returnDate: iso(new Date(Date.now() + 2 * 86_400_000)), delivery: "", deliveryTo: "", notes: "" }));
  const [qty, setQty] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if ((tab === "rates" || tab === "request") && companyId && rates === null) {
      fetch(`/api/rate-card?companyId=${companyId}`).then(r => (r.ok ? r.json() : null)).then(setRates).catch(() => setRates(null));
    }
  }, [tab, companyId, rates]);
  const go = (t: typeof tab) => { setTab(t); window.history.replaceState(null, "", t === "hires" ? "/my-hires" : `/my-hires?tab=${t}`); };

  async function accept(h: Hire) {
    if (!(await confirmDialog(`Accept ${h.number} (${h.totals ? `${gbp(h.totals.gross)} inc VAT` : "this quote"})? We'll confirm the hire and the kit with you.`, { confirmLabel: "Accept quote" }))) return;
    setBusy(true);
    const r = await fetch(`/api/my-hires/${h.id}/accept`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return alertDialog(j.error ?? "That didn't go through. Try again.");
    setData({ ...data, hires: j.hires });
    await alertDialog("Thank you. We've been told, and we'll confirm the hire with you.");
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/my-hires/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...req, companyId, lines: Object.entries(qty).map(([productId, quantity]) => ({ productId: Number(productId), quantity })) }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return alertDialog(j.error ?? "That didn't send. Try again.");
    setData({ ...data, hires: j.hires }); setQty({}); setReq({ ...req, title: "", notes: "" }); go("hires");
    await alertDialog(`Thank you: your request is ${j.number}. We'll price it and send you a quote.`);
  }

  const live = data.hires.filter(h => h.status !== "returned"), past = data.hires.filter(h => h.status === "returned");
  const tabBtn = (t: typeof tab, label: string) => (
    <button key={t} type="button" aria-pressed={tab === t} onClick={() => go(t)} className="px-3 py-2 text-sm font-bold"
      style={tab === t ? { background: "var(--tws-char)", color: "var(--tws-on-char, #fff)" } : { border: "1px solid var(--tws-line)", color: "var(--tws-ink)" }}>{label}</button>
  );
  const row = (h: Hire) => (
    <li key={h.id} style={{ borderBottom: "1px solid var(--tws-line)" }}>
      <button type="button" onClick={() => setOpen(open === h.id ? null : h.id)} aria-expanded={open === h.id} className="w-full text-left py-3 flex flex-col gap-1">
        <span className="flex justify-between gap-2 items-center"><span className="font-semibold truncate">{h.number} · {h.title}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 shrink-0" style={tone(h)}>{statusOf(h)}</span></span>
        <span className="text-xs" style={muted}>{day(h.outDate)} to {day(h.returnDate)}{h.totals ? ` · ${gbp(h.totals.gross)} inc VAT` : ""}</span>
      </button>
      {open === h.id && (
        <div className="pb-4 flex flex-col gap-3">
          <ul className="text-sm flex flex-col gap-1">
            {h.lines.map((l, i) => <li key={i}>{l.quantity} × {l.product.name}{l.note ? ` (${l.note})` : ""}</li>)}
            {h.charges.map((c, i) => <li key={`c${i}`} style={muted}>{c.description}{c.quantity !== 1 ? ` × ${c.quantity}` : ""}</li>)}
          </ul>
          {h.totals ? <p className="text-sm">{h.totals.days} day{h.totals.days === 1 ? "" : "s"} charged · <strong>{gbp(h.totals.net)}</strong> + VAT {gbp(h.totals.vat)} = <strong>{gbp(h.totals.gross)}</strong>{h.validUntil && h.status === "quote" ? ` · valid until ${day(h.validUntil)}` : ""}</p>
            : <p className="text-sm" style={muted}>We&apos;re pricing this. Your quote will show here once it&apos;s ready.</p>}
          <div className="flex gap-2 flex-wrap">
            {h.canAccept && <button type="button" style={btnSolid} disabled={busy} onClick={() => accept(h)}>Accept quote</button>}
            {h.priced && <button type="button" style={btnLine} onClick={() => downloadHirePDF(h)}>Download {h.status === "quote" ? "quote" : "confirmation"} PDF</button>}
          </div>
        </div>
      )}
    </li>
  );

  return (
    <div className="px-4 sm:px-10 py-8 flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-col gap-1"><span style={caps}>{data.me.company}</span>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Your hires</h1></div>
      <div className="flex gap-2 flex-wrap">{tabBtn("hires", "Hires")}{tabBtn("rates", "Rate card")}{tabBtn("request", "Ask for a quote")}</div>

      {tab === "hires" && (
        <>
          <section style={card} className="flex flex-col gap-1" aria-label="Current hires">
            <h2 style={h2}>Quotes and current hires</h2>
            {live.length === 0 ? <p className="text-sm" style={muted}>Nothing at the moment. <button type="button" className="font-semibold underline" onClick={() => go("request")}>Ask for a quote</button>.</p> : <ul>{live.map(row)}</ul>}
          </section>
          {past.length > 0 && <section style={card} className="flex flex-col gap-1" aria-label="Past hires"><h2 style={h2}>Past hires</h2><ul>{past.map(row)}</ul></section>}
        </>
      )}

      {(tab === "rates" || tab === "request") && data.companies.length > 1 && (
        <div><label style={lbl} htmlFor="co">Company</label><select id="co" style={{ ...input, width: "auto" }} value={companyId ?? ""} onChange={e => { setCompanyId(Number(e.target.value)); setRates(null); setQty({}); }}>
          {data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      )}
      {tab === "rates" && (rates ? <RateCardView data={rates} /> : <p className="text-sm" style={muted}>Loading the rate card…</p>)}

      {tab === "request" && (
        <form onSubmit={send} className="flex flex-col gap-4" aria-label="Ask for a quote">
          <section style={card} className="flex flex-col gap-3">
            <h2 style={h2}>Ask for a quote</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label style={lbl} htmlFor="r-title">Your event or job</label><input id="r-title" style={input} required maxLength={160} value={req.title} onChange={e => setReq({ ...req, title: e.target.value })} placeholder="e.g. Summer gala at the Town Hall" /></div>
              <div><label style={lbl} htmlFor="r-out">Kit needed from</label><input id="r-out" type="date" style={input} required min={today} value={req.outDate} onChange={e => setReq({ ...req, outDate: e.target.value })} /></div>
              <div><label style={lbl} htmlFor="r-back">Back to us on</label><input id="r-back" type="date" style={input} required min={req.outDate} value={req.returnDate} onChange={e => setReq({ ...req, returnDate: e.target.value })} /></div>
              <div><label style={lbl} htmlFor="r-del">Collection or delivery</label><select id="r-del" style={input} value={req.delivery} onChange={e => setReq({ ...req, delivery: e.target.value })}>
                <option value="">Not sure yet</option><option value="collection">We&apos;ll collect</option><option value="delivery">Please deliver</option></select></div>
              {req.delivery === "delivery" && <div><label style={lbl} htmlFor="r-to">Deliver to</label><textarea id="r-to" style={input} rows={2} maxLength={500} value={req.deliveryTo} onChange={e => setReq({ ...req, deliveryTo: e.target.value })} /></div>}
              <div className="sm:col-span-2"><label style={lbl} htmlFor="r-notes">Anything else (what it&apos;s for, kit not on the rate card, crew you need)</label><textarea id="r-notes" style={input} rows={3} maxLength={2000} value={req.notes} onChange={e => setReq({ ...req, notes: e.target.value })} /></div>
            </div>
          </section>
          <p className="text-sm font-semibold">Pick kit from the rate card ({Object.keys(qty).length} item{Object.keys(qty).length === 1 ? "" : "s"} picked)</p>
          {rates ? <RateCardView data={rates} pick={{ qty, onChange: setQty }} /> : <p className="text-sm" style={muted}>Loading the rate card…</p>}
          <div className="flex gap-2 items-center flex-wrap"><button type="submit" style={btnSolid} disabled={busy}>Send request</button>
            <span className="text-xs" style={muted}>We&apos;ll check what&apos;s free on your dates and send you a quote. Nothing is booked yet.</span></div>
        </form>
      )}
    </div>
  );
}
