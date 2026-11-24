// Server side of Marketing: this month's posts and the productions list arrive with the page
// (same API and checks as the browser). "This month" is the UK month.
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import MarketingView, { type MarketingPost, type Production } from "./MarketingView";

export default async function MarketingPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const [posts, productions] = await Promise.all([
    serverApi<MarketingPost[]>(`/api/marketing?month=${month}`),
    serverApi<Production[]>("/api/productions"),
  ]);
  return <MarketingView role={role} initial={Array.isArray(posts) && Array.isArray(productions) ? { month, posts, productions } : null} />;
}
