"use client";

// Availability: for each product, how many are free each day over two weeks (or four). Confirmed
// and out hires hold kit; quotes are pencilled (shown with a mark, holding nothing). Red = short.
import { useEffect, useState } from "react";
import Link from "next/link";
import { groupByCategory } from "@/lib/rentals";
import { card, muted, btnLine, input, label as lbl } from "@/lib/twsUi";
import { RentalsHeader, Chip } from "@/components/rentals/shared";
import { todayIso, addDays, HIRE_TONE, HIRE_LABEL, day, type RentalsData } from "@/components/rentals/format";

type Row = { id: number; name: string; category: string | null; owned: number; held: number; pencilled: number; free: number; byDay: { day: string; held: number; pencilled: number; free: number }[] };
type Av = { from: string; to: string; products: Row[]; hires: { id: number; number: string; title: string; status: string; holds: boolean; outDate: string; returnDate: string; productIds: number[] }[] };

export default function Availability({ initial, from: from0 }: { initial: RentalsData; from: string | null }) {
  const { space } = initial;
  const [from, setFrom] = useState(from0 ?? todayIso());
  const [span, setSpan] = useState(14);
  const [cat, setCat] = useState("all");
  const [busyOnly, setBusyOnly] = useState(false);
  const [av, setAv] = useState<Av | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/spaces/${space.slug}/rentals/availability?from=${from}&to=${addDays(from, span - 1)}`)
      .then(async r => { const j = await r.json(); if (!live) return; if (r.ok) { setAv(j); setErr(null); } else setErr(j.error ?? "Couldn't load availability"); })
      .catch(() => live && setErr("Couldn't load availability"));
    return () => { live = false; };
  }, [from, span, space.slug]);

  const days = Array.from({ length: span }, (_, i) => addDays(from, i));
  const rows = (av?.products ?? []).filter(p => (cat === "all" || (p.category || "Other") === cat) && (!busyOnly || p.held > 0 || p.pencilled > 0));
  const groups = groupByCategory(rows);
  const cats = groupByCategory(av?.products ?? []).map(g => g.category);
  const shortCount = (av?.products ?? []).filter(p => p.free < 0).length;
  const cell = (d: { held: number; pencilled: number; free: number } | undefined, owned: number): React.CSSProperties => {
    if (!d) return {};
    if (d.free < 0) return { background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)", fontWeight: 800 };
    if (d.held && d.free === 0) return { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", fontWeight: 700 };
    if (d.held) return { background: "var(--tws-accent-light)" };
    return owned ? {} : { color: "var(--tws-muted)" };
  };
  const wk = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" });
  const dn = (iso: string) => Number(iso.slice(8, 10));
  const weekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());

  return (
    <>
      <RentalsHeader space={space} title="Availability" line={shortCount ? `${shortCount} product${shortCount === 1 ? " is" : "s are"} short somewhere in these dates` : "How many of each product are free, day by day"}>
        <button type="button" style={btnLine} onClick={() => setFrom(addDays(from, -span))}>← Earlier</button>
        <button type="button" style={btnLine} onClick={() => setFrom(todayIso())}>Today</button>
        <button type="button" style={btnLine} onClick={() => setFrom(addDays(from, span))}>Later →</button>
      </RentalsHeader>
      <div className="px-4 sm:px-10 pt-6 pb-10 flex flex-col gap-6">
        <section style={card} className="flex flex-col gap-4 min-w-0" aria-label="Availability by day">
          <div className="flex flex-wrap gap-4 items-end">
            <div><label style={lbl} htmlFor="av-from">From</label><input id="av-from" type="date" style={{ ...input, width: "auto" }} value={from} onChange={e => e.target.value && setFrom(e.target.value)} /></div>
            <div className="flex gap-1.5">{[14, 28].map(n => <Chip key={n} on={span === n} onClick={() => setSpan(n)}>{n / 7} weeks</Chip>)}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={busyOnly} onChange={e => setBusyOnly(e.target.checked)} /> Only kit that&apos;s booked</label>
          </div>
          {cats.length > 1 && <div className="flex flex-wrap gap-1.5"><Chip on={cat === "all"} onClick={() => setCat("all")}>All</Chip>{cats.map(c => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>}
          <p className="text-xs flex flex-wrap gap-x-4 gap-y-1" style={muted}>
            <span>Numbers are units free that day.</span>
            <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "var(--tws-accent-light)" }} />Some on hire</span>
            <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "var(--tws-warn-bg)" }} />None left</span>
            <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "var(--tws-bad-bg)" }} />Short: more booked than you have</span>
            <span>• = also pencilled on a quote</span>
          </p>
          {err ? <p role="alert" className="text-sm" style={{ color: "var(--tws-bad-ink)" }}>{err}</p> : !av ? <p className="text-sm" style={muted}>Loading…</p>
            : !av.products.length ? <p className="text-sm" style={muted}>No kit yet. <Link href={`/spaces/${space.slug}/kit`} style={{ color: "var(--tws-accent-ink)" }}>Add some on Kit</Link>.</p>
            : !rows.length ? <p className="text-sm" style={muted}>Nothing booked in these dates.</p> : (
            <div className="overflow-x-auto">
              <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
                <thead><tr>
                  <th style={{ textAlign: "left", fontSize: 12, padding: "6px 8px", position: "sticky", left: 0, background: "var(--tws-card)", minWidth: 180 }}>Product</th>
                  <th style={{ fontSize: 12, padding: "6px 6px", color: "var(--tws-muted)" }} title="Units in service">Own</th>
                  {days.map(d => <th key={d} style={{ fontSize: 11, padding: "4px 2px", minWidth: 30, textAlign: "center", color: weekend(d) ? "var(--tws-muted)" : "var(--tws-ink)", borderLeft: d.endsWith("-01") ? "2px solid var(--tws-char)" : undefined }}>{wk(d)}<br />{dn(d)}</th>)}
                </tr></thead>
                {groups.map(g => (
                  <tbody key={g.category}>
                    <tr><td colSpan={days.length + 2} style={{ padding: "6px 8px", background: "var(--tws-tint)", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{g.category}</td></tr>
                    {g.items.map(p => (
                      <tr key={p.id}>
                        <td style={{ padding: "6px 8px", fontSize: 13, fontWeight: 600, position: "sticky", left: 0, background: "var(--tws-card)", borderBottom: "1px solid var(--tws-line)" }}>
                          <Link href={`/spaces/${space.slug}/kit?product=${p.id}`} style={{ color: "var(--tws-ink)" }}>{p.name}</Link></td>
                        <td style={{ textAlign: "center", fontSize: 13, color: "var(--tws-muted)", borderBottom: "1px solid var(--tws-line)" }}>{p.owned}</td>
                        {days.map((d, i) => {
                          const x = p.byDay[i];
                          return <td key={d} title={x ? `${day(d)}: ${x.free} free of ${p.owned}${x.held ? `, ${x.held} on hire` : ""}${x.pencilled ? `, ${x.pencilled} pencilled` : ""}` : undefined}
                            style={{ textAlign: "center", fontSize: 12, padding: "5px 2px", borderBottom: "1px solid var(--tws-line)", borderLeft: d.endsWith("-01") ? "2px solid var(--tws-char)" : "1px solid var(--tws-line-soft, var(--tws-line))", ...cell(x, p.owned) }}>
                            {x ? x.free : p.owned}{x?.pencilled ? "•" : ""}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </section>

        {av && av.hires.length > 0 && (
          <section style={card} className="flex flex-col gap-2" aria-label="Hires in these dates">
            <h2 className="font-extrabold">Hires in these dates</h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {[...av.hires].sort((a, b) => (a.outDate < b.outDate ? -1 : 1)).map(h => (
                <li key={h.id} className="flex gap-2 items-center flex-wrap">
                  <Link href={`/spaces/${space.slug}/hires?hire=${h.id}`} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }}>{h.number} {h.title}</Link>
                  <span style={muted}>{day(h.outDate)} – {day(h.returnDate)}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5" style={HIRE_TONE[h.status]}>{HIRE_LABEL[h.status]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
