"use client";

// Under a meeting: the tasks that came from it, and "Find action items", which asks Claude for
// the actions in the minutes with a suggested owner and due date. A person ticks, edits and then
// saves them as tasks; nothing is created until then.
import { useEffect, useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import { fmtDate } from "@/lib/format";
import type { SuggestedAction } from "@/lib/meetingActions";

type Task = { id: number; title: string; status: string; priority: string; dueDate: string | null; assigneeName: string | null; assigneeUser: { id: number; name: string } | null };
type Row = SuggestedAction & { keep: boolean; owner: string }; // owner: "u:<id>", "n:<name>" or ""

const inp = "w-full rounded px-2 py-1.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
const STATUS: Record<string, string> = { todo: "To do", in_progress: "In progress", awaiting_signoff: "Awaiting sign-off", done: "Done" };

export default function MeetingActions({ meetingId, hasMinutes, canEdit }: { meetingId: number; hasMinutes: boolean; canEdit: boolean }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [people, setPeople] = useState<{ id: number; name: string }[]>([]);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);

  useEffect(() => {
    fetch(`/api/meetings/${meetingId}/actions`).then(r => (r.ok ? r.json() : [])).then(d => setTasks(Array.isArray(d) ? d : [])).catch(() => setTasks([]));
  }, [meetingId]);

  async function suggest() {
    setBusy("reading");
    const res = await fetch(`/api/meetings/${meetingId}/actions/suggest`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return alertDialog(body.error ?? "Couldn't read the minutes");
    setPeople(body.people ?? []);
    const found: SuggestedAction[] = body.actions ?? [];
    if (!found.length) return alertDialog("No action items found in these minutes.");
    setRows(found.map(a => ({ ...a, keep: !a.alreadyTask, owner: a.ownerUserId ? `u:${a.ownerUserId}` : a.ownerName ? `n:${a.ownerName}` : "" })));
  }

  async function save() {
    if (!rows) return;
    const chosen = rows.filter(r => r.keep && r.title.trim());
    if (!chosen.length) return alertDialog("Tick at least one action.");
    setBusy("saving");
    const res = await fetch(`/api/meetings/${meetingId}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actions: chosen.map(r => ({
          title: r.title, detail: r.detail, dueDate: r.dueDate, priority: r.priority,
          assigneeUserId: r.owner.startsWith("u:") ? Number(r.owner.slice(2)) : null,
          assigneeName: r.owner.startsWith("n:") ? r.owner.slice(2) : null,
        })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return alertDialog(body.error ?? "Couldn't save the tasks");
    setTasks(body);
    setRows(null);
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows(rs => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const kept = rows?.filter(r => r.keep).length ?? 0;
  if (!tasks?.length && !hasMinutes) return null;

  return (
    <div style={{ borderTop: "1px solid var(--psg-card-border)", padding: "10px 16px 12px" }} className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium" style={{ color: "var(--psg-text)" }}>✅ Actions{tasks?.length ? ` (${tasks.filter(t => t.status === "done").length}/${tasks.length} done)` : ""}</span>
        {canEdit && hasMinutes && !rows && (
          <button type="button" onClick={suggest} disabled={!!busy} className="text-xs px-2 py-1 rounded border disabled:opacity-50" style={{ borderColor: "rgba(99,102,241,0.5)", color: "rgb(165,180,252)" }}>
            {busy === "reading" ? "Reading the minutes…" : tasks?.length ? "Find more action items" : "Find action items"}
          </button>
        )}
      </div>

      {tasks && tasks.length > 0 && (
        <ul className="text-sm space-y-1">
          {tasks.map(t => (
            <li key={t.id} className="flex items-center justify-between gap-3">
              <span style={{ color: t.status === "done" ? "var(--psg-muted)" : "var(--psg-text)", textDecoration: t.status === "done" ? "line-through" : undefined }}>{t.title}</span>
              <span className="text-xs shrink-0" style={{ color: "var(--psg-muted)" }}>
                {[t.assigneeUser?.name ?? t.assigneeName, t.dueDate ? fmtDate(t.dueDate) : null, STATUS[t.status] ?? t.status].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {rows && (
        <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.02)" }}>
          <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Suggested from the minutes. Check each one, untick any you don&apos;t want, then create the tasks.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 720 }}>
              <thead><tr className="text-xs" style={{ color: "var(--psg-muted)" }}>
                <th className="w-8" /><th className="text-left font-medium py-1">Action</th><th className="text-left font-medium py-1 w-44">Owner</th>
                <th className="text-left font-medium py-1 w-36">Due</th><th className="text-left font-medium py-1 w-24">Priority</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="align-top" style={{ opacity: r.keep ? 1 : 0.5 }}>
                    <td className="py-1"><input type="checkbox" aria-label={`Create task: ${r.title}`} checked={r.keep} onChange={e => setRow(i, { keep: e.target.checked })} className="mt-2" /></td>
                    <td className="py-1 pr-2">
                      <input aria-label="Action" className={inp} style={inpStyle} value={r.title} onChange={e => setRow(i, { title: e.target.value })} />
                      {r.detail && <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>{r.detail}</div>}
                      {r.alreadyTask && <div className="text-xs mt-1" style={{ color: "#fbbf24" }}>Already a task from this meeting</div>}
                    </td>
                    <td className="py-1 pr-2">
                      <select aria-label="Owner" className={inp} style={inpStyle} value={r.owner} onChange={e => setRow(i, { owner: e.target.value })}>
                        <option value="">No owner</option>
                        {r.ownerName && <option value={`n:${r.ownerName}`}>{r.ownerName} (not on the Hub)</option>}
                        {people.map(p => <option key={p.id} value={`u:${p.id}`}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="py-1 pr-2"><input aria-label="Due date" type="date" className={inp} style={inpStyle} value={r.dueDate ?? ""} onChange={e => setRow(i, { dueDate: e.target.value || null })} /></td>
                    <td className="py-1">
                      <select aria-label="Priority" className={inp} style={inpStyle} value={r.priority} onChange={e => setRow(i, { priority: e.target.value as Row["priority"] })}>
                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={!!busy || kept === 0} className="text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>
              {busy === "saving" ? "Creating…" : `Create ${kept} task${kept === 1 ? "" : "s"}`}
            </button>
            <button type="button" onClick={() => setRows(null)} className="text-sm px-2" style={{ color: "var(--psg-muted)" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
