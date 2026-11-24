// Server side of Business Development: deals, clients, entities and the people who can own deals
// arrive with the page.
import { serverApi } from "@/lib/serverApi";
import BDView, { type Opportunity, type Client, type EntityOption, type UserOption } from "./BDView";

export default async function BDPage() {
  const [opps, clients, entities, users] = await Promise.all([
    serverApi<Opportunity[]>("/api/opportunities"),
    serverApi<Client[]>("/api/clients"),
    serverApi<EntityOption[]>("/api/entities"),
    serverApi<UserOption[]>("/api/users"),
  ]);
  const ok = Array.isArray(opps) && Array.isArray(clients);
  return <BDView initial={ok ? { opps, clients, entities: Array.isArray(entities) ? entities : [], users: Array.isArray(users) ? users : [] } : null} />;
}
