// Director revenue forecast for one calendar year, by entity and month.
//   Confirmed = PM fee stages by due date (a stage with no date falls in its production's start
//               month); a production with a fee but no stages counts the fee in its start month;
//               a won deal not yet made into a production counts its value when it was won.
//   Pipeline  = each open deal's weighted value (see lib/bdPipeline) in its expected close month.
//   Anything with no date at all goes in "no date", which only counts towards the current year.
import { weightedValue, isOpen } from "@/lib/bdPipeline";

type D = Date | string | null | undefined;
export type ForecastInput = {
  entities: { id: number; name: string; archived: boolean; sortOrder: number; targets: { year: number; amount: number }[] }[];
  productions: { id: number; entityId: number | null; startDate: D; pmFee: number | null; feeStages: { amount: number; dueDate: D; paidAt: D }[] }[];
  deals: { id: number; entityId: number | null; stage: string; value: number | null; probability: number | null; closeDate: D; stageChangedAt: D; updatedAt: D; productionId: number | null }[];
};
export type ForecastRow = {
  entityId: number | null; name: string; target: number | null;
  confirmed: number[]; pipeline: number[]; // 12 months
  confirmedNoDate: number; pipelineNoDate: number; paid: number;
  totalConfirmed: number; totalPipeline: number; gap: number | null; // target − (confirmed + pipeline)
};
export type Forecast = { year: number; rows: ForecastRow[]; total: ForecastRow };

const monthIn = (d: D, year: number): number | null => {
  if (!d) return null;
  const x = new Date(d);
  return x.getUTCFullYear() === year ? x.getUTCMonth() : -1; // -1 = another year
};

export function buildForecast(input: ForecastInput, year: number, now = new Date()): Forecast {
  const countNoDate = year === now.getUTCFullYear();
  const rows = new Map<number | null, ForecastRow>();
  const row = (entityId: number | null): ForecastRow => {
    if (!rows.has(entityId)) {
      const en = input.entities.find(e => e.id === entityId);
      rows.set(entityId, {
        entityId, name: en?.name ?? "No entity", target: en?.targets.find(t => t.year === year)?.amount ?? null,
        confirmed: Array(12).fill(0), pipeline: Array(12).fill(0), confirmedNoDate: 0, pipelineNoDate: 0, paid: 0,
        totalConfirmed: 0, totalPipeline: 0, gap: null,
      });
    }
    return rows.get(entityId)!;
  };
  // Every active entity shows, even with nothing in it yet
  for (const e of [...input.entities].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) if (!e.archived) row(e.id);

  const addConfirmed = (entityId: number | null, amount: number, when: D, paid: boolean) => {
    const m = monthIn(when, year);
    if (m === -1) return;
    const r = row(entityId);
    if (m === null) { if (!countNoDate) return; r.confirmedNoDate += amount; } else r.confirmed[m] += amount;
    if (paid) r.paid += amount;
  };

  const productionIds = new Set<number>();
  for (const p of input.productions) {
    productionIds.add(p.id);
    if (p.feeStages.length) for (const s of p.feeStages) addConfirmed(p.entityId, s.amount, s.dueDate ?? p.startDate, !!s.paidAt);
    else if (p.pmFee) addConfirmed(p.entityId, p.pmFee, p.startDate, false);
  }
  for (const d of input.deals) {
    if (d.stage === "won") {
      // Once a won deal has a production, the production's fee is the confirmed figure
      if (d.productionId && productionIds.has(d.productionId)) continue;
      if (d.value) addConfirmed(d.entityId, d.value, d.stageChangedAt ?? d.closeDate ?? d.updatedAt, false);
    } else if (isOpen(d.stage)) {
      const w = weightedValue(d);
      if (!w) continue;
      const m = monthIn(d.closeDate, year);
      if (m === -1) continue;
      const r = row(d.entityId);
      if (m === null) { if (countNoDate) r.pipelineNoDate += w; } else r.pipeline[m] += w;
    }
  }

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const finish = (r: ForecastRow) => {
    r.totalConfirmed = sum(r.confirmed) + r.confirmedNoDate;
    r.totalPipeline = sum(r.pipeline) + r.pipelineNoDate;
    r.gap = r.target == null ? null : r.target - r.totalConfirmed - r.totalPipeline;
    return r;
  };
  // "No entity" last, and only when something is in it
  const list = [...rows.values()].map(finish).filter(r => r.entityId !== null || r.totalConfirmed || r.totalPipeline);
  list.sort((a, b) => (a.entityId === null ? 1 : 0) - (b.entityId === null ? 1 : 0));

  const targets = list.map(r => r.target).filter((t): t is number => t != null);
  const total = finish({
    entityId: null, name: "All entities", target: targets.length ? sum(targets) : null,
    confirmed: Array.from({ length: 12 }, (_, i) => sum(list.map(r => r.confirmed[i]))),
    pipeline: Array.from({ length: 12 }, (_, i) => sum(list.map(r => r.pipeline[i]))),
    confirmedNoDate: sum(list.map(r => r.confirmedNoDate)), pipelineNoDate: sum(list.map(r => r.pipelineNoDate)),
    paid: sum(list.map(r => r.paid)), totalConfirmed: 0, totalPipeline: 0, gap: null,
  });
  return { year, rows: list, total };
}
