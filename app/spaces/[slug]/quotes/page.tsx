// A company space's quotes (e.g. TWS quoting its builds). Quoting needs Business Dev access, as in
// the rest of the Hub; anyone without it sees why rather than an empty list.
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import type { SpaceTheme } from "@/lib/spaces";
import type { QuoteRow, TemplateRow } from "@/app/bd/quotes/QuotesView";
import SpaceQuotes from "./SpaceQuotes";

export default async function SpaceQuotesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const space = await serverApi<{ space?: SpaceTheme }>(`/api/spaces/${slug}`);
  if (!space?.space) notFound();
  const [quotes, templates, clients] = await Promise.all([
    serverApi<QuoteRow[]>(`/api/quotes?entityId=${space.space.id}`),
    serverApi<TemplateRow[]>("/api/quote-templates"),
    serverApi<{ id: number; name: string }[]>("/api/clients"),
  ]);
  return (
    <SpaceQuotes space={space.space} canQuote={Array.isArray(quotes)} quotes={Array.isArray(quotes) ? quotes : []}
      templates={Array.isArray(templates) ? templates : []} clients={Array.isArray(clients) ? clients.map(c => ({ id: c.id, name: c.name })) : []} />
  );
}
