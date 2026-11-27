// One help guide
import Link from "next/link";
import { notFound } from "next/navigation";
import { helpGuide, helpGuides, renderHelp } from "@/lib/help";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = helpGuide((await params).slug);
  return { title: a ? `${a.title} · Guides · PSG Hub` : "Guides · PSG Hub", description: a?.summary };
}

export default async function HelpGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = helpGuide((await params).slug);
  if (!a) notFound();
  const related = helpGuides().filter(x => x.section === a.section && x.slug !== a.slug).slice(0, 6);
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_15rem] max-w-5xl">
      <article className="min-w-0">
        <Link href="/help" className="text-sm hover:underline" style={{ color: "var(--psg-muted)" }}>← All guides</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>{a.section}</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{a.title}</h1>
        {a.summary && <p className="mt-2 text-lg" style={{ color: "var(--psg-muted)" }}>{a.summary}</p>}
        <div className="help-article mt-6" dangerouslySetInnerHTML={{ __html: renderHelp(a.body) }} />
        <p className="mt-10 text-sm" style={{ color: "var(--psg-muted)" }}>Still stuck? Ask on the <Link href="/helpdesk" className="underline">Help desk</Link>.</p>
      </article>
      {related.length > 0 && (
        <aside className="space-y-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>More in {a.section}</p>
          <ul className="space-y-1.5">{related.map(r => <li key={r.slug}><Link className="hover:underline text-white" href={`/help/${r.slug}`}>{r.title}</Link></li>)}</ul>
        </aside>
      )}
    </div>
  );
}
