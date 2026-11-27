"use client";

// A build's checklist (snags & tasks, or ready-to-collect checks): tick off, add, remove. Who
// ticked each one and when shows on hover. `dark` suits the night-dark Collection card.
import { useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import { fmtDate } from "@/lib/format";
import { input } from "@/lib/twsUi";

export type Check = { id: number; kind: string; text: string; done: boolean; doneAt: string | null; doneBy: { name: string } | null; createdBy?: { name: string } | null };

export default function BuildChecklist({ jobId, kind, checks, onChange, dark = false, placeholder }: {
  jobId: number; kind: "snag" | "collect"; checks: Check[]; onChange: (all: Check[]) => void; dark?: boolean; placeholder: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = checks.filter(c => c.kind === kind);
  const ink = dark ? "#fff" : "var(--tws-ink)", soft = dark ? "var(--tws-night-muted)" : "var(--tws-muted)";

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't work"); return null; }
    return d;
  }
  const reload = async () => { const d = await fetch(`/api/jobs/${jobId}/checks`).then(r => (r.ok ? r.json() : null)).catch(() => null); if (Array.isArray(d)) onChange(d); };
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const d = await call(`/api/jobs/${jobId}/checks`, "POST", { text, kind });
    if (Array.isArray(d)) { onChange(d); setText(""); }
  }
  async function toggle(c: Check) {
    onChange(checks.map(x => (x.id === c.id ? { ...x, done: !c.done } : x)));
    await call(`/api/jobs/${jobId}/checks/${c.id}`, "PATCH", { done: !c.done });
    reload(); // fresh "done by" (or undo the tick if it failed)
  }
  async function remove(c: Check) {
    if (await call(`/api/jobs/${jobId}/checks/${c.id}`, "DELETE")) onChange(checks.filter(x => x.id !== c.id));
  }
  async function standard() {
    const d = await call(`/api/jobs/${jobId}/checks`, "POST", { standard: "collect" });
    if (Array.isArray(d)) onChange(d);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {mine.map(c => (
        <div key={c.id} className="flex items-start gap-2.5 text-sm group">
          <input type="checkbox" id={`chk-${c.id}`} checked={c.done} disabled={busy} onChange={() => toggle(c)} className="w-4 h-4 mt-0.5 shrink-0" />
          <label htmlFor={`chk-${c.id}`} className="flex-1 min-w-0 cursor-pointer" style={{ color: c.done ? soft : ink, textDecoration: c.done ? "line-through" : undefined }}
            title={c.done && c.doneBy ? `Done by ${c.doneBy.name}${c.doneAt ? `, ${fmtDate(c.doneAt)}` : ""}` : undefined}>{c.text}{c.kind === "snag" && c.createdBy && <span className="ml-1.5 text-xs" style={{ color: soft, textDecoration: "none" }}>({c.createdBy.name})</span>}</label>
          <button type="button" onClick={() => remove(c)} aria-label={`Remove "${c.text}"`} className="text-xs opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ color: dark ? "#f4a99b" : "var(--tws-bad-ink)" }}>✕</button>
        </div>
      ))}
      {kind === "collect" && mine.length === 0 && (
        <button type="button" onClick={standard} disabled={busy} className="text-left text-[13px] font-semibold underline" style={{ color: dark ? "var(--tws-accent-light)" : "var(--tws-accent-ink)" }}>+ Add the standard ready-to-collect checks</button>
      )}
      <form onSubmit={add} className="flex gap-2 mt-1">
        <label htmlFor={`add-${kind}`} className="sr-only">{placeholder}</label>
        <input id={`add-${kind}`} style={{ ...input, padding: "6px 8px", fontSize: 13 }} value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} />
        <button type="submit" disabled={busy || !text.trim()} className="text-[13px] font-bold px-3 shrink-0 disabled:opacity-40" style={dark ? { background: "var(--tws-accent)", color: "var(--tws-ink)" } : { background: "var(--tws-char)", color: "#fff" }}>Add</button>
      </form>
    </div>
  );
}
