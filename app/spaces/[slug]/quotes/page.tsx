// A company space's quotes (e.g. TWS quoting its builds). Quoting needs Business Dev access, as in
// the rest of the Hub; anyone without it sees why rather than an empty list.
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import type { SpaceTheme } from "@/lib/spaces";
import type { QuoteRow, TemplateRow } from "@/app/bd/quotes/QuotesView";
import SpaceQuotes from "./SpaceQuotes";
import { workshopDayRate } from "@/lib/buildQuote";
import { auth } from "@/auth";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";

export default async function SpaceQuotesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug); // freelancers work from My work
  const space = await serverApi<{ space?: SpaceTheme; jobs?: { id: number; number: string; title: string }[] }>(`/api/spaces/${slug}`);
  if (!space?.space) notFound();
  const [session, dayRate] = await Promise.all([auth(), workshopDayRate()]);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const [quotes, templates, clients] = await Promise.all([
    serverApi<QuoteRow[]>(`/api/quotes?entityId=${space.space.id}`),
    serverApi<TemplateRow[]>("/api/quote-templates"),
    serverApi<{ id: number; name: string }[]>("/api/clients"),
  ]);
  return (
    <SpaceQuotes space={space.space} canQuote={Array.isArray(quotes)} quotes={Array.isArray(quotes) ? quotes : []}
      dayRate={dayRate} isAdmin={isAdmin} jobs={(space.jobs ?? []).map(j => ({ id: j.id, name: `${j.number} · ${j.title}` }))}
      templates={Array.isArray(templates) ? templates : []} clients={Array.isArray(clients) ? clients.map(c => ({ id: c.id, name: c.name })) : []} />
  );
}
