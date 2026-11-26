"use client";

// Machine inductions on a workshop's Safety page (26 Nov 2026): who's inducted on which machine, with
// refresher dates; a machine's trainers record an induction that trainee and trainer both sign; the
// workshop's staff look after the machine list and its trainers. Others see their own row.
import { useEffect, useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import SignaturePad from "@/components/SignaturePad";
import { card, h2, muted, link, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";
import { STATUS_LABEL, type Status } from "@/lib/inductionsCore";

type Machine = { id: number; name: string; location: string | null; refresherMonths: number; notes: string | null; archived: boolean; trainers: { user: { id: number; name: string } }[] };
type Person = { key: string; userId: number | null; name: string; company: string | null; team: boolean };
type Cell = { id: number; status: Status; inductedAt: string; expiresAt: string | null; trainerName: string };
type Data = { staff: boolean; me: number; canTrain: number[]; machines: Machine[]; people: Person[]; cells: Record<string, Record<number, Cell>>; trainersPick: { id: number; name: string }[] };
type Record_ = { id: number; personName: string; personCompany: string | null; trainerName: string; inductedAt: string; expiresAt: string | null; notes: string | null; traineeSignature: string; trainerSignature: string; revokedAt: string | null; revokeNote: string | null; manage: boolean; machine: { name: string } };

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const TONE: Record<Status, React.CSSProperties> = {
  valid: { background: "#e2f1e7", color: "#1d6b3c", border: "1px solid #9fd0b0" },
  due: { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", border: "1px solid var(--tws-warn-line)" },
  expired: { background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)", border: "1px solid var(--tws-bad-line)" },
  none: { background: "transparent", color: "var(--tws-muted)", border: "1px dashed var(--tws-line)" },
};
const today = () => new Date().toISOString().slice(0, 10);
/** A short date: "26 Oct", with the year when it isn't this year ("Oct 2028"). */
const short = (d: string | null) => {
  if (!d) return "";
  const x = new Date(d);
  return x.getUTCFullYear() === new Date().getUTCFullYear() ? x.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : x.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
};
const blank = () => ({ machineId: "", person: "", personName: "", personCompany: "", inductedAt: today(), notes: "", trainee: null as string | null, trainer: null as string | null });

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,15,0.6)" }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-xl max-h-[92vh] overflow-y-auto flex flex-col gap-4" style={{ ...card, borderTop: "6px solid var(--tws-accent)" }}>
        <div className="flex justify-between items-start gap-3"><h2 style={h2}>{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none" style={muted}>×</button></div>
        {children}
      </div>
    </div>
  );
}

export default function MachineInductions({ slug }: { slug: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null);
  const [rec, setRec] = useState<Record_ | null>(null);
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState({ name: "", location: "", refresherMonths: "12" });
  const [padKey, setPadKey] = useState(0);
  const [showRetired, setShowRetired] = useState(false);
  const api = `/api/spaces/${slug}/machines`;

  useEffect(() => { fetch(api).then(r => (r.ok ? r.json() : null)).then(x => x && setD(x)).catch(() => {}); }, [api]);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const x = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(x.error ?? "That didn't work"); return null; }
    if (x.machines) setD(x);
    return x;
  }
  async function openRecord(id: number) {
    const r = await fetch(`/api/machine-inductions/${id}`).then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (r) setRec(r); else alertDialog("Couldn't open that record");
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const p = d?.people.find(x => x.key === form.person);
    const body = { inductedAt: form.inductedAt, notes: form.notes, traineeSignature: form.trainee, trainerSignature: form.trainer,
      ...(p?.userId ? { userId: p.userId } : { personName: p ? p.name : form.personName, personCompany: p ? p.company : form.personCompany }) };
    if (await call(`/api/machines/${form.machineId}/inductions`, "POST", body)) setForm(null);
  }

  if (!d) return null;
  const live = d.machines.filter(m => !m.archived);
  const shownPeople = d.staff ? d.people : d.people.filter(p => p.userId === d.me);
  const trainable = live.filter(m => d.canTrain.includes(m.id));
  const start = (machineId?: number, person?: string) => { setForm({ ...blank(), machineId: String(machineId ?? trainable[0]?.id ?? ""), person: person ?? "" }); setPadKey(k => k + 1); };
  const chosen = live.find(m => String(m.id) === form?.machineId);
  const who = d.people.find(p => p.key === form?.person);

  return (
    <section id="inductions" style={card} className="flex flex-col gap-4 min-w-0" aria-label="Machine inductions">
      <div className="flex flex-wrap justify-between items-baseline gap-3">
        <div className="flex flex-col gap-1">
          <h2 style={h2}>Machine inductions</h2>
          <span className="text-sm" style={muted}>{d.staff ? "Who's been shown how to use each machine safely, and when they need a refresher." : "The machines you've been inducted on."}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {trainable.length > 0 && <button type="button" onClick={() => start()} style={{ ...btnSolid, padding: "8px 14px" }}>+ Record an induction</button>}
          {d.staff && <button type="button" aria-expanded={manage} onClick={() => setManage(!manage)} style={{ ...btnLine, padding: "8px 14px" }}>{manage ? "Done" : "Machines & trainers"}</button>}
        </div>
      </div>

      {live.length === 0 && !manage && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span style={muted}>No machines listed yet.</span>
          {d.staff && <button type="button" disabled={busy} onClick={() => call(api, "POST", { usual: true })} style={link}>Add the usual ones (panel saw, bandsaw, welder…)</button>}
          {d.staff && <button type="button" onClick={() => setManage(true)} style={link}>Add your own</button>}
        </div>
      )}

      {manage && d.staff && (
        <div className="flex flex-col gap-2 p-3" style={{ background: "var(--tws-ground)" }}>
          <p className="text-xs m-0" style={muted}>Trainers can record inductions on that machine. A refresher of 0 months means it never lapses; a change applies to inductions recorded from now on.</p>
          <ul className="flex flex-col m-0 p-0 list-none">
            {d.machines.filter(m => showRetired || !m.archived).map(m => (
              <li key={`${m.id}-${m.name}-${m.refresherMonths}-${m.location}`} className="py-2 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--tws-line-soft)", opacity: m.archived ? 0.55 : 1 }}>
                <div className="grid gap-2 items-center grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_6.5rem_auto]">
                  <input aria-label={`Name of ${m.name}`} style={{ ...input, padding: "6px 8px", fontSize: 13 }} defaultValue={m.name} onBlur={e => e.target.value.trim() && e.target.value.trim() !== m.name && call(`/api/machines/${m.id}`, "PATCH", { name: e.target.value })} />
                  <input aria-label={`Where ${m.name} is`} placeholder="Where" style={{ ...input, padding: "6px 8px", fontSize: 13 }} defaultValue={m.location ?? ""} onBlur={e => e.target.value !== (m.location ?? "") && call(`/api/machines/${m.id}`, "PATCH", { location: e.target.value })} />
                  <label className="flex items-center gap-1 text-xs" style={muted}><input aria-label={`Refresher months for ${m.name}`} type="number" min={0} max={120} style={{ ...input, padding: "6px 8px", fontSize: 13 }} defaultValue={m.refresherMonths} onBlur={e => Number(e.target.value) !== m.refresherMonths && call(`/api/machines/${m.id}`, "PATCH", { refresherMonths: e.target.value })} />mo</label>
                  <button type="button" disabled={busy} onClick={() => call(`/api/machines/${m.id}`, "PATCH", { archived: !m.archived })} className="text-xs" style={muted}>{m.archived ? "Restore" : "Retire"}</button>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center text-xs" role="group" aria-label={`Trainers for ${m.name}`}>
                  <span style={muted}>Trainers:</span>
                  {d.trainersPick.map(u => {
                    const on = m.trainers.some(t => t.user.id === u.id);
                    return <button key={u.id} type="button" aria-pressed={on} disabled={busy} onClick={() => call(`/api/machines/${m.id}`, "PATCH", { trainerIds: on ? m.trainers.filter(t => t.user.id !== u.id).map(t => t.user.id) : [...m.trainers.map(t => t.user.id), u.id] })}
                      className="px-2 py-0.5" style={on ? { background: "var(--tws-char)", color: "#fff", border: "1px solid var(--tws-char)" } : { border: "1px solid var(--tws-line)", color: "var(--tws-muted)" }}>{on ? "✓ " : ""}{u.name}</button>;
                  })}
                  {m.trainers.length === 0 && <span style={{ color: "var(--tws-warn-ink)" }}>none yet: only admins can induct</span>}
                </div>
              </li>
            ))}
          </ul>
          <form className="grid gap-2 items-center grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_6.5rem_auto]" onSubmit={async e => { e.preventDefault(); if (await call(api, "POST", add)) setAdd({ name: "", location: "", refresherMonths: "12" }); }}>
            <input aria-label="New machine" placeholder="e.g. CNC router" style={{ ...input, padding: "6px 8px", fontSize: 13 }} value={add.name} onChange={e => setAdd({ ...add, name: e.target.value })} />
            <input aria-label="Where it is" placeholder="Where" style={{ ...input, padding: "6px 8px", fontSize: 13 }} value={add.location} onChange={e => setAdd({ ...add, location: e.target.value })} />
            <input aria-label="Refresher months" type="number" min={0} max={120} style={{ ...input, padding: "6px 8px", fontSize: 13 }} value={add.refresherMonths} onChange={e => setAdd({ ...add, refresherMonths: e.target.value })} />
            <button type="submit" disabled={busy || !add.name.trim()} style={{ ...btnSolid, padding: "6px 12px", fontSize: 13 }}>Add</button>
          </form>
          {d.machines.some(m => m.archived) && <button type="button" onClick={() => setShowRetired(!showRetired)} className="self-start text-xs underline" style={muted}>{showRetired ? "Hide retired" : "Show retired"}</button>}
        </div>
      )}

      {live.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 text-xs" aria-label="Key">
            {(["valid", "due", "expired", "none"] as Status[]).map(s => <span key={s} className="flex items-center gap-1.5"><span className="inline-block w-4 h-4" style={TONE[s]} />{STATUS_LABEL[s]}</span>)}
          </div>
          <div className="overflow-x-auto">
            <table className="text-[13px]" style={{ borderCollapse: "collapse", minWidth: "100%" }}>
              <thead>
                <tr>
                  <th scope="col" className="text-left py-2 pr-3 font-semibold sticky left-0" style={{ background: "var(--tws-card)", minWidth: 150 }}>Person</th>
                  {live.map(m => <th key={m.id} scope="col" className="py-2 px-1.5 font-semibold text-center align-bottom" style={{ minWidth: 92, maxWidth: 120 }} title={[m.location, m.refresherMonths ? `refresher every ${m.refresherMonths} months` : "no refresher"].filter(Boolean).join(" · ")}>{m.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {shownPeople.map(p => (
                  <tr key={p.key} style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                    <th scope="row" className="text-left py-1.5 pr-3 font-semibold sticky left-0" style={{ background: "var(--tws-card)" }}>
                      {p.name}{!p.team && <span className="block text-[11px] font-normal" style={muted}>{p.company ? `${p.company} · ` : ""}{p.userId ? "not in the team" : "no login"}</span>}
                    </th>
                    {live.map(m => {
                      const c = d.cells[p.key]?.[m.id];
                      const s: Status = c?.status ?? "none";
                      const canAdd = d.canTrain.includes(m.id);
                      const text = c ? (s === "valid" ? (c.expiresAt ? `to ${short(c.expiresAt)}` : "✓") : s === "due" ? `due ${short(c.expiresAt)}` : "lapsed") : canAdd ? "+" : "–";
                      return (
                        <td key={m.id} className="px-1 py-1 text-center">
                          <button type="button" disabled={!c && !canAdd} onClick={() => (c ? openRecord(c.id) : start(m.id, p.key))}
                            aria-label={`${p.name}, ${m.name}: ${STATUS_LABEL[s]}${c?.expiresAt ? `, refresher ${day(c.expiresAt)}` : ""}${!c && canAdd ? ". Record an induction" : ""}`}
                            className="w-full text-[12px] font-semibold px-1.5 py-1 min-h-8" style={{ ...TONE[s], cursor: c || canAdd ? "pointer" : "default" }}>{text}</button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.staff && <p className="text-xs m-0" style={muted}>The team are the people whose company is this workshop (Admin → Users). Visitors appear once they&apos;ve been inducted. Inductions on a build part&apos;s machines are checked in the planner and on the tablet.</p>}
        </>
      )}

      {form && (
        <Overlay title="Record an induction" onClose={() => setForm(null)}>
          <form onSubmit={save} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="ind-m" style={lbl}>Machine</label>
                <select id="ind-m" required style={input} value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })}>{trainable.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              <div><label htmlFor="ind-d" style={lbl}>Date</label><input id="ind-d" type="date" required max={today()} style={input} value={form.inductedAt} onChange={e => setForm({ ...form, inductedAt: e.target.value })} /></div>
            </div>
            <div><label htmlFor="ind-p" style={lbl}>Who</label>
              <select id="ind-p" required style={input} value={form.person} onChange={e => setForm({ ...form, person: e.target.value })}>
                <option value="">Choose…</option>
                {d.people.map(p => <option key={p.key} value={p.key}>{p.name}{p.company ? ` (${p.company})` : ""}</option>)}
                <option value="new">Someone else (visitor, short-term)…</option>
              </select></div>
            {form.person === "new" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="ind-n" style={lbl}>Their name</label><input id="ind-n" required style={input} value={form.personName} onChange={e => setForm({ ...form, personName: e.target.value })} /></div>
                <div><label htmlFor="ind-c" style={lbl}>Company (optional)</label><input id="ind-c" style={input} value={form.personCompany} onChange={e => setForm({ ...form, personCompany: e.target.value })} /></div>
              </div>
            )}
            <div><label htmlFor="ind-notes" style={lbl}>What was covered (optional)</label><input id="ind-notes" style={input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Guards, push sticks, riving knife, emergency stop" /></div>
            <p className="text-sm m-0 p-3" style={{ background: "var(--tws-ground)" }}>
              <strong>{who?.name ?? form.personName ?? "The trainee"}</strong> has been shown how to use the <strong>{chosen?.name ?? "machine"}</strong> safely, including its guards, PPE and emergency stop, has used it under supervision, and knows to ask if unsure.
              {chosen && <> {chosen.refresherMonths ? `Refresher due in ${chosen.refresherMonths} months.` : "No refresher needed."}</>}
            </p>
            <div className="grid gap-3 sm:grid-cols-2" key={padKey}>
              <SignaturePad label="Trainee signs" onChange={png => setForm(f => f && { ...f, trainee: png })} />
              <SignaturePad label="Trainer signs" onChange={png => setForm(f => f && { ...f, trainer: png })} />
            </div>
            <div className="flex gap-2"><button type="submit" disabled={busy || !form.trainee || !form.trainer || !form.person} style={{ ...btnSolid, padding: "9px 16px" }}>Save induction</button><button type="button" onClick={() => setForm(null)} style={{ ...btnLine, padding: "9px 16px" }}>Cancel</button></div>
          </form>
        </Overlay>
      )}

      {rec && (
        <Overlay title={`${rec.machine.name} induction`} onClose={() => setRec(null)}>
          <dl className="grid gap-3 sm:grid-cols-2 m-0 text-sm">
            <div><dt style={lbl}>Who</dt><dd className="m-0">{rec.personName}{rec.personCompany ? ` (${rec.personCompany})` : ""}</dd></div>
            <div><dt style={lbl}>Trainer</dt><dd className="m-0">{rec.trainerName}</dd></div>
            <div><dt style={lbl}>Inducted</dt><dd className="m-0">{day(rec.inductedAt)}</dd></div>
            <div><dt style={lbl}>Refresher</dt><dd className="m-0">{rec.expiresAt ? day(rec.expiresAt) : "Not needed"}</dd></div>
            {rec.notes && <div className="sm:col-span-2"><dt style={lbl}>Covered</dt><dd className="m-0">{rec.notes}</dd></div>}
          </dl>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <figure className="m-0"><img src={rec.traineeSignature} alt={`${rec.personName}'s signature`} style={{ width: "100%", background: "#fff", border: "1px solid var(--tws-line)" }} /><figcaption className="text-xs" style={muted}>Trainee</figcaption></figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <figure className="m-0"><img src={rec.trainerSignature} alt={`${rec.trainerName}'s signature`} style={{ width: "100%", background: "#fff", border: "1px solid var(--tws-line)" }} /><figcaption className="text-xs" style={muted}>Trainer</figcaption></figure>
          </div>
          {rec.revokedAt ? <p className="text-sm m-0" style={{ color: "var(--tws-bad-ink)" }}>Withdrawn {day(rec.revokedAt)}: {rec.revokeNote}</p> : rec.manage && (
            <form className="flex flex-wrap gap-2 items-center" onSubmit={async e => { e.preventDefault(); const note = (e.currentTarget.elements.namedItem("why") as HTMLInputElement).value; if (await call(`/api/machine-inductions/${rec.id}`, "PATCH", { revoke: note })) setRec(null); }}>
              <input name="why" aria-label="Why withdraw it" required placeholder="Why withdraw it (e.g. unsafe use)" style={{ ...input, flex: "1 1 14rem", width: "auto" }} />
              <button type="submit" disabled={busy} style={{ ...btnLine, padding: "8px 12px", color: "var(--tws-bad-ink)", borderColor: "var(--tws-bad-line)" }}>Withdraw induction</button>
            </form>
          )}
          {!rec.revokedAt && d.canTrain.length > 0 && <p className="text-xs m-0" style={muted}>For a refresher, record a new induction: it replaces this one.</p>}
        </Overlay>
      )}
    </section>
  );
}
