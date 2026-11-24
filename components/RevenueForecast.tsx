"use client";

// Director: revenue forecast by entity for a year. Confirmed (PM fee stages, won deals) plus
// weighted pipeline against each entity's target, as a meter per entity and a month-by-month table.
import { useState } from "react";
import type { Forecast, ForecastRow } from "@/lib/forecast";

// Validated against the Hub's dark surface (dataviz validator: lightness, chroma, CVD, contrast)
const CONFIRMED = "#1fae7a";
const PIPELINE = "#5b8def";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const short = (n: number) => (n >= 1e6 ? `£${(n / 1e6).toFixed(1)}m` : n >= 1000 ? `£${Math.round(n / 1000)}k` : n ? `£${Math.round(n)}` : "–");

// Every row shares one scale, so bars compare across entities
function Meter({ r, scale }: { r: ForecastRow; scale: number }) {
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const label = `${r.name}: ${gbp(r.totalConfirmed)} confirmed, ${gbp(r.totalPipeline)} weighted pipeline${r.target != null ? `, target ${gbp(r.target)}` : ", no target set"}`;
  return (
    <div className="relative h-3 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} role="img" aria-label={label}>
      <div className="absolute inset-y-0 left-0 flex gap-[2px]" style={{ width: pct(r.totalConfirmed + r.totalPipeline) }}>
        {r.totalConfirmed > 0 && <div className="h-full rounded-full" style={{ flexGrow: r.totalConfirmed, backgroundColor: CONFIRMED }} title={`Confirmed ${gbp(r.totalConfirmed)}`} />}
        {r.totalPipeline > 0 && <div className="h-full rounded-full" style={{ flexGrow: r.totalPipeline, backgroundColor: PIPELINE }} title={`Weighted pipeline ${gbp(r.totalPipeline)}`} />}
      </div>
      {r.target != null && (
        <div className="absolute -top-1 -bottom-1 w-[2px] rounded" style={{ left: `calc(${pct(r.target)} - 1px)`, backgroundColor: "#ffffff" }} title={`Target ${gbp(r.target)}`} />
      )}
    </div>
  );
}

