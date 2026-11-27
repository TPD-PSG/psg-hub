// Results view: win rate, average won deal and time to close for the filtered deals.
import { bdStats, type Stat } from "@/lib/bdStats";
import { inpStyle, fmtValue, type Opportunity } from "./bdTypes";

export default function ResultsView({ filtered, resultsMonths, setResultsMonths }: {
  filtered: Opportunity[];
  resultsMonths: number;
  setResultsMonths: (m: number) => void;
}) {
  const r = bdStats(filtered, resultsMonths);
  const pct = (n: number | null) => (n == null ? "—" : `${n}%`);
  const table = (title: string, rows: Stat[]) => rows.length > 0 && (
    <div className="rounded-lg border overflow-x-auto" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <table className="w-full text-sm" style={{ minWidth: 520 }}>
        <thead><tr className="text-xs text-left" style={{ color: "var(--psg-muted)" }}><th className="px-3 py-2 font-medium">{title}</th><th className="px-3 py-2 font-medium text-right">Won</th><th className="px-3 py-2 font-medium text-right">Lost</th><th className="px-3 py-2 font-medium text-right">Win rate</th><th className="px-3 py-2 font-medium text-right">Average won</th><th className="px-3 py-2 font-medium text-right">Days to close</th></tr></thead>
        <tbody>{rows.map(x => (
          <tr key={x.key} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
            <td className="px-3 py-2 text-white">{x.key}</td><td className="px-3 py-2 text-right tabular-nums">{x.won}</td><td className="px-3 py-2 text-right tabular-nums">{x.lost}</td>
            <td className="px-3 py-2 text-right tabular-nums text-white">{pct(x.winRate)}</td><td className="px-3 py-2 text-right tabular-nums">{fmtValue(x.avgWon) ?? "—"}</td><td className="px-3 py-2 text-right tabular-nums">{x.medianDays ?? "—"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span style={{ color: "var(--psg-muted)" }}>Deals won or lost in the last</span>
        <select aria-label="Period" className="rounded px-2 py-1 text-sm border" style={inpStyle} value={resultsMonths} onChange={e => setResultsMonths(Number(e.target.value))}>
          {[3, 6, 12, 24].map(m => <option key={m} value={m}>{m} months</option>)}
        </select>
        <span className="text-xs" style={{ color: "var(--psg-muted)" }}>Uses the company and owner filters above. Days to close is the middle value, from creating the deal to winning it.</span>
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {([["Win rate", pct(r.overall.winRate), `${r.overall.won} won · ${r.overall.lost} lost`], ["Won", fmtValue(r.overall.wonValue) ?? "£0", "total value"], ["Average won deal", fmtValue(r.overall.avgWon) ?? "—", "where a value was set"], ["Days to close", r.overall.medianDays != null ? String(r.overall.medianDays) : "—", "typical, lead to won"]] as const).map(([l, v, sub]) => (
          <div key={l} className="rounded-lg border p-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>{l}</div>
            <div className="text-2xl font-semibold text-white tabular-nums">{v}</div>
            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{sub}</div>
          </div>
        ))}
      </div>
      {r.overall.won + r.overall.lost === 0 ? <p className="text-sm" style={{ color: "var(--psg-muted)" }}>No deals won or lost in this period yet.</p> : <>
        {table("Company", r.byEntity)}
        {table("Owner", r.byOwner)}
        {table("Lead source", r.bySource)}
      </>}
    </div>
  );
}
