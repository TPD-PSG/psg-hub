"use client";

// "+ New build job" on a company space's home: name, client, the show it's for, build dates and
// how it leaves. Creates the job in this company at the Quote stage and opens it.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { alertDialog } from "@/components/Dialogs";
import { btnSolid, btnLine, input, label as lbl, h2, muted } from "@/lib/twsUi";

type Opt = { id: number; name: string };

export default function NewBuildJob({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lists, setLists] = useState<{ clients: Opt[]; productions: Opt[] } | null>(null);
  const [f, setF] = useState({ title: "", clientId: "", forProductionId: "", startDate: "", dueOut: "", deliveryMethod: "", notes: "" });

  async function show() {
    setOpen(true);
    if (lists) return;
    const get = (u: string) => fetch(u).then(r => (r.ok ? r.json() : [])).catch(() => []);
    const [c, p] = await Promise.all([get("/api/clients"), get("/api/productions")]);
    setLists({
      clients: Array.isArray(c) ? c.map((x: Opt) => ({ id: x.id, name: x.name })) : [],
      productions: Array.isArray(p) ? p.filter((x: { status?: string }) => x.status !== "closed").map((x: Opt) => ({ id: x.id, name: x.name })) : [],
    });
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/spaces/${slug}/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return alertDialog(body.error ?? "Couldn't start the build");
    router.push(`/spaces/${slug}/jobs/${body.id}`);
  }

  return (
    <>
      <button type="button" onClick={show} style={btnSolid}>+ New build job</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(31,34,38,0.6)" }} role="dialog" aria-modal="true" aria-labelledby="nbj-h">
          <form onSubmit={create} className="w-full max-w-xl flex flex-col gap-3 p-6" style={{ background: "var(--tws-card)", borderTop: "6px solid var(--tws-accent)", color: "var(--tws-ink)" }}>
            <h2 id="nbj-h" style={h2}>New build job</h2>
            <p className="text-[13px]" style={{ ...muted, margin: 0 }}>Starts at the Quote stage. The price is added from an accepted quote or by directors, BD or finance.</p>
            <div><label htmlFor="nbj-title" style={lbl}>Build</label>
              <input id="nbj-title" required autoFocus style={input} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Panto palace flats and portal" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="nbj-client" style={lbl}>Client</label>
                <select id="nbj-client" style={input} value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value })}>
                  <option value="">{lists ? "Not set" : "Loading…"}</option>{lists?.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div><label htmlFor="nbj-show" style={lbl}>For production</label>
                <select id="nbj-show" style={input} value={f.forProductionId} onChange={e => setF({ ...f, forProductionId: e.target.value })}>
                  <option value="">{lists ? "Not on the Hub / none" : "Loading…"}</option>{lists?.productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div><label htmlFor="nbj-start" style={lbl}>Build starts</label>
                <input id="nbj-start" type="date" style={input} value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></div>
              <div><label htmlFor="nbj-due" style={lbl}>Due out of the workshop</label>
                <input id="nbj-due" type="date" style={input} value={f.dueOut} onChange={e => setF({ ...f, dueOut: e.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="nbj-how" style={lbl}>Leaving by</label>
                <select id="nbj-how" style={input} value={f.deliveryMethod} onChange={e => setF({ ...f, deliveryMethod: e.target.value })}>
                  <option value="">Not decided</option><option value="collection">Collection (client collects)</option><option value="delivery">Delivery (we deliver)</option>
                </select></div>
            </div>
            <div><label htmlFor="nbj-notes" style={lbl}>Notes</label>
              <textarea id="nbj-notes" rows={2} style={input} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Anything the team should know" /></div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={busy} style={btnSolid}>{busy ? "Creating…" : "Create build"}</button>
              <button type="button" onClick={() => setOpen(false)} style={btnLine}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