export default function RevenueForecast({ initial }: { initial: Forecast | null }) {
  const [fc, setFc] = useState<Forecast | null>(initial);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"summary" | "months">("summary");
  const thisYear = new Date().getFullYear();

  async function load(year: number) {
    setLoading(true);
    const d = await fetch(`/api/bd/forecast?year=${year}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (d) setFc(d);
    setLoading(false);
  }

  if (!fc) return null;
  const rows = fc.rows;
  const showNoDate = rows.some(r => r.confirmedNoDate || r.pipelineNoDate);
  const t = fc.total;
  const scale = Math.max(1, ...rows.map(r => Math.max(r.target ?? 0, r.totalConfirmed + r.totalPipeline)));

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-white">Revenue forecast {fc.year}</h2>
          <p className="text-xs mt-0.5 max-w-xl" style={{ color: "var(--psg-muted)" }}>
            Confirmed = PM fee stages by due date, and won deals not yet made into productions. Pipeline = open deals at their weighted value, in the month they&apos;re expected to close.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: "var(--psg-card-border)" }}>
            {(["summary", "months"] as const).map(v => (
              <button key={v} type="button" onClick={() => setView(v)} className="px-3 py-1.5"
                style={{ backgroundColor: view === v ? "var(--psg-blue)" : "transparent", color: view === v ? "#fff" : "var(--psg-muted)" }}>
                {v === "summary" ? "By entity" : "By month"}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Previous year" disabled={loading} onClick={() => load(fc.year - 1)} className="px-2 py-1 rounded text-sm hover:bg-white/5" style={{ color: "var(--psg-muted)" }}>‹</button>
          <span className="text-sm text-white tabular-nums">{fc.year}</span>
          <button type="button" aria-label="Next year" disabled={loading} onClick={() => load(fc.year + 1)} className="px-2 py-1 rounded text-sm hover:bg-white/5" style={{ color: "var(--psg-muted)" }}>›</button>
          {fc.year !== thisYear && <button type="button" onClick={() => load(thisYear)} className="text-xs text-blue-400">This year</button>}
        </div>
      </div>

      {/* Headline */}
      <div className="flex gap-6 flex-wrap text-sm">
        <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Target</div><div className="text-lg font-semibold text-white tabular-nums">{t.target != null ? gbp(t.target) : "Not set"}</div></div>
        <div><div className="text-xs flex items-center gap-1.5" style={{ color: "var(--psg-muted)" }}><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CONFIRMED }} />Confirmed</div><div className="text-lg font-semibold text-white tabular-nums">{gbp(t.totalConfirmed)}</div></div>
        <div><div className="text-xs flex items-center gap-1.5" style={{ color: "var(--psg-muted)" }}><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIPELINE }} />Weighted pipeline</div><div className="text-lg font-semibold text-white tabular-nums">{gbp(t.totalPipeline)}</div></div>
        {t.gap != null && (
          <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>{t.gap > 0 ? "Still to find" : "Ahead of target"}</div>
            <div className="text-lg font-semibold tabular-nums" style={{ color: t.gap > 0 ? "#fbbf24" : "#4ade80" }}>{gbp(Math.abs(t.gap))}</div></div>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>Nothing to forecast yet. Add entities and targets in Hub Settings, then give deals an entity and close date.</p>
      )}

      {view === "summary" && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr className="text-xs" style={{ color: "var(--psg-muted)" }}>
                <th className="text-left font-medium py-2 pr-3">Entity</th>
                <th className="text-left font-medium py-2 pr-3 w-[34%]">
                  <span className="inline-flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: CONFIRMED }} />Confirmed</span>
                    <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: PIPELINE }} />Pipeline</span>
                    <span className="inline-flex items-center gap-1"><span className="inline-block w-[2px] h-3 rounded" style={{ backgroundColor: "#fff" }} />Target</span>
                  </span>
                </th>
                <th className="text-right font-medium py-2 pr-3">Target</th>
                <th className="text-right font-medium py-2 pr-3">Confirmed</th>
                <th className="text-right font-medium py-2 pr-3">Pipeline</th>
                <th className="text-right font-medium py-2">Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.entityId ?? "none"} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                  <td className="py-2.5 pr-3 text-white">{r.name}</td>
                  <td className="py-2.5 pr-3"><Meter r={r} scale={scale} /></td>
                  <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--psg-muted)" }}>{r.target != null ? gbp(r.target) : "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-white">
                    {gbp(r.totalConfirmed)}
                    {r.paid > 0 && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{gbp(r.paid)} paid</div>}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-white">{gbp(r.totalPipeline)}</td>
                  <td className="py-2.5 text-right tabular-nums" style={{ color: r.gap == null ? "var(--psg-muted)" : r.gap > 0 ? "#fbbf24" : "#4ade80" }}>
                    {r.gap == null ? "—" : r.gap > 0 ? gbp(r.gap) : `+${gbp(-r.gap)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "months" && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums" style={{ minWidth: 900 }}>
            <thead>
              <tr style={{ color: "var(--psg-muted)" }}>
                <th className="text-left font-medium py-2 pr-2">Entity</th>
                {MONTHS.map(m => <th key={m} className="text-right font-medium py-2 px-1">{m}</th>)}
                {showNoDate && <th className="text-right font-medium py-2 px-1">No date</th>}
                <th className="text-right font-medium py-2 pl-2">Year</th>
              </tr>
            </thead>
            <tbody>
              {[...rows, t].map(r => {
                const isTotal = r === t;
                const cell = (c: number, p: number, key: string) => (
                  <td key={key} className="text-right py-2 px-1 align-top" title={`Confirmed ${gbp(c)} · pipeline ${gbp(p)}`}>
                    <div className="text-white">{short(c)}</div>
                    {p > 0 && <div style={{ color: "var(--psg-muted)" }}>+{short(p)}</div>}
                  </td>
                );
                return (
                  <tr key={isTotal ? "total" : r.entityId ?? "none"} className="border-t" style={{ borderColor: "var(--psg-card-border)", fontWeight: isTotal ? 600 : undefined }}>
                    <td className="py-2 pr-2 text-white align-top">{isTotal ? "Total" : r.name}</td>
                    {MONTHS.map((_, i) => cell(r.confirmed[i], r.pipeline[i], String(i)))}
                    {showNoDate && cell(r.confirmedNoDate, r.pipelineNoDate, "nodate")}
                    {cell(r.totalConfirmed, r.totalPipeline, "year")}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs mt-2" style={{ color: "var(--psg-muted)" }}>Top figure confirmed; &ldquo;+&rdquo; weighted pipeline. &ldquo;No date&rdquo; counts towards the current year only.</p>
        </div>
      )}
    </div>
  );
}
