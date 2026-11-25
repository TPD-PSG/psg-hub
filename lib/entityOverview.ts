// Home dashboard: one row per entity (company) for the senior team. Each part is filled only when
// the viewer may see that area; the API leaves the rest null.
//   live      productions not archived or closed
//   pipeline  open deals: count, weighted value, stuck (lib/bdPipeline)
//   people    distinct crew and staff booked on the entity's shows this week (Mon–Sun)
//   dates     openings, closings, load-ins and tour stops in the next 14 days
//   waiting   budget variations to approve, expenses to approve, PM fee stages due to invoice
import { weightedValue, stuckReason } from "@/lib/bdPipeline";

type D = Date | string | null;
const t = (d: D) => (d ? new Date(d).getTime() : NaN);
const overlaps = (s: D, e: D, from: number, to: number) => {
  const a = t(s), b = t(e);
  if (isNaN(a) && isNaN(b)) return false;
  return (isNaN(a) ? -Infinity : a) < to && (isNaN(b) ? Infinity : b) >= from;
};

export type OverviewProduction = {
  id: number; name: string; entityId: number | null; status: string; startDate: D; endDate: D; venue: string | null;
  tourStops: { loadInDate: D; startDate: D; venue: { name: string } }[];
  crew: { crewId: number; startDate: D; endDate: D }[];
  staffAssignments: { userId: number; startDate: D; endDate: D }[];
  feeStages?: { label: string; amount: number; dueDate: D; invoicedAt: D }[];
  pendingVariations?: number;
  pendingExpenses?: number;
};
export type OverviewDeal = { entityId: number | null; stage: string; value: number | null; probability: number | null; followUpDate: D; createdAt: D; lastActivityAt: D };
export type KeyDate = { at: string; label: string; productionId: number; production: string };
export type EntityOverviewRow = {
  entityId: number | null; name: string;
  spaceSlug: string | null; // the company's own space in the Hub, if switched on
  live: { count: number; shows: { id: number; name: string }[] } | null;
  pipeline: { open: number; weighted: number; stuck: number } | null;
  people: { crew: number; staff: number } | null;
  dates: KeyDate[] | null;
  waiting: { variations: number; expenses: number; feeStages: number; feeAmount: number } | null;
};
export type Visibility = { productions: boolean; bd: boolean; budget: boolean; finance: boolean };

/** Monday 00:00 UTC of the week containing `now`. */
export function weekStart(now: Date): number {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400e3;
}

export function buildEntityOverview(
  entities: { id: number; name: string; archived: boolean; sortOrder: number; hasSpace?: boolean; slug?: string | null }[],
  productions: OverviewProduction[],
  deals: OverviewDeal[],
  see: Visibility,
  now = new Date(),
): EntityOverviewRow[] {
  const wk = weekStart(now), wkEnd = wk + 7 * 86400e3;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const soon = today + 14 * 86400e3;
  const live = productions.filter(p => p.status !== "closed");

  const ids: (number | null)[] = [...entities].filter(e => !e.archived).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).map(e => e.id);
  const used = new Set<number | null>([...live.map(p => p.entityId), ...(see.bd ? deals.map(d => d.entityId) : [])]);
  for (const id of used) if (id !== null && !ids.includes(id)) ids.push(id); // archived entity still in use
  if (used.has(null)) ids.push(null);

  return ids.map(entityId => {
    const shows = live.filter(p => p.entityId === entityId);
    const row: EntityOverviewRow = {
      entityId, name: entities.find(e => e.id === entityId)?.name ?? "No entity",
      spaceSlug: (() => { const e = entities.find(x => x.id === entityId); return e?.hasSpace && !e.archived && e.slug ? e.slug : null; })(),
      live: null, pipeline: null, people: null, dates: null, waiting: null,
    };
    if (see.productions) {
      row.live = { count: shows.length, shows: shows.slice(0, 4).map(p => ({ id: p.id, name: p.name })) };
      const crew = new Set<number>(), staff = new Set<number>();
      for (const p of shows) {
        for (const c of p.crew) if (overlaps(c.startDate ?? p.startDate, c.endDate ?? p.endDate, wk, wkEnd)) crew.add(c.crewId);
        for (const s of p.staffAssignments) if (overlaps(s.startDate, s.endDate, wk, wkEnd)) staff.add(s.userId);
      }
      row.people = { crew: crew.size, staff: staff.size };
      const dates: KeyDate[] = [];
      const add = (d: D, label: string, p: OverviewProduction) => {
        const x = t(d);
        if (x >= today && x < soon) dates.push({ at: new Date(x).toISOString(), label, productionId: p.id, production: p.name });
      };
      for (const p of shows) {
        add(p.startDate, "Opens", p);
        add(p.endDate, "Closes", p);
        for (const s of p.tourStops) {
          add(s.loadInDate, `Load-in, ${s.venue.name}`, p);
          if (t(s.startDate) !== t(s.loadInDate)) add(s.startDate, `Opens at ${s.venue.name}`, p);
        }
      }
      // A show opening the same day as its first stop: keep only "Opens at <venue>"
      const day = (k: KeyDate) => `${k.productionId}|${k.at.slice(0, 10)}`;
      const venueOpenings = new Set(dates.filter(k => k.label.startsWith("Opens at ")).map(day));
      row.dates = dates.filter(k => !(k.label === "Opens" && venueOpenings.has(day(k))))
        .sort((a, b) => a.at.localeCompare(b.at)).slice(0, 5);
    }
    if (see.bd) {
      const open = deals.filter(d => d.entityId === entityId && d.stage !== "won" && d.stage !== "lost");
      row.pipeline = {
        open: open.length,
        weighted: open.reduce((s, d) => s + weightedValue(d), 0),
        stuck: open.filter(d => stuckReason(d, now)).length,
      };
    }
    if (see.budget || see.finance) {
      const due = see.budget ? shows.flatMap(p => (p.feeStages ?? []).filter(s => !s.invoicedAt && !isNaN(t(s.dueDate)) && t(s.dueDate) < soon)) : [];
      row.waiting = {
        variations: see.budget ? shows.reduce((s, p) => s + (p.pendingVariations ?? 0), 0) : 0,
        expenses: see.finance ? shows.reduce((s, p) => s + (p.pendingExpenses ?? 0), 0) : 0,
        feeStages: due.length,
        feeAmount: due.reduce((s, x) => s + x.amount, 0),
      };
    }
    return row;
  });
}
