"use client";

// Hand over a leaver's open work to someone else, and optionally deactivate them in the same step.
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import type { User } from "./UsersView";

type Kind = { key: string; label: string; count: number; byDefault: boolean };
type Summary = { kinds: Kind[]; trainerOn: string[] };

export default function HandoverDialog({ user, users, onClose, onDone }: { user: User; users: User[]; onClose: () => void; onDone: (message: string) => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [deactivate, setDeactivate] = useState(!user.deactivatedAt);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${user.id}/handover`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load their work"))))
      .then((d: Summary) => { setSummary(d); setPicked(d.kinds.filter(k => k.byDefault).map(k => k.key)); })
      .catch(e => setError(e.message));
  }, [user.id]);

  const takers = users.filter(u => u.id !== user.id && !u.deactivatedAt && u.role !== "client");
  const nothing = summary && summary.kinds.length === 0;

  async function submit() {
    if (!nothing && !toUserId) { setError("Pick who takes over"); return; }
    setBusy(true); setError("");
    const res = nothing
      ? await fetch(`/api/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deactivated: true }) })
      : await fetch(`/api/users/${user.id}/handover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toUserId: Number(toUserId), kinds: picked, deactivate }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "That didn't work"); return; }
    const taker = users.find(u => u.id === Number(toUserId))?.name;
    const moved = (d.moved ?? []) as { count: number }[];
    const total = moved.reduce((n, m) => n + m.count, 0);
    onDone(nothing ? `${user.name} has been deactivated.` : `${total} item${total === 1 ? "" : "s"} handed to ${taker}${d.deactivated ? `, and ${user.name} has been deactivated` : ""}.`);
  }

  return (
    <Modal title={`Hand over ${user.name}'s work`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        {!summary && !error && <p style={{ color: "var(--psg-muted)" }}>Checking what they have open…</p>}
        {nothing && <p style={{ color: "var(--psg-muted)" }}>{user.name} has nothing open to hand over.</p>}
        {summary && summary.kinds.length > 0 && (
          <>
            <p style={{ color: "var(--psg-muted)" }}>Open work moves to the person you pick. Finished work and their history stay under their name.</p>
            <fieldset className="space-y-2">
              <legend className="sr-only">What to hand over</legend>
              {summary.kinds.map(k => (
                <label key={k.key} className="flex items-start gap-2 text-white">
                  <input type="checkbox" className="mt-1" checked={picked.includes(k.key)} onChange={e => setPicked(p => (e.target.checked ? [...p, k.key] : p.filter(x => x !== k.key)))} />
                  <span>{k.label} <span className="tabular-nums" style={{ color: "var(--psg-muted)" }}>· {k.count}</span></span>
                </label>
              ))}
            </fieldset>
            <label className="block">
              <span className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Hand over to</span>
              <select value={toUserId} onChange={e => setToUserId(e.target.value)} className="w-full rounded px-3 py-2 text-sm text-white border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
                <option value="">Pick someone…</option>
                {takers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          </>
        )}
        {summary && summary.trainerOn.length > 0 && (
          <p className="rounded px-3 py-2 text-xs" style={{ backgroundColor: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
            They&apos;re a named trainer on {summary.trainerOn.join(", ")}. Trainers aren&apos;t moved automatically: add a qualified trainer on each machine.
          </p>
        )}
        {summary && !user.deactivatedAt && !nothing && (
          <label className="flex items-center gap-2 text-white">
            <input type="checkbox" checked={deactivate} onChange={e => setDeactivate(e.target.checked)} />
            Also deactivate {user.name} (they can&apos;t sign in; their history stays)
          </label>
        )}
        {error && <p role="alert" style={{ color: "#f87171" }}>{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded text-sm" style={{ color: "var(--psg-muted)" }}>Cancel</button>
          {summary && (!nothing || !user.deactivatedAt) && (
            <button type="button" onClick={submit} disabled={busy || (!nothing && picked.length === 0 && !deactivate)} className="px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>
              {busy ? "Saving…" : nothing ? `Deactivate ${user.name}` : "Hand over"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
