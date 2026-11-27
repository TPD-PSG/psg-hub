// List view: a table of the deals that pass the filters, including the stage filter.
import { STAGES, weightPct, weightedValue, isOpen } from "@/lib/bdPipeline";
import { fmtDate, fmtValue, isOverdue, type Opportunity } from "./bdTypes";

export default function OpportunityList({ visibleOpps, stageMap, openOpp, openEdit, deleteOpp, stuck }: {
  visibleOpps: Opportunity[];
  stageMap: Record<string, (typeof STAGES)[number]>;
  openOpp: (opp: Opportunity) => void;
  openEdit: (opp: Opportunity) => void;
  deleteOpp: (id: number) => void;
  stuck: (o: Opportunity) => string | null;
}) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
            <th className="px-4 py-3 text-left font-medium text-white">Opportunity</th>
            <th className="px-4 py-3 text-left font-medium text-white">Client</th>
            <th className="px-4 py-3 text-left font-medium text-white">Entity · owner</th>
            <th className="px-4 py-3 text-left font-medium text-white">Stage</th>
            <th className="px-4 py-3 text-left font-medium text-white">Value</th>
            <th className="px-4 py-3 text-left font-medium text-white">Follow-up</th>
            <th className="px-4 py-3 text-left font-medium text-white">Close</th>
            <th className="px-4 py-3 text-left font-medium text-white">Tasks</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {visibleOpps.map(opp => {
            const s = stageMap[opp.stage];
            return (
              <tr key={opp.id} onClick={() => openOpp(opp)} className="border-t hover:bg-white/5 transition-colors cursor-pointer group" style={{ borderColor: "var(--psg-card-border)" }}>
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{opp.title}</div>
                  <div className="text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{opp.type}</div>
                </td>
                <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{opp.client?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{opp.entity?.name ?? "—"}<br />{opp.owner?.name ?? "No owner"}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: s?.color + "22", color: s?.color }}>{s?.label}</span>
                </td>
                <td className="px-4 py-3 font-medium text-white">
                  {fmtValue(opp.value) ?? "—"}
                  {opp.value && isOpen(opp.stage) ? <div className="text-xs font-normal" style={{ color: "var(--psg-muted)" }}>{fmtValue(weightedValue(opp))} at {weightPct(opp)}%</div> : null}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: stuck(opp) ? "#fbbf24" : "var(--psg-muted)" }}>
                  {stuck(opp) ?? (isOpen(opp.stage) ? fmtDate(opp.followUpDate) ?? "—" : "—")}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: isOverdue(opp.closeDate) && opp.stage !== "won" && opp.stage !== "lost" ? "#ef4444" : "var(--psg-muted)" }}>
                  {fmtDate(opp.closeDate) ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                  {opp.tasks.filter(t => !t.completedAt).length}/{opp.tasks.length}
                </td>
                <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(opp)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                    <button onClick={() => deleteOpp(opp.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {visibleOpps.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No opportunities yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
