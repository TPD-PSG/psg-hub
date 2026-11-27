// Side panel for the open deal: stage, details, quotes, activity log, tasks and actions.
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import { STAGES, ACTIVITY_KINDS, weightPct, weightedValue, isOpen } from "@/lib/bdPipeline";
import {
  BLANK_ACTIVITY, BLANK_TASK, inp, inpStyle, fmtDate, fmtValue, isOverdue,
  type Activity, type BDTask, type DealQuote, type Opportunity,
} from "./bdTypes";

export default function OpportunityPanel({
  selectedOpp, setSelectedOpp, setActivities, activities, activityForm, setActivityForm, savingActivity, addActivity,
  dealQuotes, newQuote, moveStage, showTaskForm, setShowTaskForm, taskInput, setTaskInput, addTask, toggleTask, deleteTask,
  openEdit, convertToProduction, convertToJob, deleteOpp, stuck,
}: {
  selectedOpp: Opportunity;
  setSelectedOpp: (opp: Opportunity | null) => void;
  setActivities: (a: Activity[] | null) => void;
  activities: Activity[] | null;
  activityForm: typeof BLANK_ACTIVITY;
  setActivityForm: React.Dispatch<React.SetStateAction<typeof BLANK_ACTIVITY>>;
  savingActivity: boolean;
  addActivity: (e: React.FormEvent) => void;
  dealQuotes: DealQuote[] | null;
  newQuote: (opp: Opportunity) => void;
  moveStage: (opp: Opportunity, stage: string) => void;
  showTaskForm: boolean;
  setShowTaskForm: React.Dispatch<React.SetStateAction<boolean>>;
  taskInput: typeof BLANK_TASK;
  setTaskInput: React.Dispatch<React.SetStateAction<typeof BLANK_TASK>>;
  addTask: (e: React.FormEvent) => void;
  toggleTask: (task: BDTask) => void;
  deleteTask: (id: number) => void;
  openEdit: (opp: Opportunity) => void;
  convertToProduction: (opp: Opportunity) => void;
  convertToJob: (opp: Opportunity) => void;
  deleteOpp: (id: number) => void;
  stuck: (o: Opportunity) => string | null;
}) {
  const router = useRouter();
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l shadow-2xl flex flex-col z-40" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        <h2 className="font-semibold text-white truncate pr-4">{selectedOpp.title}</h2>
        <button onClick={() => { setSelectedOpp(null); setActivities(null); }} className="text-xl leading-none shrink-0 hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Stage selector */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>Stage</div>
          <div className="flex flex-wrap gap-1">
            {STAGES.map(s => (
              <button key={s.key} onClick={() => moveStage(selectedOpp, s.key)} className="px-3 py-1 rounded-full text-xs font-medium transition-colors" style={{ backgroundColor: selectedOpp.stage === s.key ? s.color : s.color + "22", color: selectedOpp.stage === s.key ? "#fff" : s.color }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          {selectedOpp.client && (
            <div>
              <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Client</div>
              <div className="text-sm text-white">{selectedOpp.client.name}</div>
            </div>
          )}
          {selectedOpp.value && (
            <div>
              <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Value</div>
              <div className="text-sm font-medium text-white">{fmtValue(selectedOpp.value)}</div>
            </div>
          )}
          <div>
            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Type</div>
            <div className="text-sm text-white capitalize">{selectedOpp.type}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Entity</div>
            <div className="text-sm text-white">{selectedOpp.entity?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Owner</div>
            <div className="text-sm text-white">{selectedOpp.owner?.name ?? "—"}</div>
          </div>
          {selectedOpp.value && isOpen(selectedOpp.stage) ? (
            <div>
              <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Weighted</div>
              <div className="text-sm text-white">{fmtValue(weightedValue(selectedOpp))} <span className="text-xs" style={{ color: "var(--psg-muted)" }}>at {weightPct(selectedOpp)}%{selectedOpp.probability == null ? " (stage default)" : ""}</span></div>
            </div>
          ) : null}
          {selectedOpp.leadSource && (
            <div>
              <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Lead source</div>
              <div className="text-sm text-white">{selectedOpp.leadSource}</div>
            </div>
          )}
          {selectedOpp.competitor && (
            <div>
              <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Competitor</div>
              <div className="text-sm text-white">{selectedOpp.competitor}</div>
            </div>
          )}
          {selectedOpp.closeDate && (
            <div>
              <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Close date</div>
              <div className="text-sm" style={{ color: isOverdue(selectedOpp.closeDate) && selectedOpp.stage !== "won" && selectedOpp.stage !== "lost" ? "#ef4444" : "white" }}>
                {fmtDate(selectedOpp.closeDate)}
              </div>
            </div>
          )}
        </div>

        {selectedOpp.lostReason && (selectedOpp.stage === "won" || selectedOpp.stage === "lost") && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>{selectedOpp.stage === "won" ? "Why we won" : "Why we lost"}</div>
            <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedOpp.lostReason}</p>
          </div>
        )}

        {selectedOpp.description && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Description</div>
            <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedOpp.description}</p>
          </div>
        )}

        {selectedOpp.notes && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div>
            <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedOpp.notes}</p>
          </div>
        )}

        {/* Quotes for this deal */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Quotes</div>
            <button type="button" onClick={() => newQuote(selectedOpp)} className="text-xs text-blue-400">+ Quote</button>
          </div>
          {dealQuotes === null ? <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Loading…</p>
            : dealQuotes.length === 0 ? <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No quotes yet</p>
            : (
              <ul className="space-y-1">
                {dealQuotes.map(dq => (
                  <li key={dq.id} className="flex justify-between text-sm">
                    <Link href={`/bd/quotes/${dq.id}`} className="text-blue-300 hover:underline">{dq.number}</Link>
                    <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{dq.status} · {fmtValue(dq.totals.net) ?? "£0"}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>

        {/* Activity log, with the next follow-up date */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>Activity</div>
          {isOpen(selectedOpp.stage) && stuck(selectedOpp) && (
            <p className="text-xs mb-2" style={{ color: "#fbbf24" }}>⚠ {stuck(selectedOpp)}. Log what&apos;s happened and set the next follow-up.</p>
          )}
          <form onSubmit={addActivity} className="mb-3 space-y-2 rounded-lg p-3 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex gap-2">
              <select aria-label="Kind" className={inp} style={{ ...inpStyle, width: "auto" }} value={activityForm.kind} onChange={e => setActivityForm(f => ({ ...f, kind: e.target.value }))}>
                {ACTIVITY_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
              <input aria-label="What happened" placeholder="What happened?" className={inp} style={inpStyle} value={activityForm.text} onChange={e => setActivityForm(f => ({ ...f, text: e.target.value }))} />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs shrink-0" style={{ color: "var(--psg-muted)" }} htmlFor="bd-next-follow-up">Next follow-up</label>
              <input id="bd-next-follow-up" type="date" className={inp} style={inpStyle} value={activityForm.followUpDate} onChange={e => setActivityForm(f => ({ ...f, followUpDate: e.target.value }))} />
              <button type="submit" disabled={savingActivity || !activityForm.text.trim()} className="text-white px-3 py-2 rounded text-sm font-medium hover:opacity-90 shrink-0 disabled:opacity-40" style={{ backgroundColor: "var(--psg-blue)" }}>Log</button>
            </div>
          </form>
          <div className="space-y-2">
            {activities === null && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Loading…</p>}
            {activities?.length === 0 && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Nothing logged yet</p>}
            {activities?.map(a => (
              <div key={a.id} className="text-sm">
                <div style={{ color: a.kind === "stage" ? "var(--psg-muted)" : "white" }}>
                  {a.kind !== "stage" && a.kind !== "note" && <span className="text-xs uppercase tracking-wider mr-1.5" style={{ color: "var(--psg-muted)" }}>{a.kind}</span>}
                  {a.text}
                </div>
                <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{a.user?.name ?? "Someone"} · {fmtDateTime(a.at)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Follow-up tasks</div>
            <button onClick={() => setShowTaskForm(t => !t)} className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
          </div>

          {showTaskForm && (
            <form onSubmit={addTask} className="mb-3 space-y-2 rounded-lg p-3 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
              <input required placeholder="Task description" className={inp} style={inpStyle} value={taskInput.description} onChange={e => setTaskInput(t => ({ ...t, description: e.target.value }))} />
              <div className="flex gap-2">
                <input type="date" className={inp} style={inpStyle} value={taskInput.dueDate} onChange={e => setTaskInput(t => ({ ...t, dueDate: e.target.value }))} />
                <button type="submit" className="text-white px-3 py-2 rounded text-sm font-medium hover:opacity-90 shrink-0" style={{ backgroundColor: "var(--psg-blue)" }}>Add</button>
              </div>
            </form>
          )}

          <div className="space-y-1">
            {selectedOpp.tasks.length === 0 && !showTaskForm && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No tasks yet</p>}
            {selectedOpp.tasks.map(task => (
              <div key={task.id} className="flex items-start gap-2 rounded p-2 group" style={{ backgroundColor: task.completedAt ? "transparent" : "rgba(255,255,255,0.03)" }}>
                <button onClick={() => toggleTask(task)} className="mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors" style={{ borderColor: task.completedAt ? "#10b981" : "var(--psg-card-border)", backgroundColor: task.completedAt ? "#10b981" : "transparent" }}>
                  {task.completedAt && <span className="text-white text-xs">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: task.completedAt ? "var(--psg-muted)" : "white", textDecoration: task.completedAt ? "line-through" : "none" }}>{task.description}</div>
                  {task.dueDate && <div className="text-xs mt-0.5" style={{ color: isOverdue(task.dueDate) && !task.completedAt ? "#ef4444" : "var(--psg-muted)" }}>{fmtDate(task.dueDate)}</div>}
                </div>
                <button onClick={() => deleteTask(task.id)} className="text-xs opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300">×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel actions */}
      <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "var(--psg-card-border)" }}>
        <button onClick={() => openEdit(selectedOpp)} className="flex-1 border py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
        {selectedOpp.stage === "won" && !selectedOpp.production && (
          <button onClick={() => convertToProduction(selectedOpp)} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "#10b981" }}>
            → Production
          </button>
        )}
        {selectedOpp.stage === "won" && !selectedOpp.production && !selectedOpp.job && (
          <button onClick={() => convertToJob(selectedOpp)} className="border py-2 px-3 rounded text-sm hover:bg-white/5" style={{ borderColor: "#10b981", color: "#10b981" }}>
            → Job
          </button>
        )}
        {selectedOpp.job && !selectedOpp.production && (
          <button onClick={() => router.push(`/jobs/${selectedOpp.job!.id}`)} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#10b981" }}>
            Open job {selectedOpp.job.number}
          </button>
        )}
        {selectedOpp.production && (
          <button onClick={() => router.push(`/productions/${selectedOpp.production!.id}`)} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity truncate px-2" style={{ backgroundColor: "#10b981" }}>
            Open {selectedOpp.production.name}
          </button>
        )}
        <button onClick={() => deleteOpp(selectedOpp.id)} className="border py-2 px-3 rounded text-sm hover:bg-red-900/20 transition-colors text-red-400" style={{ borderColor: "rgba(239,68,68,0.3)" }}>Delete</button>
      </div>
    </div>
  );
}
