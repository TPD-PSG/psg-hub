// BD results (28 Nov 2026): win rate, average won deal and time to close, from deals decided
// (won or lost) in a period, overall and by company, owner and lead source. Self-contained.
//   decided  = when the deal last changed stage (stageChangedAt), else last updated
//   time to close = decided − created, in days; the middle value (median) is shown, so one
//            very slow deal doesn't skew it

export type StatDeal = { stage: string; value: number | null; createdAt: string | Date; stageChangedAt: string | Date | null; updatedAt: string | Date; entity?: { name: string } | null; owner?: { name: string } | null; leadSource?: string | null };
export type Stat = { key: string; won: number; lost: number; winRate: number | null; wonValue: number; avgWon: number | null; medianDays: number | null };

const day = 86400e3;
const decidedAt = (d: StatDeal) => new Date(d.stageChangedAt ?? d.updatedAt).getTime();
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); };

function stat(key: string, ds: StatDeal[]): Stat {
  const won = ds.filter(d => d.stage === "won"), lost = ds.filter(d => d.stage === "lost");
  const wonValue = won.reduce((s, d) => s + (d.value ?? 0), 0);
  const valued = won.filter(d => d.value != null);
  return {
    key, won: won.length, lost: lost.length,
    winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
    wonValue, avgWon: valued.length ? Math.round(wonValue / valued.length) : null,
    medianDays: median(won.map(d => Math.max(0, Math.round((decidedAt(d) - new Date(d.createdAt).getTime()) / day)))),
  };
}

export function bdStats(deals: StatDeal[], months = 12, now = new Date()) {
  const since = new Date(now); since.setMonth(since.getMonth() - months);
  const decided = deals.filter(d => (d.stage === "won" || d.stage === "lost") && decidedAt(d) >= since.getTime());
  const by = (f: (d: StatDeal) => string) => {
    const m = new Map<string, StatDeal[]>();
    for (const d of decided) m.set(f(d), [...(m.get(f(d)) ?? []), d]);
    return [...m].map(([k, ds]) => stat(k, ds)).sort((a, b) => (b.won + b.lost) - (a.won + a.lost));
  };
  return {
    months, overall: stat("All", decided),
    byEntity: by(d => d.entity?.name ?? "No company"),
    byOwner: by(d => d.owner?.name ?? "No owner"),
    bySource: by(d => d.leadSource?.trim() || "Not recorded"),
  };
}
