// One quote inside a company space: the Hub's quote editor on a workshop-dark panel, with its
// links staying in the space. A quote for another company opens in Business Dev instead.
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { serverApi } from "@/lib/serverApi";
import type { SpaceTheme } from "@/lib/spaces";
import QuoteEditor, { type QuoteDetail, type Option } from "@/app/bd/quotes/[id]/QuoteEditor";
import { muted, pageHeader } from "@/lib/twsUi";

// The editor is built for the Hub's dark look; inside the space it sits on a charcoal panel
const PANEL = {
  "--psg-card-bg": "#2f3236", "--psg-dark-bg": "#24272b", "--psg-card-border": "#4a4e55", "--psg-muted": "#c9ccd1",
  "--psg-text": "#f5f2ec", "--psg-blue": "var(--tws-accent-ink)", background: "#1f2226", color: "#f5f2ec",
} as React.CSSProperties;

export default async function SpaceQuotePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug) || !/^\d+$/.test(id)) notFound();
  const [space, quote, entities, clients, deals] = await Promise.all([
    serverApi<{ space?: SpaceTheme }>(`/api/spaces/${slug}`),
    serverApi<QuoteDetail>(`/api/quotes/${id}`),
    serverApi<(Option & { archived: boolean })[]>("/api/entities"),
    serverApi<Option[]>("/api/clients"),
    serverApi<(Option & { title: string; stage: string })[]>("/api/opportunities"),
  ]);
  if (!space?.space || !quote || !("id" in quote)) notFound();
  if (quote.entity?.id !== space.space.id) redirect(`/bd/quotes/${id}`);
  const list = <T,>(v: T[] | null) => (Array.isArray(v) ? v : []);
  const base = `/spaces/${slug}`;
  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-5">
        <div className="text-[13px]" style={muted}>
          <Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.space.name}</Link> › <Link href={`${base}/quotes`} style={{ color: "var(--tws-accent-ink)" }}>Quotes</Link> › {quote.number}
        </div>
        <h1 className="break-words" style={{ margin: "6px 0 0", fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>{quote.title}</h1>
      </header>
      <div className="px-4 sm:px-10 py-6">
        <div className="p-4 sm:p-6" style={PANEL}>
          <QuoteEditor
            initial={quote}
            entities={list(entities).filter(e => !e.archived || e.id === quote.entity?.id)}
            clients={list(clients).map(c => ({ id: c.id, name: c.name }))}
            deals={list(deals).filter(d => d.stage !== "lost" || d.id === quote.opportunity?.id).map(d => ({ id: d.id, name: d.title }))}
            listHref={`${base}/quotes`}
            jobsBase={`${base}/jobs`}
          />
        </div>
      </div>
    </>
  );
}
