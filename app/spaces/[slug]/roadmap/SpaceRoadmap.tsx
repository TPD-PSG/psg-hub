"use client";

// The shared roadmap in the space's own look: the same items PSG sees on the Hub roadmap,
// each tagged with where it was raised. Staff add ideas (tagged to this space) and move them along.
import { useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import { fmtDate } from "@/lib/format";
import { caps, card, h2, muted, btnSolid, btnLine, input, label as lbl, pageHeader } from "@/lib/twsUi";

export type SpaceRoadmapItem = {
  id: number; title: string; body: string | null; category: string; status: string; pinned: boolean; createdAt: string;
  createdByUser: { id: number; name: string } | null;
  entity: { id: number; name: string; shortName: string | null } | null;
};
export type RoadmapData = { space: SpaceTheme; items: SpaceRoadmapItem[]; me: { id: number; staff: boolean; admin: boolean } };

const COLS = [
  { key: "idea", label: "Ideas" }, { key: "planned", label: "Planned" }, { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" }, { key: "wont_do", label: "Won't do" },
];
const CATS: [string, string][] = [["general", "General"], ["feature", "Feature"], ["improvement", "Improvement"], ["bug", "Bug"], ["infrastructure", "Infrastructure"]];
const CAT = Object.fromEntries(CATS);
const BLANK = { title: "", body: "", category: "feature", status: "idea" };
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 7px", letterSpacing: "0.04em" };
const small: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: "3px 8px", border: "1px solid var(--tws-line)", background: "transparent", color: "var(--tws-ink)", cursor: "pointer" };

export default function SpaceRoadmap({ initial }: { initial: RoadmapData }) {
  const { space, me } = initial;
  const [items, setItems] = useState(initial.items);
  const [only, setOnly] = useState<"all" | "ours">("all");
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const api = `/api/spaces/${space.slug}/roadmap`;
  const short = space.shortName || space.name;
  const canChange = (i: SpaceRoadmapItem) => me.staff && (me.admin || i.createdByUser?.id === me.id);

  function put(item: SpaceRoadmapItem) {
    setItems(xs => { const next = xs.some(x => x.id === item.id) ? xs.map(x => (x.id === item.id ? item : x)) : [item, ...xs]; return [...next.filter(x => x.pinned), ...next.filter(x => !x.pinned)]; });
  }
  async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't work"); return null; }
    return d;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const d = editing === "new" ? await send(api, "POST", form) : await send(`${api}/${editing}`, "PUT", form);
    if (d) { put(d); setEditing(null); setForm(BLANK); }
  }
  async function patch(i: SpaceRoadmapItem, body: Record<string, unknown>) {
    const d = await send(`${api}/${i.id}`, "PUT", body);
    if (d) put(d);
  }
  async function remove(i: SpaceRoadmapItem) {
    if (!(await confirmDialog(`Delete "${i.title}" from the roadmap? PSG won't see it either.`))) return;
    if (await send(`${api}/${i.id}`, "DELETE")) setItems(xs => xs.filter(x => x.id !== i.id));
  }

  const shown = only === "ours" ? items.filter(i => i.entity?.id === space.id) : items;
  const ours = items.filter(i => i.entity?.id === space.id).length;

  const formCard = (
    <form onSubmit={save} style={card} className="flex flex-col gap-3">
      <h2 style={h2}>{editing === "new" ? "New idea" : "Edit idea"}</h2>
      <div><label style={lbl}>Title</label><input required style={input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What should we build or fix?" /></div>
      <div><label style={lbl}>Details (optional)</label><textarea rows={3} style={input} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Why it would help the workshop" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label style={lbl}>Type</label><select style={input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label style={lbl}>Stage</label><select style={input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{COLS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button type="submit" style={btnSolid}>{editing === "new" ? "Add to the roadmap" : "Save"}</button>
        <button type="button" style={btnLine} onClick={() => { setEditing(null); setForm(BLANK); }}>Cancel</button>
      </div>
    </form>
  );

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-1.5">
        <div className="text-[13px]" style={muted}><Link href={`/spaces/${space.slug}`} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Roadmap</div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Roadmap</h1>
            <span className="text-sm" style={muted}>What&apos;s coming to the Hub. Shared with PSG: everyone sees the same list.</span>
          </div>
          {me.staff && editing === null && <button style={btnSolid} onClick={() => { setForm(BLANK); setEditing("new"); }}>+ Add an idea</button>}
        </div>
      </header>

      <div className="px-4 sm:px-10 py-6 flex flex-col gap-5">
        {editing !== null && formCard}

        <div className="flex gap-2 flex-wrap items-center" role="group" aria-label="Show">
          {([["all", `Everything (${items.length})`], ["ours", `Raised by ${short} (${ours})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setOnly(k)} aria-pressed={only === k}
              style={{ ...small, padding: "6px 12px", ...(only === k ? { background: "var(--tws-char)", color: "#fff", borderColor: "var(--tws-char)" } : {}) }}>{l}</button>
          ))}
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {COLS.map(col => {
            const list = shown.filter(i => i.status === col.key);
            const quiet = col.key === "done" || col.key === "wont_do";
            return (
              <section key={col.key} className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center justify-between px-3 py-2" style={{ background: col.key === "in_progress" ? "var(--tws-accent)" : quiet ? "var(--tws-tint)" : "var(--tws-char)", color: col.key === "in_progress" || quiet ? "var(--tws-ink)" : "#fff" }}>
                  <span style={{ ...caps, color: "inherit" }}>{col.label}</span>
                  <span className="text-xs font-bold">{list.length}</span>
                </div>
                {list.length === 0 && <div className="text-xs text-center py-6" style={{ ...muted, border: "1px dashed var(--tws-line)" }}>Nothing here</div>}
                {list.map(i => {
                  const isOurs = i.entity?.id === space.id;
                  const from = i.entity ? (i.entity.shortName || i.entity.name) : "PSG";
                  const expanded = !quiet || open === i.id;
                  return (
                    <article key={i.id} style={{ background: "var(--tws-card)", border: `1px solid ${i.pinned ? "var(--tws-accent-ink)" : "var(--tws-line)"}`, borderLeft: `4px solid ${isOurs ? "var(--tws-accent)" : "var(--tws-char)"}` }} className="p-3 flex flex-col gap-2 min-w-0">
                      <button onClick={() => quiet && setOpen(o => (o === i.id ? null : i.id))} className="text-left flex flex-col gap-1.5" style={{ cursor: quiet ? "pointer" : "default", background: "none", border: 0, padding: 0, color: "inherit" }} aria-expanded={quiet ? expanded : undefined}>
                        <div className="flex gap-1.5 flex-wrap">
                          <span style={{ ...chip, background: isOurs ? "var(--tws-accent)" : "var(--tws-char)", color: isOurs ? "var(--tws-ink)" : "#fff" }}>From {from}</span>
                          <span style={{ ...chip, background: "var(--tws-tint)", color: "var(--tws-ink)" }}>{CAT[i.category] ?? i.category}</span>
                          {i.pinned && <span style={{ ...chip, border: "1px solid var(--tws-accent-ink)", color: "var(--tws-accent-ink)" }}>Pinned</span>}
                        </div>
                        <span className="text-sm font-bold break-words" style={{ color: "var(--tws-ink)" }}>{quiet && <span aria-hidden>{expanded ? "▾ " : "▸ "}</span>}{i.title}</span>
                      </button>
                      {expanded && (
                        <>
                          {i.body && <p className="text-[13px] leading-relaxed m-0 break-words whitespace-pre-wrap" style={muted}>{i.body}</p>}
                          <div className="text-[11px]" style={muted}>{i.createdByUser?.name ?? "Someone"} · {fmtDate(i.createdAt)}</div>
                          {canChange(i) && (
                            <div className="flex flex-wrap gap-1">
                              <select aria-label="Move to" style={{ ...small, padding: "3px 4px" }} value="" onChange={e => e.target.value && patch(i, { status: e.target.value })}>
                                <option value="">Move to…</option>
                                {COLS.filter(c => c.key !== i.status).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                              </select>
                              <button style={small} onClick={() => { setForm({ title: i.title, body: i.body ?? "", category: i.category, status: i.status }); setEditing(i.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                              {me.admin && <button style={small} onClick={() => patch(i, { pinned: !i.pinned })}>{i.pinned ? "Unpin" : "Pin"}</button>}
                              <button style={{ ...small, color: "#a12d2d" }} onClick={() => remove(i)}>Delete</button>
                            </div>
                          )}
                        </>
                      )}
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
