"use client";
// The hire rate card on screen (staff in the Rentals space, and client logins), with a PDF download.
import { useMemo, useState } from "react";
import { groupByCategory } from "@/lib/rentals";
import { downloadRateCardPDF, type RateCard } from "@/lib/rateCardPdf";
import { rateLabel } from "@/lib/crewRates";
import { card, muted, btnSolid, input } from "@/lib/twsUi";

const gbp = (n: number | null) => (n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n));

export default function RateCardView({ data, pick }: { data: RateCard; pick?: { qty: Record<number, number>; onChange: (q: Record<number, number>) => void } }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    return groupByCategory(data.products.filter(p => !t || [p.name, p.manufacturer, p.model, p.category].some(x => x?.toLowerCase().includes(t))));
  }, [data.products, q]);
  return (
    <section style={card} className="flex flex-col gap-4 min-w-0" aria-label="Rate card">
      <div className="flex gap-2 flex-wrap items-center">
        <label htmlFor="rc-q" className="sr-only">Search the rate card</label>
        <input id="rc-q" style={{ ...input, flex: 1, minWidth: 180 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search the rate card" />
        <button type="button" style={btnSolid} disabled={busy} onClick={async () => { setBusy(true); await downloadRateCardPDF(data); setBusy(false); }}>Download PDF</button>
      </div>
      <p className="text-xs" style={muted}>Prices per item, ex VAT. A week costs the week rate; extra days cost the day rate, never more than another week.{(data.crew?.length ?? 0) > 0 ? " Crew are priced per person, ex VAT." : ""}</p>
      {data.products.length === 0 ? <p className="text-sm" style={muted}>Nothing on the rate card yet: kit shows here once it has a day or week rate.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead><tr>{["Item", "Make and model", "Day", "Week", ...(pick ? ["How many"] : [])].map((h, i) => <th key={h} style={{ textAlign: i >= 2 ? "right" : "left", fontSize: 12, color: "var(--tws-muted)", padding: "8px 10px", borderBottom: "2px solid var(--tws-line)" }}>{h}</th>)}</tr></thead>
            {groups.map(g => (
              <tbody key={g.category}>
                <tr><td colSpan={pick ? 5 : 4} style={{ padding: "7px 10px", background: "var(--tws-tint)", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>{g.category}</td></tr>
                {g.items.map(p => (
                  <tr key={p.id}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", fontSize: 13, color: "var(--tws-muted)" }}>{[p.manufacturer, p.model].filter(Boolean).join(" ")}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", textAlign: "right" }}>{gbp(p.dayRate)}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", textAlign: "right" }}>{gbp(p.weekRate)}</td>
                    {pick && <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--tws-line)", textAlign: "right" }}>
                      <input aria-label={`How many ${p.name}`} inputMode="numeric" style={{ ...input, width: 70, textAlign: "right" }} value={pick.qty[p.id] ?? ""} placeholder="0"
                        onChange={e => { const n = Math.max(0, Math.min(1000, parseInt(e.target.value) || 0)); const next = { ...pick.qty }; if (n) next[p.id] = n; else delete next[p.id]; pick.onChange(next); }} /></td>}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {(data.crew?.length ?? 0) > 0 && (
        <div className="overflow-x-auto" aria-label="Crew rates">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead><tr>{["Crew", "", "Each person"].map((h, i) => <th key={i} style={{ textAlign: i === 2 ? "right" : "left", fontSize: 12, color: "var(--tws-muted)", padding: "8px 10px", borderBottom: "2px solid var(--tws-line)" }}>{h}</th>)}</tr></thead>
            <tbody>{data.crew!.map(c => (
              <tr key={c.id}>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", fontWeight: 600 }}>{c.role}</td>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", fontSize: 13, color: "var(--tws-muted)" }}>{c.notes}</td>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", textAlign: "right", whiteSpace: "nowrap" }}>{rateLabel(c.chargeRate, c.unit, c.hours)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
