"use client";

// Crew jobs on a hire or a production (crew offers, 27 Nov 2026). Add a job (role, day, times,
// how many people, pay, and on a hire what the client is charged), ask people from the crew
// directory if they're free, see their answers, and book who you want. Each person gets a private
// link (emailed if they have an address); copy it to send by text or WhatsApp.
import { useCallback, useEffect, useMemo, useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";

type Offer = { id: number; status: string; reply: string | null; token: string; emailedTo: string | null; sentAt: string; respondedAt: string | null;
  crew: { id: number; name: string; discipline: string; email: string | null; phone: string | null } };
type Job = { id: number; role: string; date: string; callTime: string | null; endTime: string | null; places: number; payRate: number | null; payUnit: string; hours: number | null; chargeRate: number | null; location: string | null; notes: string | null;
  offers: Offer[]; summary: { booked: number; open: number; full: boolean; available: number; waiting: number; payTotal: number | null; chargeTotal: number | null } };
type CrewPick = { id: number; name: string; discipline: string; email: string | null };
type Form = { id?: number; role: string; date: string; callTime: string; endTime: string; places: string; payRate: string; payUnit: string; hours: string; chargeRate: string; location: string; notes: string };

const STATUS: Record<string, string> = { offered: "Asked", available: "Available", unavailable: "Can't do it", booked: "Booked", released: "Released" };
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const dayShort = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** The look: "space" for a company space (TWS-style tokens), "hub" for the main Hub's production pages. */
const LOOKS = {
  space: { card: "var(--tws-card)", line: "var(--tws-line)", muted: "var(--tws-muted)", ink: "var(--tws-ink)", link: "var(--tws-accent-ink)", tint: "var(--tws-tint)", bad: "var(--tws-bad-ink)", good: "var(--tws-accent-light)", input: "#fff", btn: "var(--tws-char)" },
  hub: { card: "var(--psg-card-bg)", line: "var(--psg-card-border)", muted: "var(--psg-muted)", ink: "var(--psg-text, #fff)", link: "#60a5fa", tint: "rgba(255,255,255,0.04)", bad: "#f87171", good: "rgba(34,197,94,0.15)", input: "var(--psg-dark-bg)", btn: "var(--psg-blue)" },
};

export default function CrewJobs({ hireId, productionId, look = "space", defaultDate, charges = !!hireId, onChange }: { hireId?: number; productionId?: number; look?: keyof typeof LOOKS; defaultDate?: string; charges?: boolean; onChange?: () => void }) {
  const L = LOOKS[look];
  const scope = hireId ? `hireId=${hireId}` : `productionId=${productionId}`;
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [asking, setAsking] = useState<number | null>(null); // job id
  const [picked, setPicked] = useState<number[]>([]);
  const [crew, setCrew] = useState<CrewPick[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: L.input, color: L.ink, border: `1px solid ${L.line}`, padding: "7px 9px", fontSize: 14, borderRadius: look === "hub" ? 6 : 0 };
  const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: L.muted, marginBottom: 3 };
  const btn: React.CSSProperties = { background: L.btn, color: "#fff", padding: "8px 14px", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", borderRadius: look === "hub" ? 6 : 0 };
  const linkBtn = (c = L.link): React.CSSProperties => ({ color: c, fontWeight: 600, fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 });

  const call = async <T,>(url: string, method = "GET", body?: unknown): Promise<T | null> => {
    const r = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { await alertDialog(j.error ?? "That didn't work. Try again."); return null; }
    return j as T;
  };
  const load = useCallback(async () => { const r = await fetch(`/api/crew-jobs?${scope}`); if (r.ok) setJobs((await r.json()).jobs); }, [scope]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the jobs once the panel shows
  useEffect(() => { load(); }, [load]);
  // Bookings change the hire's charges or the production's crew, so the page around us reloads too
  const put = (job: Job) => { setJobs(js => (js ?? []).map(j => (j.id === job.id ? job : j))); onChange?.(); };

  const blank = (): Form => ({ role: "", date: defaultDate ?? new Date().toISOString().slice(0, 10), callTime: "08:00", endTime: "", places: "1", payRate: "", payUnit: "day", hours: "", chargeRate: "", location: "", notes: "" });
  const str = (n: number | null) => (n == null ? "" : String(n));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const body = { role: form.role, date: form.date, callTime: form.callTime, endTime: form.endTime, places: form.places, payRate: form.payRate, payUnit: form.payUnit, hours: form.payUnit === "hour" ? form.hours : null, chargeRate: charges ? form.chargeRate : undefined, location: form.location, notes: form.notes };
    const r = form.id ? await call<Job>(`/api/crew-jobs/${form.id}`, "PATCH", body) : await call<Job>("/api/crew-jobs", "POST", { ...body, hireId, productionId });
    setBusy(false);
    if (r) { setForm(null); if (form.id) put(r); else setJobs(js => [...(js ?? []), r]); }
  }
  async function removeJob(j: Job) {
    if (!(await confirmDialog(`Remove the ${j.role} job on ${dayShort(j.date)}?${j.summary.booked ? ` The ${j.summary.booked} booked will be told they're no longer needed.` : ""} This can't be undone.`, { danger: true, confirmLabel: "Remove" }))) return;
    if (await call(`/api/crew-jobs/${j.id}`, "DELETE")) { setJobs(js => (js ?? []).filter(x => x.id !== j.id)); onChange?.(); }
  }
  async function openAsk(j: Job) {
    setAsking(j.id); setPicked([]); setQ("");
    if (!crew) { const r = await fetch("/api/crew"); setCrew(r.ok ? await r.json() : []); }
  }
  async function ask() {
    if (!asking || !picked.length) return;
    setBusy(true);
    const r = await call<{ job: Job; sent: { name: string; emailed: string | null }[]; skipped: number }>(`/api/crew-jobs/${asking}/offers`, "POST", { crewIds: picked });
    setBusy(false);
    if (!r) return;
    put(r.job); setAsking(null);
    const noEmail = r.sent.filter(s => !s.emailed).map(s => s.name);
    if (noEmail.length) await alertDialog(`Asked ${r.sent.length}. ${noEmail.join(", ")} ${noEmail.length === 1 ? "wasn't" : "weren't"} emailed (no address, or email isn't set up): use Copy link to send them theirs.`);
  }
  async function act(o: Offer, body: Record<string, unknown>, ask?: string) {
    if (ask && !(await confirmDialog(ask))) return;
    const r = await call<Job>(`/api/crew-offers/${o.id}`, "PATCH", body);
    if (r) put(r);
  }
  async function withdraw(o: Offer) {
    if (!(await confirmDialog(`Withdraw the offer to ${o.crew.name}? Their link will stop working.`))) return;
    const r = await call<Job>(`/api/crew-offers/${o.id}`, "DELETE");
    if (r) put(r);
  }
  async function copy(o: Offer) {
    const url = `${window.location.origin}/crew-offer/${o.token}`;
    try { await navigator.clipboard.writeText(url); setCopied(o.id); setTimeout(() => setCopied(null), 2000); }
    catch { await alertDialog(`Their link:\n${url}`); }
  }

  const askingJob = jobs?.find(j => j.id === asking);
  const choices = useMemo(() => {
    const t = q.trim().toLowerCase();
    const taken = new Set(askingJob?.offers.map(o => o.crew.id));
    return (crew ?? []).filter(c => !taken.has(c.id) && (!t || c.name.toLowerCase().includes(t) || c.discipline.toLowerCase().includes(t))).slice(0, 60);
  }, [crew, q, askingJob]);

  return (
    <div className="flex flex-col gap-3" aria-label="Crew jobs" style={{ color: L.ink }}>
      <div className="flex justify-between items-baseline gap-2 flex-wrap">
        <span className="text-sm font-semibold">Crew <span className="font-normal" style={{ color: L.muted }}>· ask people from the crew directory, then book who you want</span></span>
        {!form && <button type="button" style={linkBtn()} onClick={() => setForm(blank())}>+ Add a crew job</button>}
      </div>
      {jobs === null ? <p className="text-sm" style={{ color: L.muted }}>Loading…</p> : jobs.length === 0 && !form ? <p className="text-sm" style={{ color: L.muted }}>No crew jobs yet.</p> : null}

      {jobs?.map(j => (
        <div key={j.id} className="flex flex-col gap-2 p-3" style={{ border: `1px solid ${L.line}`, background: L.card, borderRadius: look === "hub" ? 8 : 0 }}>
          <div className="flex justify-between gap-2 items-start flex-wrap">
            <div className="min-w-0">
              <div className="font-bold">{j.role} <span className="font-normal" style={{ color: L.muted }}>· {dayShort(j.date)}{j.callTime ? `, ${j.callTime}${j.endTime ? `–${j.endTime}` : ""}` : ""}{j.location ? ` · ${j.location}` : ""}</span></div>
              <div className="text-xs" style={{ color: L.muted }}>
                {j.summary.booked} of {j.places} booked{j.summary.available ? ` · ${j.summary.available} available` : ""}{j.summary.waiting ? ` · ${j.summary.waiting} not answered` : ""}
                {j.payRate != null ? ` · pay ${gbp(j.payRate)} ${j.payUnit === "hour" ? `an hour${j.hours ? ` × ${j.hours}` : ""}` : j.payUnit === "job" ? "for the job" : "a day"}` : ""}
                {charges && j.chargeRate != null ? ` · client charged ${gbp(j.chargeRate)} each` : ""}
                {j.summary.payTotal ? ` · costs us ${gbp(j.summary.payTotal)}` : ""}
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              {!j.summary.full && <button type="button" style={linkBtn()} onClick={() => openAsk(j)}>Ask people</button>}
              <button type="button" style={linkBtn()} onClick={() => setForm({ id: j.id, role: j.role, date: j.date.slice(0, 10), callTime: j.callTime ?? "", endTime: j.endTime ?? "", places: String(j.places), payRate: str(j.payRate), payUnit: j.payUnit, hours: str(j.hours), chargeRate: str(j.chargeRate), location: j.location ?? "", notes: j.notes ?? "" })}>Edit</button>
              <button type="button" style={linkBtn(L.bad)} onClick={() => removeJob(j)}>Remove</button>
            </div>
          </div>
          {j.offers.length > 0 && (
            <ul className="flex flex-col">
              {j.offers.map(o => (
                <li key={o.id} className="py-1.5 flex gap-2 items-center flex-wrap text-sm" style={{ borderTop: `1px solid ${L.line}` }}>
                  <span className="font-semibold">{o.crew.name}</span>
                  <span className="text-xs" style={{ color: L.muted }}>{o.crew.discipline}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5" style={o.status === "booked" ? { background: L.btn, color: "#fff" } : o.status === "available" ? { background: L.good } : o.status === "unavailable" || o.status === "released" ? { color: L.muted, textDecoration: o.status === "released" ? "line-through" : undefined } : { border: `1px dashed ${L.muted}` }}>{STATUS[o.status] ?? o.status}</span>
                  {o.reply && <span className="text-xs italic" style={{ color: L.muted }}>“{o.reply}”</span>}
                  <span className="ml-auto flex gap-3 flex-wrap">
                    {o.status === "booked" ? <button type="button" style={linkBtn(L.bad)} onClick={() => act(o, { action: "release" }, `Release ${o.crew.name}? They'll be told they're no longer needed.`)}>Release</button>
                      : <>
                        {o.status !== "unavailable" && !j.summary.full && <button type="button" style={linkBtn()} onClick={() => act(o, { action: "book" })}>Book</button>}
                        {o.status === "offered" && <button type="button" style={linkBtn()} onClick={() => act(o, { action: "answer", status: "available" })} title="They said yes some other way">Said yes</button>}
                        {o.status !== "unavailable" && <button type="button" style={linkBtn()} onClick={() => act(o, { action: "answer", status: "unavailable" })} title="They said no some other way">Said no</button>}
                        {o.status === "unavailable" && <button type="button" style={linkBtn()} onClick={() => act(o, { action: "answer", status: "available" })}>Now free</button>}
                        <button type="button" style={linkBtn()} onClick={() => act(o, { action: "resend" })}>Ask again</button>
                        <button type="button" style={linkBtn(L.bad)} onClick={() => withdraw(o)}>Withdraw</button>
                      </>}
                    <button type="button" style={linkBtn()} onClick={() => copy(o)}>{copied === o.id ? "Copied ✓" : "Copy link"}</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {asking === j.id && (
            <div className="flex flex-col gap-2 p-3" style={{ background: L.tint }}>
              <label style={lbl} htmlFor={`ask-${j.id}`}>Who to ask (search by name or discipline)</label>
              <input id={`ask-${j.id}`} style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. lighting" autoComplete="off" />
              {crew === null ? <p className="text-sm" style={{ color: L.muted }}>Loading the crew directory…</p> : choices.length === 0 ? <p className="text-sm" style={{ color: L.muted }}>No one else matches. Add people in the crew directory.</p> : (
                <div className="flex flex-col max-h-56 overflow-y-auto">
                  {choices.map(c => (
                    <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                      <input type="checkbox" checked={picked.includes(c.id)} onChange={e => setPicked(p => (e.target.checked ? [...p, c.id] : p.filter(x => x !== c.id)))} />
                      <span className="font-semibold">{c.name}</span><span className="text-xs" style={{ color: L.muted }}>{c.discipline}{c.email ? "" : " · no email: copy their link"}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-center"><button type="button" style={btn} disabled={busy || !picked.length} onClick={ask}>Ask {picked.length || ""}</button>
                <button type="button" style={linkBtn(L.muted)} onClick={() => setAsking(null)}>Cancel</button></div>
            </div>
          )}
        </div>
      ))}

      {form && (
        <form onSubmit={save} className="flex flex-col gap-3 p-3" style={{ border: `2px solid ${L.btn}`, background: L.card, borderRadius: look === "hub" ? 8 : 0 }} aria-label={form.id ? "Edit crew job" : "Add a crew job"}>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <div className="col-span-2"><label style={lbl} htmlFor="cj-role">Job</label><input id="cj-role" style={input} required maxLength={80} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Lighting technician" /></div>
            <div><label style={lbl} htmlFor="cj-date">Day</label><input id="cj-date" type="date" style={input} required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div><label style={lbl} htmlFor="cj-places">People</label><input id="cj-places" style={input} inputMode="numeric" value={form.places} onChange={e => setForm({ ...form, places: e.target.value })} /></div>
            <div><label style={lbl} htmlFor="cj-call">Call time</label><input id="cj-call" type="time" style={input} value={form.callTime} onChange={e => setForm({ ...form, callTime: e.target.value })} /></div>
            <div><label style={lbl} htmlFor="cj-end">Finish</label><input id="cj-end" type="time" style={input} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></div>
            <div className="col-span-2"><label style={lbl} htmlFor="cj-loc">Where</label><input id="cj-loc" style={input} maxLength={200} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div><label style={lbl} htmlFor="cj-pay">Pay £ (each)</label><input id="cj-pay" style={input} inputMode="decimal" value={form.payRate} onChange={e => setForm({ ...form, payRate: e.target.value })} /></div>
            <div><label style={lbl} htmlFor="cj-unit">Per</label><select id="cj-unit" style={input} value={form.payUnit} onChange={e => setForm({ ...form, payUnit: e.target.value })}><option value="day">Day</option><option value="hour">Hour</option><option value="job">Job</option></select></div>
            {form.payUnit === "hour" && <div><label style={lbl} htmlFor="cj-hours">Hours</label><input id="cj-hours" style={input} inputMode="decimal" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} /></div>}
            {charges && <div><label style={lbl} htmlFor="cj-charge">Charge the client £ (each)</label><input id="cj-charge" style={input} inputMode="decimal" value={form.chargeRate} onChange={e => setForm({ ...form, chargeRate: e.target.value })} /></div>}
            <div className="col-span-2 sm:col-span-4"><label style={lbl} htmlFor="cj-notes">Notes for the crew (what to wear, parking, who to ask for)</label><textarea id="cj-notes" style={input} rows={2} maxLength={2000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          {charges && <p className="text-xs" style={{ color: L.muted }}>When people are booked, the charge (× how many are booked) is added to the hire&apos;s other charges, and kept up to date.</p>}
          <div className="flex gap-2"><button type="submit" style={btn} disabled={busy}>{form.id ? "Save" : "Add job"}</button><button type="button" style={linkBtn(L.muted)} onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
