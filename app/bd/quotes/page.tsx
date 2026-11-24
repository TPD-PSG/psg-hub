// Server side of the quotes list: quotes, templates and entities arrive with the page.
import { serverApi } from "@/lib/serverApi";
import QuotesView, { type QuoteRow, type TemplateRow } from "./QuotesView";

export default async function QuotesPage() {
  const [quotes, templates] = await Promise.all([serverApi<QuoteRow[]>("/api/quotes"), serverApi<TemplateRow[]>("/api/quote-templates")]);
  return <QuotesView initial={Array.isArray(quotes) && Array.isArray(templates) ? { quotes, templates } : null} />;
}
