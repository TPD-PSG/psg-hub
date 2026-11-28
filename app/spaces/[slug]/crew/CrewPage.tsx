"use client";

// Crew: the diary of crew jobs on this space's hires (who's booked, places still open), who's free
// on a chosen day (anyone not booked on a hire or production that day), the crew directory, and the
// space's crew rates (each role's usual pay and client charge).
import { useMemo, useState } from "react";
import Link from "next/link";
import type { SpaceTheme } from "@/lib/spaces";
import { card, h2, muted, input, label as lbl } from "@/lib/twsUi";
import { RentalsHeader, Chip } from "@/components/rentals/shared";
import { day, HIRE_TONE, HIRE_LABEL } from "@/components/rentals/format";
import CrewRates, { type CrewRateRow } from "./CrewRates";

type Person = { id: number; name: string; discipline: string; phone: string | null; email: string | null; company: string | null; insuranceExpiry: string | null; busy: string[] };
export type CrewData = {
  space: SpaceTheme; date: string;
  diary: { id: number; role: string; date: string; callTime: string | null; endTime: string | null; places: number; location: string | null; hire: { id: number; number: string; title: string; status: string } | null; booked: { id: number; name: string }[]; available: number }[];
  crew: Person[];
  rates: CrewRateRow[];
};

export default function CrewPage({ initial, tab }: { initial: CrewData; tab?: string }) {
  const [data, setData] = useState(initial);
  const { space } = data;
  const [view, setView] = useState<"diary" | "free" | "all" | "rates">(tab === "rates" ? "rates" : "diary");
  const [q, setQ] = useState("");
  const [disc, setDisc] = useState("all");
  const disciplines = useMemo(() => [...new Set(data.crew.map(c => c.discipline).filter(Boolean))].sort(), [data.crew]);
  const people = data.crew.filter(c => (view !== "free" || c.busy.length === 0) && (disc === "all" || c.discipline === disc) && (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())));
  const pickDate = async (d: string) => { if (!d) return; const r = await fetch(`/api/spaces/${space.slug}/rentals/crew?date=${d}`); if (r.ok) setData(await r.json()); };
  const open = data.diary.reduce((a, j) => a + Math.max(0, j.places - j.booked.length), 0);
  const [nowMs] = useState(() => Date.now()); // read the clock once
  const soon = (iso: string | null) => iso && new Date(iso).getTime() < nowMs + 30 * 86_400_000;

  return (
    <>
      <RentalsHeader space={space} title="Crew" line={`${data.diary.length} crew job${data.diary.length === 1 ? "" : "s"} coming up · ${open} place${open === 1 ? "" : "s"} still to fill`} />
      <div className="px-4 sm:px-10 pt-6 pb-10 flex flex-col gap-6">
        <div className="flex gap-1.5 flex-wrap"><Chip on={view === "diary"} onClick={() => setView("diary")}>Diary</Chip><Chip on={view === "free"} onClick={() => setView("free")}>Who&apos;s free</Chip><Chip on={view === "all"} onClick={() => setView("all")}>Directory</Chip><Chip on={view === "rates"} onClick={() => setView("rates")}>Rates</Chip></div>

        {view === "rates" ? <CrewRates slug={space.slug} initial={data.rates} /> : view === "diary" ? (
          <section style={card} className="flex flex-col gap-2 min-w-0" aria-label="Crew diary">
            <h2 style={h2}>Crew diary</h2>
            <p className="text-xs" style={muted}>Crew jobs on this space&apos;s hires for the next three months. Ask people and book them from the hire.</p>
            {data.diary.length === 0 ? <p className="text-sm" style={muted}>No crew jobs coming up. Add them on a hire, under Crew.</p> : (
              <ul className="flex flex-col">{data.diary.map(j => {
                const left = j.places - j.booked.length;
                return (
                  <li key={j.id} className="py-3 flex flex-col gap-1" style={{ borderBottom: "1px solid var(--tws-line)" }}>
                    <div className="flex justify-between gap-2 flex-wrap items-baseline">
                      <span className="font-semibold">{day(j.date)}{j.callTime ? `, ${j.callTime}${j.endTime ? `–${j.endTime}` : ""}` : ""} · {j.role}</span>
                      <span className="text-xs font-bold px-2 py-0.5" style={left > 0 ? { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)" } : { background: "var(--tws-accent-light)" }}>{left > 0 ? `${left} of ${j.places} to fill${j.available ? ` · ${j.available} available` : ""}` : "All booked"}</span>
                    </div>
                    {j.hire && <span className="text-sm flex gap-2 items-center flex-wrap"><Link href={`/spaces/${space.slug}/hires?hire=${j.hire.id}`} style={{ color: "var(--tws-accent-ink)", fontWeight: 600 }}>{j.hire.number} · {j.hire.title}</Link>
                      <span className="text-[11px] font-bold px-2 py-0.5" style={HIRE_TONE[j.hire.status]}>{HIRE_LABEL[j.hire.status]}</span>{j.location ? <span style={muted}>· {j.location}</span> : null}</span>}
                    <span className="text-sm" style={muted}>{j.booked.length ? `Booked: ${j.booked.map(b => b.name).join(", ")}` : "Nobody booked yet"}</span>
                  </li>
                );
              })}</ul>
            )}
          </section>
        ) : (
          <section style={card} className="flex flex-col gap-3 min-w-0" aria-label={view === "free" ? "Who's free" : "Crew directory"}>
            <div className="flex gap-3 flex-wrap items-end">
              {view === "free" && <div><label style={lbl} htmlFor="cd">Free on</label><input id="cd" type="date" style={{ ...input, width: "auto" }} value={data.date} onChange={e => pickDate(e.target.value)} /></div>}
              <div className="flex-1 min-w-[160px]"><label style={lbl} htmlFor="cq">Name</label><input id="cq" style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Search" /></div>
              {disciplines.length > 1 && <div><label style={lbl} htmlFor="cdisc">Discipline</label><select id="cdisc" style={{ ...input, width: "auto" }} value={disc} onChange={e => setDisc(e.target.value)}><option value="all">All</option>{disciplines.map(d => <option key={d}>{d}</option>)}</select></div>}
            </div>
            {view === "free" && <p className="text-xs" style={muted}>Everyone not already booked on {day(`${data.date}T00:00:00Z`)}, on a hire or a production. It doesn&apos;t know about work they have elsewhere: ask them.</p>}
            {people.length === 0 ? <p className="text-sm" style={muted}>{view === "free" ? "Nobody free matches." : "Nobody matches."}</p> : (
              <div className="overflow-x-auto"><table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead><tr>{["Name", "Discipline", "Phone", "Email", view === "all" ? `Booked ${day(`${data.date}T00:00:00Z`)}` : "Insurance"].map(h => <th key={h} style={{ textAlign: "left", fontSize: 12, color: "var(--tws-muted)", padding: "8px 10px", borderBottom: "2px solid var(--tws-line)" }}>{h}</th>)}</tr></thead>
                <tbody>{people.map(c => (
                  <tr key={c.id}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", fontWeight: 600 }}>{c.name}{c.company ? <span className="block text-xs font-normal" style={muted}>{c.company}</span> : null}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)" }}>{c.discipline}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", userSelect: "all" }}>{c.phone ?? "—"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", fontSize: 13 }}>{c.email ?? "—"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--tws-line)", fontSize: 13 }}>
                      {view === "all" ? (c.busy.length ? c.busy.join("; ") : <span style={muted}>Free</span>)
                        : c.insuranceExpiry ? <span style={soon(c.insuranceExpiry) ? { color: "var(--tws-bad-ink)", fontWeight: 700 } : undefined}>{new Date(c.insuranceExpiry).getTime() < nowMs ? "Expired " : "To "}{day(c.insuranceExpiry)}</span> : <span style={muted}>Not recorded</span>}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
            <p className="text-xs" style={muted}>Add or change crew in the <Link href="/crew" style={{ color: "var(--tws-accent-ink)" }}>crew directory</Link> (shared with the rest of the Hub).</p>
          </section>
        )}
      </div>
    </>
  );
}
