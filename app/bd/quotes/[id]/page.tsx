// Server side of the quote editor: the quote and the pickers' lists arrive with the page.
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import QuoteEditor, { type QuoteDetail, type Option } from "./QuoteEditor";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [quote, entities, clients, deals] = await Promise.all([
    serverApi<QuoteDetail>(`/api/quotes/${id}`),
    serverApi<(Option & { archived: boolean })[]>("/api/entities"),
    serverApi<Option[]>("/api/clients"),
    serverApi<(Option & { title: string; stage: string })[]>("/api/opportunities"),
  ]);
  if (!quote || !("id" in quote)) notFound();
  const list = <T,>(v: T[] | null) => (Array.isArray(v) ? v : []);
  return (
    <QuoteEditor
      initial={quote}
      entities={list(entities).filter(e => !e.archived || e.id === quote.entity?.id)}
      clients={list(clients).map(c => ({ id: c.id, name: c.name }))}
      deals={list(deals).filter(d => d.stage !== "lost" || d.id === quote.opportunity?.id).map(d => ({ id: d.id, name: d.title }))}
    />
  );
}
