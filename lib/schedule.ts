// Shared by the Schedule page's server and browser code.
export type TimedEvent = {
  id: number; title: string; type: string; startAt: string; endAt: string;
  location: string | null;
  production: { id: number; name: string };
};

// Built from the productions list, which already includes each production's events
// (the page used to fetch every production one by one)
export function timedFromProductions(prods: { id: number; name: string; events?: Omit<TimedEvent, "production">[] }[]): TimedEvent[] {
  return prods.flatMap(p => (p.events ?? []).map(ev => ({ ...ev, production: { id: p.id, name: p.name } }) as TimedEvent));
}
