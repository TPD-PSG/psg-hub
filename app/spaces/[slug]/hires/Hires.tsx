"use client";

// Hires: a hire starts as a quote (pencilled on availability, holds nothing), is confirmed (holds
// its kit from going out to coming back), goes out and comes back. While editing, each line shows
// what's free over the hire's dates, counting every other confirmed hire.
import { useEffect, useMemo, useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { hireDays } from "@/lib/rentals";
import { card, h2, muted, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";
import { RentalsHeader, Chip, api } from "@/components/rentals/shared";
import { gbp, day, todayIso, addDays, HIRE_TONE, HIRE_LABEL, type RentalsData, type HireRow } from "@/components/rentals/format";
import LineEditor, { type EditLine } from "@/components/rentals/LineEditor";

type Short = { productId: number; name: string; wanted: number; free: number; short: number };
type Full = HireRow & { lines: { productId: number; quantity: number; dayRate: number | null; note: string | null; product: { id: number; name: string } }[]; createdBy: { name: string } | null; shortages: Short[] };
type Form = { id?: number; status: string; title: string; clientName: string; clientEmail: string; productionId: string; outDate: string; returnDate: string; notes: string; lines: EditLine[] };
const FILTERS = [["live", "Coming up & out"], ["quote", "Quotes"], ["done", "Returned"], ["cancelled", "Cancelled"], ["all", "All"]] as const;

export default function Hires({ initial, openId, startNew }: { initial: RentalsData; openId: number | null; startNew: boolean }) {
  const [data, setData] = useState(initial);
  const { space, products, packages, productions } = data;
  const S = `/api/spaces/${space.slug}/rentals`;
  const fresh = (): Form => ({ status: "quote", title: "", clientName: "", clientEmail: "", productionId: "", outDate: todayIso(), returnDate: addDays(todayIso(), 2), notes: "", lines: [] });
  const [form, setForm] = useState<Form | null>(startNew ? fresh() : null);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [free, setFree] = useState<Map<number, number> | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("live");
  const [busy, setBusy] = useState(false);

  const reload = async () => { const d = await api<RentalsData>(S); if (d) setData(d); };
  const open = async (id: number) => {
    const h = await api<Full>(`/api/rentals/hires/${id}`);
    if (!h) return;
    setShorts(h.shortages);
    setForm({ id: h.id, status: h.status, title: h.title, clientName: h.clientName ?? "", clientEmail: h.clientEmail ?? "", productionId: h.productionId ? String(h.productionId) : "", outDate: h.outDate.slice(0, 10), returnDate: h.returnDate.slice(0, 10), notes: h.notes ?? "", lines: h.lines.map(l => ({ productId: l.productId, quantity: l.quantity, dayRate: l.dayRate, note: l.note })) });
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- opens the hire named in the link, once
  useEffect(() => { if (openId) open(openId); }, [openId]);

  // What's free over the form's dates (other hires only), refreshed as the dates change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- no dates, nothing to look up
    if (!form || !form.outDate || !form.returnDate || form.returnDate < form.outDate) { setFree(null); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`${S}/availability?from=${form.outDate}&to=${form.returnDate}${form.id ? `&exclude=${form.id}` : ""}`);
      if (!r.ok) return setFree(null);
      const j: { products: { id: number; free: number }[] } = await r.json();
      setFree(new Map(j.products.map(p => [p.id, p.free])));
    }, 250);
    return () => clearTimeout(t);
  }, [form?.outDate, form?.returnDate, form?.id, S]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => data.hires.filter(h =>
    filter === "all" ? true : filter === "live" ? ["confirmed", "out"].includes(h.status) : filter === "done" ? h.status === "returned" : h.status === filter), [data.hires, filter]);

  const days = form && form.outDate && form.returnDate && form.returnDate >= form.outDate ? hireDays(form.outDate, form.returnDate) : 0;
  const listValue = form ? form.lines.reduce((a, l) => a + (l.dayRate ?? products.find(p => p.id === l.productId)?.dayRate ?? 0) * l.quantity, 0) : 0;

  async function save(status?: string, allowShort = false): Promise<boolean> {
    if (!form) return false;
    setBusy(true);
    const body = { title: form.title, clientName: form.clientName, clientEmail: form.clientEmail, productionId: form.productionId || null, outDate: form.outDate, returnDate: form.returnDate, notes: form.notes,
      lines: form.lines.filter(l => l.quantity > 0), ...(status ? { status } : {}), ...(allowShort ? { allowShort: true } : {}) };
    const url = form.id ? `/api/rentals/hires/${form.id}` : `${S}/hires`;
    const r = await fetch(url, { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 409 && j.shortages) {
      setShorts(j.shortages);
      if (await confirmDialog(`${j.error}. Confirm anyway? You'll need to sub-hire the rest.`, { confirmLabel: "Confirm anyway" })) return save(status, true);
      return false;
    }
    if (!r.ok) { await alertDialog(j.error ?? "That didn't save. Try again."); return false; }
    setShorts(j.shortages ?? []);
    setForm(f => f && { ...f, id: j.id, status: j.status });
    await reload();
    return true;
  }
  async function confirmNew() {
    // New hire: save as a quote first, then confirm it (so the kit check runs against a saved hire)
    if (!form) return;
    if (!form.id) {
      setBusy(true);
      const created = await api<Full>(`${S}/hires`, "POST", { title: form.title, clientName: form.clientName, clientEmail: form.clientEmail, productionId: form.productionId || null, outDate: form.outDate, returnDate: form.returnDate, notes: form.notes, lines: form.lines.filter(l => l.quantity > 0) });
      setBusy(false);
      if (!created) return;
      form.id = created.id;
      setForm({ ...form, id: created.id });
    }
    await save("confirmed");
  }
  async function setStatus(status: string, ask?: string) {
    if (ask && !(await confirmDialog(ask))) return;
    await save(status);
  }
  async function remove() {
    if (!form?.id) return;
    if (!(await confirmDialog(`Delete ${form.title}? This can't be undone.`, { danger: true, confirmLabel: "Delete" }))) return;
    if (await api(`/api/rentals/hires/${form.id}`, "DELETE")) { setForm(null); reload(); }
  }

  const closed = form && ["returned", "cancelled"].includes(form.status);
  const set = (k: keyof Form) => ({ value: form![k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form!, [k]: e.target.value }) });

  return (
    <>
      <RentalsHeader space={space} title="Hires" line={`${data.hires.filter(h => h.status === "out").length} out · ${data.hires.filter(h => h.status === "confirmed").length} confirmed · ${data.hires.filter(h => h.status === "quote").length} quotes`}>
        <button type="button" style={btnSolid} disabled={!products.length} onClick={() => { setForm(fresh()); setShorts([]); }}>+ New hire</button>
      </RentalsHeader>
      <div className="px-4 sm:px-10 pt-6 pb-10 grid gap-6 xl:grid-cols-5 items-start">
        <section style={card} className="xl:col-span-2 flex flex-col gap-3 min-w-0" aria-label="Hires">
          <div className="flex flex-wrap gap-1.5">{FILTERS.map(([k, l]) => <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{l}</Chip>)}</div>
          {!products.length && <p className="text-sm" style={muted}>Add kit first, then hire it out.</p>}
          {products.length > 0 && shown.length === 0 && <p className="text-sm" style={muted}>{filter === "live" ? "Nothing confirmed or out. Quotes are under Quotes." : "None here."}</p>}
          <ul className="flex flex-col">
            {shown.map(h => (
              <li key={h.id}>
                <button type="button" onClick={() => open(h.id)} className="w-full text-left py-3 flex flex-col gap-1" style={{ borderBottom: "1px solid var(--tws-line)", background: form?.id === h.id ? "var(--tws-accent-light)" : undefined }}>
                  <span className="flex justify-between gap-2 items-center">
                    <span className="font-semibold min-w-0 truncate">{h.number} · {h.title}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 shrink-0" style={HIRE_TONE[h.status]}>{HIRE_LABEL[h.status]}</span>
                  </span>
                  <span className="text-xs" style={muted}>{day(h.outDate)} – {day(h.returnDate)} · {h.items} item{h.items === 1 ? "" : "s"}{h.clientName ? ` · ${h.clientName}` : ""}{h.production ? ` · ${h.production.name}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {form ? (
          <form onSubmit={e => { e.preventDefault(); save(); }} style={{ ...card, borderTop: "6px solid var(--tws-accent)" }} className="xl:col-span-3 flex flex-col gap-4 min-w-0" aria-label={form.id ? "Hire" : "New hire"}>
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <h2 style={h2}>{form.id ? (data.hires.find(h => h.id === form.id)?.number ?? "Hire") + " · " + form.title : "New hire"}</h2>
              {form.id && <span className="text-[11px] font-bold px-2 py-1" style={HIRE_TONE[form.status]}>{HIRE_LABEL[form.status]}</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label style={lbl} htmlFor="h-title">Name of the hire</label><input id="h-title" style={input} required maxLength={160} {...set("title")} placeholder="e.g. Lighting for the Lowry gala" /></div>
              <div><label style={lbl} htmlFor="h-client">Client</label><input id="h-client" style={input} maxLength={160} {...set("clientName")} /></div>
              <div><label style={lbl} htmlFor="h-email">Client email</label><input id="h-email" type="email" style={input} maxLength={160} {...set("clientEmail")} /></div>
              <div><label style={lbl} htmlFor="h-out">Goes out</label><input id="h-out" type="date" style={input} required {...set("outDate")} /></div>
              <div><label style={lbl} htmlFor="h-back">Comes back</label><input id="h-back" type="date" style={input} required min={form.outDate} {...set("returnDate")} /></div>
              <div className="sm:col-span-2"><label style={lbl} htmlFor="h-prod">For a PSG production (optional)</label>
                <select id="h-prod" style={input} {...set("productionId")}><option value="">None: outside hire</option>{productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <p className="text-sm" style={muted}>{days ? `${days} day${days === 1 ? "" : "s"} away, counting the day it goes and the day it\u2019s back.` : "The kit can\u2019t come back before it goes out."}</p>

            <LineEditor products={products} packages={packages} lines={form.lines} free={free} onChange={lines => setForm({ ...form, lines })} label="Kit on this hire" />
            {shorts.length > 0 && (
              <div role="status" className="px-3 py-2 text-sm" style={{ background: "var(--tws-warn-bg)", border: "1px solid var(--tws-warn-line)", color: "var(--tws-warn-ink)" }}>
                <strong>Short for these dates:</strong> {shorts.map(s => `${s.name} (${s.short} more than the ${s.free} free)`).join("; ")}. Sub-hire the rest, or change the dates.
              </div>
            )}
            <p className="text-sm"><strong>{gbp(listValue)}</strong> a day at list rates <span style={muted}>· pricing and the quote PDF come in the next stage</span></p>
            <div><label style={lbl} htmlFor="h-notes">Notes</label><textarea id="h-notes" style={input} rows={3} maxLength={4000} {...set("notes")} /></div>

            <div className="flex gap-2 flex-wrap items-center">
              {!closed && <button type="submit" disabled={busy} style={btnLine}>{form.id ? "Save" : "Save as quote"}</button>}
              {form.status === "quote" && <button type="button" disabled={busy || !form.lines.length} style={btnSolid} onClick={confirmNew}>Confirm hire</button>}
              {form.status === "confirmed" && <button type="button" disabled={busy} style={btnSolid} onClick={() => setStatus("out")}>Mark as out</button>}
              {form.status === "out" && <button type="button" disabled={busy} style={btnSolid} onClick={() => setStatus("returned", "Mark everything on this hire as back in?")}>Mark as returned</button>}
              {form.id && ["confirmed", "out"].includes(form.status) && <button type="button" disabled={busy} className="text-sm font-semibold px-2" style={{ color: "var(--tws-bad-ink)" }} onClick={() => setStatus("cancelled", "Cancel this hire? Its kit is freed up for other hires.")}>Cancel hire</button>}
              {form.id && closed && <button type="button" disabled={busy} style={btnLine} onClick={() => setStatus("quote", "Reopen this hire as a quote? It stops holding kit until it's confirmed again.")}>Reopen as quote</button>}
              {form.id && ["quote", "cancelled"].includes(form.status) && <button type="button" disabled={busy} className="text-sm font-semibold px-2" style={{ color: "var(--tws-bad-ink)" }} onClick={remove}>Delete</button>}
              <button type="button" className="text-sm px-2 ml-auto" style={muted} onClick={() => setForm(null)}>Close</button>
            </div>
          </form>
        ) : (
          <section style={card} className="xl:col-span-3"><p className="text-sm" style={muted}>Pick a hire, or start a new one. A new hire is a quote: it shows as pencilled on Availability but holds no kit until you confirm it.</p></section>
        )}
      </div>
    </>
  );
}
