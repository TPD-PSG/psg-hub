// Help guides (28 Nov 2026, as in x-over): every part of the Hub, by section, with search and the
// guides for the page you came from (?from=). Questions the guides don't answer go to the Help desk.
import Link from "next/link";
import { helpGuides, HELP_SECTIONS, searchHelp, guidesForPath } from "@/lib/help";

export const metadata = { title: "Guides · PSG Hub" };

export default async function HelpHome({ searchParams }: { searchParams: Promise<{ q?: string; from?: string }> }) {
  const { q = "", from } = await searchParams;
  const all = helpGuides();
  const results = q ? searchHelp(q) : null;
  const here = !q && from && from.startsWith("/") ? guidesForPath(from).slice(0, 4) : [];
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Guides</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--psg-muted)" }}>
          How every part of the Hub works. Can&apos;t find it? Ask on the <Link href="/helpdesk" className="underline">Help desk</Link>.
        </p>
      </div>
      <form className="flex max-w-xl gap-2" role="search">
        <label htmlFor="help-q" className="sr-only">Search the guides</label>
        <input id="help-q" name="q" defaultValue={q} placeholder="Search, e.g. call sheet, overspend, freelancer" className="flex-1 rounded px-3 py-2 text-sm text-white border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }} />
        <button className="text-white px-4 py-2 rounded text-sm font-medium" style={{ backgroundColor: "var(--psg-blue)" }}>Search</button>
      </form>
      {here.length > 0 && (
        <section className="space-y-3" aria-labelledby="help-here">
          <h2 id="help-here" className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>For the page you were on</h2>
          <ul className="grid gap-3 md:grid-cols-2">{here.map(a => <GuideCard key={a.slug} a={a} />)}</ul>
        </section>
      )}
      {results && (
        <section className="space-y-3">
          <h2 className="font-semibold text-white">{results.length ? `Results for “${q}”` : `Nothing found for “${q}”`}</h2>
          {results.length === 0 && <p className="text-sm" style={{ color: "var(--psg-muted)" }}>Try other words, or ask on the <Link href="/helpdesk" className="underline">Help desk</Link>.</p>}
          <ul className="grid gap-3 md:grid-cols-2">{results.map(a => <GuideCard key={a.slug} a={a} />)}</ul>
        </section>
      )}
      {HELP_SECTIONS.map(s => {
        const list = all.filter(a => a.section === s);
        if (!list.length) return null;
        return (
          <section key={s} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>{s}</h2>
            <ul className="grid gap-3 md:grid-cols-2">{list.map(a => <GuideCard key={a.slug} a={a} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}

function GuideCard({ a }: { a: { slug: string; title: string; summary: string } }) {
  return (
    <li>
      <Link href={`/help/${a.slug}`} className="block h-full rounded-lg border p-4 hover:bg-white/5 transition-colors" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <span className="font-semibold text-white">{a.title}</span>
        <span className="mt-1 block text-sm" style={{ color: "var(--psg-muted)" }}>{a.summary}</span>
      </Link>
    </li>
  );
}
