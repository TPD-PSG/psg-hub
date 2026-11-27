// Home of a rentals space (PSG Rentals & Crew): what goes out and comes back this week, what's
// out now, open quotes, and kit in repair.
import Link from "next/link";
import { card, h2, muted, btnSolid, btnLine, caps } from "@/lib/twsUi";
import { day, HIRE_TONE, HIRE_LABEL, type RentalsData, type HireRow } from "@/components/rentals/format";

const DAY = 86_400_000;

export default function RentalsHome({ data, firstName }: { data: RentalsData; firstName: string }) {
  const { space, hires, products } = data;
  const base = `/spaces/${space.slug}`;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const t = (iso: string) => new Date(iso).getTime();
  const goingOut = hires.filter(h => h.status === "confirmed" && t(h.outDate) <= today + 7 * DAY).sort((a, b) => t(a.outDate) - t(b.outDate));
  const out = hires.filter(h => h.status === "out").sort((a, b) => t(a.returnDate) - t(b.returnDate));
  const dueBack = out.filter(h => t(h.returnDate) <= today + 7 * DAY);
  const quotes = hires.filter(h => h.status === "quote").sort((a, b) => t(a.outDate) - t(b.outDate));
  const repair = products.filter(p => p.units.repair > 0);
  const units = products.reduce((a, p) => a + p.units.total, 0);

  const tile = (label: string, value: number | string, line: string, href: string) => (
    <Link href={href} style={{ ...card, padding: 18, textDecoration: "none", color: "var(--tws-ink)" }} className="flex flex-col gap-1">
      <span style={caps}>{label}</span><span style={{ fontSize: 32, fontWeight: 800, lineHeight: "38px" }}>{value}</span><span className="text-sm" style={muted}>{line}</span>
    </Link>
  );
  const list = (rows: HireRow[], when: (h: HireRow) => string, empty: string) => rows.length === 0 ? <p className="text-sm" style={muted}>{empty}</p> : (
    <ul className="flex flex-col">{rows.slice(0, 8).map(h => (
      <li key={h.id} style={{ borderBottom: "1px solid var(--tws-line)" }}>
        <Link href={`${base}/hires?hire=${h.id}`} className="py-2.5 flex justify-between gap-3 items-center" style={{ color: "var(--tws-ink)" }}>
          <span className="min-w-0"><span className="font-semibold block truncate">{h.number} · {h.title}</span><span className="text-xs" style={muted}>{when(h)}{h.clientName ? ` · ${h.clientName}` : ""}</span></span>
          <span className="text-[11px] font-bold px-2 py-0.5 shrink-0" style={HIRE_TONE[h.status]}>{HIRE_LABEL[h.status]}</span>
        </Link>
      </li>))}</ul>
  );

  return (
    <>
      <header style={{ background: "var(--tws-card)", borderBottom: "6px solid var(--tws-char)" }} className="px-4 sm:px-10 pt-6 pb-6 flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-1"><span style={caps}>{space.name}</span>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Hello, {firstName}</h1>
          <span className="text-sm" style={muted}>{products.length} products · {units} units in the kit</span></div>
        <div className="flex gap-3 flex-wrap">
          <Link href={`${base}/hires?new=1`} style={btnSolid}>+ New hire</Link>
          <Link href={`${base}/availability`} style={btnLine}>Availability</Link>
        </div>
      </header>
      <div className="px-4 sm:px-10 pt-6 pb-10 flex flex-col gap-6">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {tile("Going out", goingOut.length, "confirmed, in the next 7 days", `${base}/hires`)}
          {tile("Out now", out.length, `${dueBack.length} due back this week`, `${base}/hires`)}
          {tile("Quotes", quotes.length, "pencilled, holding nothing", `${base}/hires`)}
          {tile("In repair", repair.reduce((a, p) => a + p.units.repair, 0), repair.length ? repair.slice(0, 2).map(p => p.name).join(", ") : "nothing in repair", `${base}/kit`)}
        </div>
        {products.length === 0 && (
          <section style={{ ...card, borderTop: "6px solid var(--tws-accent)" }} className="flex flex-col gap-2">
            <h2 style={h2}>Start with the kit</h2>
            <p className="text-sm" style={muted}>Add each product and how many you have. Every unit gets its own barcode (or keep the ones already on the stickers). Then group things into packages and start taking hires.</p>
            <Link href={`${base}/kit`} style={{ ...btnSolid, alignSelf: "flex-start" }}>Add kit</Link>
          </section>
        )}
        <div className="grid gap-6 lg:grid-cols-3 items-start">
          <section style={card} className="flex flex-col gap-2 min-w-0" aria-label="Going out"><h2 style={h2}>Going out</h2>
            {list(goingOut, h => `Out ${day(h.outDate)}`, "Nothing confirmed to go out this week.")}</section>
          <section style={card} className="flex flex-col gap-2 min-w-0" aria-label="Out now"><h2 style={h2}>Out now</h2>
            {list(out, h => `Back ${day(h.returnDate)}`, "Nothing out.")}</section>
          <section style={card} className="flex flex-col gap-2 min-w-0" aria-label="Quotes"><h2 style={h2}>Quotes</h2>
            {list(quotes, h => `${day(h.outDate)} – ${day(h.returnDate)}`, "No open quotes.")}</section>
        </div>
      </div>
    </>
  );
}
