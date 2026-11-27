// Pipeline view: one kanban column per stage with a card per deal.
import { STAGES, weightedValue, isOpen } from "@/lib/bdPipeline";
import { fmtDate, fmtValue, isOverdue, type Opportunity } from "./bdTypes";

export default function PipelineBoard({ filtered, openOpp, stuck }: {
  filtered: Opportunity[];
  openOpp: (opp: Opportunity) => void;
  stuck: (o: Opportunity) => string | null;
}) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {STAGES.map(stage => {
        const cols = filtered.filter(o => o.stage === stage.key);
        const colWeighted = cols.reduce((sum, o) => sum + weightedValue(o), 0);
        return (
          <div key={stage.key} className="rounded-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", borderTop: `3px solid ${stage.color}` }}>
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</span>
              <span className="text-xs" style={{ color: "var(--psg-muted)" }} title={isOpen(stage.key) ? `${stage.weight}% of each deal's value counts, unless the deal sets its own` : undefined}>
                {cols.length}{isOpen(stage.key) && colWeighted > 0 ? ` · ${fmtValue(colWeighted)}` : ""}
              </span>
            </div>
            <div className="px-3 pb-3 space-y-2">
              {cols.map(opp => (
                <button key={opp.id} onClick={() => openOpp(opp)} className="w-full text-left rounded-lg p-3 border transition-colors hover:border-white/20" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: stuck(opp) ? "rgba(245,158,11,0.6)" : "var(--psg-card-border)" }}>
                  <div className="text-sm font-medium text-white mb-1 leading-tight">{opp.title}</div>
                  {opp.client && <div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>{opp.client.name}</div>}
                  {(opp.entity || opp.owner) && (
                    <div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>{[opp.entity?.name, opp.owner?.name].filter(Boolean).join(" · ")}</div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{opp.type}</span>
                    {opp.value && <span className="text-xs font-medium" style={{ color: stage.color }}>{fmtValue(opp.value)}</span>}
                  </div>
                  {opp.closeDate && (
                    <div className="text-xs mt-1" style={{ color: isOverdue(opp.closeDate) && opp.stage !== "won" && opp.stage !== "lost" ? "#ef4444" : "var(--psg-muted)" }}>
                      {isOverdue(opp.closeDate) && opp.stage !== "won" && opp.stage !== "lost" ? "⚠ " : ""}Close {fmtDate(opp.closeDate)}
                    </div>
                  )}
                  {opp.tenderDeadline && isOpen(opp.stage) && (() => {
                    const days = Math.ceil((new Date(opp.tenderDeadline).getTime() - Date.now()) / 86400e3);
                    return <div className="text-xs mt-1 font-medium" style={{ color: days <= 3 ? "#ef4444" : "#fbbf24" }}>Tender due {fmtDate(opp.tenderDeadline)}{days >= 0 && days <= 7 ? ` (${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`})` : days < 0 ? " (passed)" : ""}</div>;
                  })()}
                  {stuck(opp) && <div className="text-xs mt-1" style={{ color: "#fbbf24" }}>⚠ {stuck(opp)}</div>}
                  {!stuck(opp) && opp.followUpDate && isOpen(opp.stage) && (
                    <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>Follow up {fmtDate(opp.followUpDate)}</div>
                  )}
                  {opp.tasks.filter(t => !t.completedAt).length > 0 && (
                    <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
                      {opp.tasks.filter(t => !t.completedAt).length} task{opp.tasks.filter(t => !t.completedAt).length !== 1 ? "s" : ""} open
                    </div>
                  )}
                </button>
              ))}
              {cols.length === 0 && <div className="text-xs py-4 text-center" style={{ color: "var(--psg-muted)" }}>No opportunities</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
