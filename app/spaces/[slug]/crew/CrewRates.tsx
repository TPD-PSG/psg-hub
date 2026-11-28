"use client";

// Crew rates in the Rentals space: each crew role's standard pay and client charge, by the day,
// the hour or the job. Picking a role on a hire's crew job fills these in (they can still be
// changed for that hire). Roles marked for the rate card show their charge to clients, never the pay.
import { useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { api, th, td } from "@/components/rentals/shared";
import { card, h2, muted, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";
import { RATE_UNIT, rateLabel } from "@/lib/crewRates";

export type CrewRateRow = { id: number; role: string; unit: string; hours: number | null; payRate: number | null; chargeRate: number | null; notes: string | null; onRateCard: boolean; archived: boolean; sortOrder: number };
type Form = { id?: number; role: string; unit: string; hours: string; payRate: string; chargeRate: string; notes: string; onRateCard: boolean };
const blank: Form = { role: "", unit: "day", hours: "", payRate: "", chargeRate: "", notes: "", onRateCard: true };
const UNIT_OPTION: Record<string, string> = { day: "By the day", hour: "By the hour", job: "For the job" };
const str = (n: number | null) => (n == null ? "" : String(n));

export default function CrewRates({ slug, initial }: { slug: string; initial: CrewRateRow[] }) {
  const [rates, setRates] = useState(initial);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const reload = async () => { const r = await api<{ rates: CrewRateRow[] }>(`/api/spaces/${slug}/rentals/crew-rates`); if (r) setRates(r.rates); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const body = { role: form.role, unit: form.unit, hours: form.unit === "hour" ? form.hours : null, payRate: form.payRate, chargeRate: form.chargeRate, notes: form.notes, onRateCard: form.onRateCard };
    const r = await api(form.id ? `/api/rentals/crew-rates/${form.id}` : `/api/spaces/${slug}/rentals/crew-rates`, form.id ? "PATCH" : "POST", body);
    setBusy(false);
    if (r) { setForm(null); await reload(); }
  }
  async function archive(r: CrewRateRow, archived: boolean) { if (await api(`/api/rentals/crew-rates/${r.id}`, "PATCH", { archived })) await reload(); }
  async function remove(r: CrewRateRow) {
    if (!(await confirmDialog(`Delete the ${r.role} rate? Crew jobs already set up keep their own pay and charge. This can't be undone.`, { danger: true, confirmLabel: "Delete" }))) return;
    if (await api(`/api/rentals/crew-rates/${r.id}`, "DELETE")) await reload();
  }

  const shown = rates.filter(r => showOld || !r.archived);
  const old = rates.filter(r => r.archived).length;
  const margin = (r: CrewRateRow) => (r.payRate != null && r.chargeRate != null && r.chargeRate > 0 ? Math.round(((r.chargeRate - r.payRate) / r.chargeRate) * 100) : null);

  return (
    <section style={card} className="flex flex-col gap-3 min-w-0" aria-label="Crew rates">
      <div className="flex justify-between gap-2 flex-wrap items-baseline">
        <h2 style={h2}>Crew rates</h2>
        {!form && <button type="button" className="text-sm font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={() => setForm(blank)}>+ Add a crew rate</button>}
      </div>
      <p className="text-xs" style={muted}>The usual pay and client charge for each role, ex VAT. Pick the role when you add a crew job to a hire and these fill in; you can still change them for that hire. Changing a rate here doesn&apos;t change jobs already set up.</p>

      {form && (
        <form onSubmit={save} className="flex flex-col gap-3 p-3" style={{ border: "2px solid var(--tws-char)" }} aria-label={form.id ? "Edit crew rate" : "Add a crew rate"}>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <div className="col-span-2"><label style={lbl} htmlFor="cr-role">Role</label><input id="cr-role" style={input} required maxLength={80} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Lighting technician" /></div>
            <div><label style={lbl} htmlFor="cr-unit">Priced</label><select id="cr-unit" style={input} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
              {Object.keys(RATE_UNIT).map(k => <option key={k} value={k}>{UNIT_OPTION[k]}</option>)}</select></div>
            {form.unit === "hour" && <div><label style={lbl} htmlFor="cr-hours">Usual hours</label><input id="cr-hours" style={input} inputMode="decimal" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} placeholder="e.g. 10" /></div>}
            <div><label style={lbl} htmlFor="cr-pay">Pay £ (each)</label><input id="cr-pay" style={input} inputMode="decimal" value={form.payRate} onChange={e => setForm({ ...form, payRate: e.target.value })} /></div>
            <div><label style={lbl} htmlFor="cr-charge">Charge the client £ (each)</label><input id="cr-charge" style={input} inputMode="decimal" value={form.chargeRate} onChange={e => setForm({ ...form, chargeRate: e.target.value })} /></div>
            <div className="col-span-2 sm:col-span-4"><label style={lbl} htmlFor="cr-notes">Note for the rate card (optional)</label><input id="cr-notes" style={input} maxLength={300} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. 10-hour day; overtime at the hourly rate" /></div>
          </div>
          <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={form.onRateCard} onChange={e => setForm({ ...form, onRateCard: e.target.checked })} /> Show the charge on the rate card clients see (never the pay)</label>
          <div className="flex gap-2"><button type="submit" style={btnSolid} disabled={busy}>{form.id ? "Save rate" : "Add rate"}</button><button type="button" style={btnLine} onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      {shown.length === 0 ? <p className="text-sm" style={muted}>No crew rates yet. Add the roles you usually supply, e.g. Lighting technician, Sound No.1, Stagehand.</p> : (
        <div className="overflow-x-auto"><table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead><tr>{["Role", "Pay", "Client charge", "Margin", "Rate card", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
          <tbody>{shown.map(r => (
            <tr key={r.id} style={r.archived ? { opacity: 0.6 } : undefined}>
              <td style={{ ...td, fontWeight: 600 }}>{r.role}{r.archived ? " (not in use)" : ""}{r.notes ? <span className="block text-xs font-normal" style={muted}>{r.notes}</span> : null}</td>
              <td style={td}>{rateLabel(r.payRate, r.unit, r.hours) ?? <span style={muted}>Not set</span>}</td>
              <td style={td}>{rateLabel(r.chargeRate, r.unit, r.hours) ?? <span style={muted}>Not set</span>}</td>
              <td style={td}>{margin(r) == null ? "—" : `${margin(r)}%`}</td>
              <td style={td}>{r.onRateCard && r.chargeRate != null && !r.archived ? "Shown" : <span style={muted}>Hidden</span>}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>
                <span className="flex gap-3 text-sm font-semibold" style={{ color: "var(--tws-accent-ink)" }}>
                  <button type="button" onClick={() => setForm({ id: r.id, role: r.role, unit: r.unit, hours: str(r.hours), payRate: str(r.payRate), chargeRate: str(r.chargeRate), notes: r.notes ?? "", onRateCard: r.onRateCard })}>Edit</button>
                  <button type="button" onClick={() => archive(r, !r.archived)}>{r.archived ? "Use again" : "Stop using"}</button>
                  <button type="button" onClick={() => remove(r)}>Delete</button>
                </span>
              </td>
            </tr>))}</tbody>
        </table></div>
      )}
      {old > 0 && <button type="button" className="self-start text-xs font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={() => setShowOld(!showOld)}>{showOld ? "Hide" : "Show"} {old} not in use</button>}
    </section>
  );
}
