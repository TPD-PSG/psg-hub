// Server side of Business Development: opportunities and clients arrive with the page.
import { serverApi } from "@/lib/serverApi";
import BDView, { type Opportunity, type Client } from "./BDView";

export default async function BDPage() {
  const [opps, clients] = await Promise.all([serverApi<Opportunity[]>("/api/opportunities"), serverApi<Client[]>("/api/clients")]);
  return <BDView initial={Array.isArray(opps) && Array.isArray(clients) ? { opps, clients } : null} />;
}
