// Home dashboard: one row per company (entity) for the senior team. Parts the viewer can't see
// arrive as null from /api/dashboard/entities and simply aren't shown.
import Link from "next/link";
import type { EntityOverviewRow, Visibility } from "@/lib/entityOverview";
import { fmtDate } from "@/lib/format";

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const short = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>{label}</div>
      {children}
    </div>
  );
}

export default function EntityOverview({ data, isAdmin }: { data: { see: Visibility; rows: EntityOverviewRow[] }; isAdmin: boolean }) {
  const { see, rows } = data;
  if (!rows.length) {
    return isAdmin ? (
      <p className="text-sm rounded-lg border px-4 py-3" style={{ color: "var(--psg-muted)", backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        Add the group&apos;s companies in <Link href="/admin/settings" className="text-blue-400">Hub Settings</Link> to see a row for each one here.
      </p>
    ) : null;
  }
  const cols = [see.productions, see.bd, see.productions, see.productions, see.budget || see.finance].filter(Boolean).length + 1;

  return (
    <div className="rounded-xl border divide-y" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      {rows.map(r => {
        const w = r.waiting;
        const waitingItems = w ? [
          w.variations ? `${w.variations} budget change${w.variations === 1 ? "" : "s"} to approve` : null,
          w.expenses ? `${w.expenses} expense${w.expenses === 1 ? "" : "s"} to approve` : null,
          w.feeStages ? `${w.feeStages} fee stage${w.feeStages === 1 ? "" : "s"} to invoice (${gbp(w.feeAmount)})` : null,
        ].filter(Boolean) as string[] : [];
        return (
          <div key={r.entityId ?? "none"} className="px-4 py-4 grid gap-4 grid-cols-2 lg:[grid-template-columns:var(--cols)]"
            style={{ borderColor: "var(--psg-card-border)", ["--cols" as string]: `minmax(120px,1fr) repeat(${cols - 1}, minmax(0,1.3fr))` }}>
            <div className="col-span-2 lg:col-span-1 min-w-0">
              {r.spaceSlug ? (
                <Link href={`/spaces/${r.spaceSlug}`} className="font-semibold text-white break-words hover:underline">{r.name}</Link>
              ) : (
                <div className="font-semibold text-white break-words">{r.name}</div>
              )}
              {r.spaceSlug && <Link href={`/spaces/${r.spaceSlug}`} className="block text-xs text-blue-300 hover:underline mt-0.5">Space →</Link>}
              {r.entityId === null && isAdmin && <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Set a company on these shows and deals</div>}
            </div>

            {r.live && (
              <Cell label="Live shows">
                <div className="text-lg font-semibold text-white leading-tight">{r.live.count}</div>
                <div className="text-xs space-y-0.5 mt-0.5">
                  {r.live.shows.map(s => <Link key={s.id} href={`/productions/${s.id}`} className="block truncate text-blue-300 hover:underline">{s.name}</Link>)}
                  {r.live.count > r.live.shows.length && <span style={{ color: "var(--psg-muted)" }}>+{r.live.count - r.live.shows.length} more</span>}
                </div>
              </Cell>
            )}

            {r.pipeline && (
              <Cell label="Pipeline">
                <div className="text-lg font-semibold text-white leading-tight">{gbp(r.pipeline.weighted)}</div>
                <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{r.pipeline.open} open deal{r.pipeline.open === 1 ? "" : "s"}, weighted</div>
                {r.pipeline.stuck > 0 && (
                  <Link href="/bd" className="text-xs" style={{ color: "#fbbf24" }}>⚠ {r.pipeline.stuck} need{r.pipeline.stuck === 1 ? "s" : ""} attention</Link>
                )}
              </Cell>
            )}

            {r.people && (
              <Cell label="Out this week">
                <div className="text-lg font-semibold text-white leading-tight">{r.people.crew + r.people.staff}</div>
                <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{r.people.crew} crew · {r.people.staff} staff</div>
              </Cell>
            )}

            {r.dates && (
              <Cell label="Next 14 days">
                {r.dates.length === 0 ? <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Nothing coming up</div> : (
                  <ul className="text-xs space-y-1.5">
                    {r.dates.map((d, i) => (
                      <li key={i} className="min-w-0" title={`${d.label} · ${d.production} · ${fmtDate(d.at)}`}>
                        <div className="truncate"><span className="text-white">{short(d.at)}</span> <span style={{ color: "var(--psg-muted)" }}>{d.label}</span></div>
                        <Link href={`/productions/${d.productionId}`} className="block truncate text-blue-300 hover:underline">{d.production}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Cell>
            )}

            {w && (
              <Cell label="Waiting">
                {waitingItems.length === 0 ? <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Nothing waiting</div> : (
                  <ul className="text-xs space-y-0.5" style={{ color: "#fbbf24" }}>{waitingItems.map(x => <li key={x}>{x}</li>)}</ul>
                )}
              </Cell>
            )}
          </div>
        );
      })}
    </div>
  );
}
