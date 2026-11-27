"use client";

// Hires: a hire starts as a quote (pencilled on availability, holds nothing), is confirmed (holds
// its kit from going out to coming back), goes out and comes back. While editing, each line shows
// what's free over the hire's dates, counting every other confirmed hire.
import { useEffect, useMemo, useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { hireDays, hireTotals } from "@/lib/rentals";
import { downloadHirePDF, hirePdfUrl, type HireForPdf } from "@/lib/hirePdf";
import { fmtDate } from "@/lib/format";
import { card, h2, muted, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";
import { RentalsHeader, Chip, api } from "@/components/rentals/shared";
import { gbp, day, todayIso, addDays, HIRE_TONE, HIRE_LABEL, type RentalsData, type HireRow } from "@/components/rentals/format";
import LineEditor, { type EditLine } from "@/components/rentals/LineEditor";

type Short = { productId: number; name: string; wanted: number; free: number; short: number };
type Full = HireRow & Omit<HireForPdf, "lines"> & { lines: (HireForPdf["lines"][number] & { productId: number })[]; shortages: Short[]; totals?: { net: number; gross: number };
  invoice: { id: number; status: string; reference: string | null; netAmount: number; vatAmount: number; dueDate: string | null } | null;
  subHires: SubHire[] };
type SubHire = { id: number; description: string; quantity: number; status: string; supplierName: string | null; cost: number | null; product: { id: number; name: string } | null };
const SUB_STATUS: Record<string, string> = { needed: "Needed", ordered: "Ordered", received: "Received", returned: "Sent back" };
type Charge = { description: string; quantity: string; unitPrice: string };
type Form = { id?: number; status: string; title: string; clientName: string; clientEmail: string; productionId: string; outDate: string; returnDate: string; notes: string; lines: EditLine[];
  chargeDays: string; discountPct: string; vatRate: string; paymentTerms: string; customerPo: string; delivery: string; deliveryTo: string; validUntil: string; terms: string; charges: Charge[] };
const str = (n: number | null | undefined) => (n == null ? "" : String(n));
const FILTERS = [["live", "Coming up & out"], ["quote", "Quotes"], ["done", "Returned"], ["cancelled", "Cancelled"], ["all", "All"]] as const;

export default function Hires({ initial, openId, startNew }: { initial: RentalsData; openId: number | null; startNew: boolean }) {
  const [data, setData] = useState(initial);
  const { space, products, packages, productions } = data;
  const S = `/api/spaces/${space.slug}/rentals`;
  const fresh = (): Form => ({ status: "quote", title: "", clientName: "", clientEmail: "", productionId: "", outDate: todayIso(), returnDate: addDays(todayIso(), 2), notes: "", lines: [],
    chargeDays: "", discountPct: "", vatRate: "20", paymentTerms: "", customerPo: "", delivery: "", deliveryTo: "", validUntil: addDays(todayIso(), 30), terms: "", charges: [] });
  const [form, setForm] = useState<Form | null>(startNew ? fresh() : null);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [free, setFree] = useState<Map<number, number> | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("live");
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState<Full | null>(null); // the hire as last saved (for its PDF and invoice)
  const [preview, setPreview] = useState<string | null>(null);
  const [subForm, setSubForm] = useState<{ productId: string; quantity: string; supplierName: string; cost: string } | null>(null);

  const reload = async () => { const d = await api<RentalsData>(S); if (d) setData(d); };
  const open = async (id: number) => {
    const h = await api<Full>(`/api/rentals/hires/${id}`);
    if (!h) return;
    loaded(h);
  };
  const loaded = (h: Full) => {
    setShorts(h.shortages); setFull(h);
    setForm({ id: h.id, status: h.status, title: h.title, clientName: h.clientName ?? "", clientEmail: h.clientEmail ?? "", productionId: h.productionId ? String(h.productionId) : "", outDate: h.outDate.slice(0, 10), returnDate: h.returnDate.slice(0, 10), notes: h.notes ?? "",
      lines: h.lines.map(l => ({ productId: l.productId, quantity: l.quantity, dayRate: l.dayRate, weekRate: l.weekRate ?? null, unitPrice: l.unitPrice ?? null, discountPct: l.discountPct ?? null, note: l.note })),
      chargeDays: str(h.chargeDays), discountPct: str(h.discountPct), vatRate: str(h.vatRate), paymentTerms: h.paymentTerms ?? "", customerPo: h.customerPo ?? "", delivery: h.delivery ?? "", deliveryTo: h.deliveryTo ?? "",
      validUntil: h.validUntil?.slice(0, 10) ?? "", terms: h.terms ?? "", charges: h.charges.map(c => ({ description: c.description, quantity: String(c.quantity), unitPrice: String(c.unitPrice) })) });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- opens the hire named in the link, once
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
  // The money as the form stands (the same rules the server and PDF use)
  const charged = form && form.chargeDays.trim() !== "" ? Math.max(0, Number(form.chargeDays) || 0) : days;
  const totals = form ? hireTotals({
    chargeDays: charged, outDate: form.outDate || todayIso(), returnDate: form.returnDate || todayIso(), discountPct: Number(form.discountPct) || null, vatRate: Number(form.vatRate) || 0,
    lines: form.lines.map(l => ({ quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, dayRate: l.dayRate !== undefined ? l.dayRate : products.find(p => p.id === l.productId)?.dayRate ?? null, weekRate: l.weekRate !== undefined ? l.weekRate : products.find(p => p.id === l.productId)?.weekRate ?? null })),
    charges: form.charges.map(c => ({ quantity: Number(c.quantity) || 0, unitPrice: Number(c.unitPrice) || 0 })),
  }) : null;
  const body = (f: Form) => ({ title: f.title, clientName: f.clientName, clientEmail: f.clientEmail, productionId: f.productionId || null, outDate: f.outDate, returnDate: f.returnDate, notes: f.notes,
    ...(["returned", "cancelled"].includes(f.status) ? {} : { lines: f.lines.filter(l => l.quantity > 0) }), chargeDays: f.chargeDays, discountPct: f.discountPct, vatRate: f.vatRate === "" ? 20 : f.vatRate, paymentTerms: f.paymentTerms, customerPo: f.customerPo,
    delivery: f.delivery, deliveryTo: f.deliveryTo, validUntil: f.validUntil, terms: f.terms,
    charges: f.charges.filter(c => c.description.trim()).map(c => ({ description: c.description, quantity: c.quantity || 1, unitPrice: c.unitPrice || 0 })) });

  async function save(status?: string, allowShort = false): Promise<boolean> {
    if (!form) return false;
    setBusy(true);
    const url = form.id ? `/api/rentals/hires/${form.id}` : `${S}/hires`;
    const r = await fetch(url, { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body(form), ...(status ? { status } : {}), ...(allowShort ? { allowShort: true } : {}) }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 409 && j.shortages) {
      setShorts(j.shortages);
      if (await confirmDialog(`${j.error}. Confirm anyway? You'll need to sub-hire the rest.`, { confirmLabel: "Confirm anyway" })) return save(status, true);
      return false;
    }
    if (!r.ok) { await alertDialog(j.error ?? "That didn't save. Try again."); return false; }
    loaded(j);
    await reload();
    return true;
  }
  async function confirmNew() {
    // New hire: save as a quote first, then confirm it (so the kit check runs against a saved hire)
    if (!form) return;
    if (!form.id) {
      setBusy(true);
      const created = await api<Full>(`${S}/hires`, "POST", body(form));
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
  // The PDF is made from the hire as saved, so save first
  async function pdf(show: boolean) {
    if (!form) return;
    if (!(await save())) return;
    const h = await api<Full>(`/api/rentals/hires/${form.id}`);
    if (!h) return;
    if (show) setPreview(await hirePdfUrl(h)); else await downloadHirePDF(h);
  }
  async function markSent() {
    if (!form?.id) return;
    const h = await api<Full>(`/api/rentals/hires/${form.id}`, "PATCH", { quoteSent: true });
    if (h) { loaded(h); reload(); }
  }
  async function invoice() {
    if (!form?.id) return;
    if (!(await save())) return;
    const h = await api<Full>(`/api/rentals/hires/${form.id}/invoice`, "POST");
    if (h) { loaded(h); reload(); await alertDialog(full?.invoice ? "The draft invoice in Finance now matches the hire." : `Draft invoice raised in Finance for ${gbp(h.totals?.net ?? 0)} + VAT. Check it there before it goes to the client.`); }
  }
  // Sub-hires save straight away; the hire's shortages are worked out again after each change
  async function refreshSubs() {
    if (!form?.id) return;
    const h = await api<Full>(`/api/rentals/hires/${form.id}`);
    if (h) { setFull(h); setShorts(h.shortages); }
  }
  async function addSub(e: React.FormEvent) {
    e.preventDefault();
    if (!form?.id || !subForm) return;
    if (await api(`/api/rentals/hires/${form.id}/subhires`, "POST", { productId: subForm.productId || null, description: subForm.productId ? undefined : "Sub-hire", quantity: subForm.quantity, supplierName: subForm.supplierName, cost: subForm.cost })) { setSubForm(null); refreshSubs(); }
  }
  async function subShort() {
    if (!form?.id) return;
    for (const s of shorts) await api(`/api/rentals/hires/${form.id}/subhires`, "POST", { productId: s.productId, quantity: s.short });
    refreshSubs();
  }
  async function subStatus(sh: SubHire, status: string) { if (await api(`/api/rentals/subhires/${sh.id}`, "PATCH", { status })) refreshSubs(); }
  async function subRemove(sh: SubHire) {
    if (!(await confirmDialog(`Remove the sub-hire of ${sh.quantity} × ${sh.product?.name ?? sh.description}?`, { confirmLabel: "Remove" }))) return;
    if (await api(`/api/rentals/subhires/${sh.id}`, "DELETE")) refreshSubs();
  }
  async function remove() {
    if (!form?.id) return;
    if (!(await confirmDialog(`Delete ${form.title}? This can't be undone.`, { danger: true, confirmLabel: "Delete" }))) return;
    if (await api(`/api/rentals/hires/${form.id}`, "DELETE")) { setForm(null); reload(); }
  }

  const closed = form && ["returned", "cancelled"].includes(form.status);
  const setCharge = (i: number, k: keyof Charge, v: string) => setForm({ ...form!, charges: form!.charges.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
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
                  <span className="text-xs" style={muted}>{day(h.outDate)} – {day(h.returnDate)} · {h.items} item{h.items === 1 ? "" : "s"}{h.clientName ? ` · ${h.clientName}` : ""}{h.production ? ` · ${h.production.name}` : ""}{h.net ? ` · ${gbp(h.net)} + VAT` : ""}{h.invoice ? " · invoiced" : ""}</span>
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

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <div><label style={lbl} htmlFor="h-days">Days charged</label><input id="h-days" style={input} inputMode="decimal" placeholder={String(days || "")} {...set("chargeDays")} /></div>
              <div><label style={lbl} htmlFor="h-disc">Hire discount %</label><input id="h-disc" style={input} inputMode="decimal" placeholder="0" {...set("discountPct")} /></div>
              <div><label style={lbl} htmlFor="h-vat">VAT %</label><input id="h-vat" style={input} inputMode="decimal" {...set("vatRate")} /></div>
              <div><label style={lbl} htmlFor="h-valid">Quote valid until</label><input id="h-valid" type="date" style={input} {...set("validUntil")} /></div>
            </div>
            <p className="text-xs" style={muted}>Each line costs its day rate for each day charged; with a week rate, every full week costs the week rate. Type a price in “£ each” to use your own price for the whole hire instead.</p>
            <fieldset disabled={!!closed} className="contents">
              <LineEditor products={products} packages={packages} lines={form.lines} free={closed ? null : free} pricing={{ days: charged }} onChange={lines => setForm({ ...form, lines })} label="Kit on this hire" />
            </fieldset>
            {shorts.length > 0 && (
              <div role="status" className="px-3 py-2 text-sm" style={{ background: "var(--tws-warn-bg)", border: "1px solid var(--tws-warn-line)", color: "var(--tws-warn-ink)" }}>
                <strong>Short for these dates:</strong> {shorts.map(s => `${s.name} (${s.short} more than the ${s.free} free)`).join("; ")}. Sub-hire the rest, or change the dates.
                {form.id && <button type="button" className="ml-2 font-semibold underline" onClick={subShort}>Sub-hire what&apos;s short</button>}
              </div>
            )}
            {form.id && (
              <div className="flex flex-col gap-2" aria-label="Sub-hires">
                <span className="text-sm font-semibold">Sub-hires <span className="font-normal" style={muted}>· kit hired in from elsewhere to cover what we&apos;re short of</span></span>
                {(full?.subHires ?? []).map(sh => (
                  <div key={sh.id} className="flex gap-2 items-center flex-wrap text-sm">
                    <span className="flex-1 min-w-[160px]"><strong>{sh.quantity} × {sh.product?.name ?? sh.description}</strong>{sh.supplierName ? ` from ${sh.supplierName}` : ""}{sh.cost != null ? ` · costs us ${gbp(sh.cost)}` : ""}</span>
                    <select aria-label="Sub-hire status" style={{ ...input, width: "auto", padding: "4px 6px" }} value={sh.status} onChange={e => subStatus(sh, e.target.value)}>
                      {Object.entries(SUB_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <button type="button" className="text-xs font-semibold" style={{ color: "var(--tws-bad-ink)" }} onClick={() => subRemove(sh)}>Remove</button>
                  </div>
                ))}
                {subForm ? (
                  <div className="flex gap-2 items-end flex-wrap p-3" style={{ background: "var(--tws-tint)" }}>
                    <div><label style={lbl} htmlFor="sh-p">Product</label><select id="sh-p" style={{ ...input, width: "auto" }} value={subForm.productId} onChange={e => setSubForm({ ...subForm, productId: e.target.value })}>
                      {[...new Set(form.lines.map(l => l.productId))].map(id => <option key={id} value={id}>{products.find(p => p.id === id)?.name}</option>)}</select></div>
                    <div><label style={lbl} htmlFor="sh-q">How many</label><input id="sh-q" style={{ ...input, width: 70 }} inputMode="numeric" value={subForm.quantity} onChange={e => setSubForm({ ...subForm, quantity: e.target.value })} /></div>
                    <div><label style={lbl} htmlFor="sh-s">From</label><input id="sh-s" style={{ ...input, width: 180 }} maxLength={120} value={subForm.supplierName} onChange={e => setSubForm({ ...subForm, supplierName: e.target.value })} placeholder="Supplier" /></div>
                    <div><label style={lbl} htmlFor="sh-c">Costs us £</label><input id="sh-c" style={{ ...input, width: 100 }} inputMode="decimal" value={subForm.cost} onChange={e => setSubForm({ ...subForm, cost: e.target.value })} /></div>
                    <button type="button" style={btnSolid} onClick={addSub}>Add</button><button type="button" style={btnLine} onClick={() => setSubForm(null)}>Cancel</button>
                  </div>
                ) : form.lines.length > 0 && <button type="button" className="self-start text-sm font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={() => setSubForm({ productId: String(form.lines[0].productId), quantity: "1", supplierName: "", cost: "" })}>+ Add a sub-hire</button>}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Other charges</span>
              {form.charges.map((c, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <input aria-label="Charge description" style={{ ...input, flex: 1, minWidth: 160 }} placeholder="e.g. Delivery and collection, Technician day" value={c.description} onChange={e => setCharge(i, "description", e.target.value)} />
                  <input aria-label="Charge quantity" style={{ ...input, width: 64 }} inputMode="decimal" value={c.quantity} onChange={e => setCharge(i, "quantity", e.target.value)} />
                  <label className="flex items-center gap-1 text-xs" style={muted}>£ each<input aria-label="Charge price each" style={{ ...input, width: 90 }} inputMode="decimal" value={c.unitPrice} onChange={e => setCharge(i, "unitPrice", e.target.value)} /></label>
                  <span className="text-sm font-bold w-20 text-right">{gbp((Number(c.quantity) || 0) * (Number(c.unitPrice) || 0))}</span>
                  <button type="button" onClick={() => setForm({ ...form, charges: form.charges.filter((_, j) => j !== i) })} className="text-xs font-semibold px-1" style={{ color: "var(--tws-bad-ink)" }}>Remove</button>
                </div>
              ))}
              <button type="button" className="self-start text-sm font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={() => setForm({ ...form, charges: [...form.charges, { description: "", quantity: "1", unitPrice: "" }] })}>+ Add a charge (transport, labour, damage…)</button>
            </div>

            {totals && (
              <dl className="self-end w-full max-w-xs text-sm flex flex-col gap-1" aria-label="Totals">
                {[["Kit", totals.kit + totals.lineDiscounts], totals.lineDiscounts ? ["Line discounts", -totals.lineDiscounts] : null, totals.hireDiscount ? [`Hire discount (${form.discountPct}%)`, -totals.hireDiscount] : null, totals.charges ? ["Other charges", totals.charges] : null, ["Subtotal", totals.net], [`VAT (${form.vatRate || 0}%)`, totals.vat]]
                  .filter((r): r is [string, number] => !!r).map(([k, v]) => <div key={k} className="flex justify-between"><dt style={muted}>{k}</dt><dd>{gbp(v)}</dd></div>)}
                <div className="flex justify-between pt-1 font-extrabold text-base" style={{ borderTop: "2px solid var(--tws-char)" }}><dt>Total</dt><dd>{gbp(totals.gross)}</dd></div>
              </dl>
            )}

            <details className="flex flex-col gap-3" open={!!(form.paymentTerms || form.customerPo || form.delivery || form.terms)}>
              <summary className="text-sm font-semibold cursor-pointer">On the quote: terms, delivery, PO</summary>
              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div><label style={lbl} htmlFor="h-pay">Payment terms</label><input id="h-pay" style={input} list="h-pay-list" maxLength={80} {...set("paymentTerms")} />
                  <datalist id="h-pay-list"><option value="In advance" /><option value="On collection" /><option value="30 days" /><option value="14 days" /><option value="50 / 50" /></datalist></div>
                <div><label style={lbl} htmlFor="h-po">Client&apos;s PO number</label><input id="h-po" style={input} maxLength={80} {...set("customerPo")} /></div>
                <div><label style={lbl} htmlFor="h-del">Delivery</label>
                  <select id="h-del" style={input} {...set("delivery")}><option value="">Not set</option><option value="collection">Client collects</option><option value="delivery">We deliver</option></select></div>
                {form.delivery === "delivery" && <div><label style={lbl} htmlFor="h-to">Deliver to</label><textarea id="h-to" style={input} rows={2} maxLength={500} {...set("deliveryTo")} /></div>}
                <div className="sm:col-span-2"><label style={lbl} htmlFor="h-terms">Terms on the PDF</label><textarea id="h-terms" style={input} rows={3} maxLength={4000} {...set("terms")} placeholder="e.g. Kit is the hirer's responsibility from collection until it's back with us. Damage and losses are charged at replacement cost." /></div>
              </div>
            </details>
            <div><label style={lbl} htmlFor="h-notes">Notes (just for us, never on the PDF)</label><textarea id="h-notes" style={input} rows={3} maxLength={4000} {...set("notes")} /></div>

            {form.id && (
              <div className="flex gap-x-4 gap-y-2 flex-wrap items-center text-sm p-3" style={{ background: "var(--tws-tint)" }}>
                {["confirmed", "out"].includes(form.status) && <a href={`/spaces/${space.slug}/warehouse?hire=${form.id}&mode=${form.status === "out" ? "in" : "out"}`} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }}>{form.status === "out" ? "Check in on Warehouse" : "Prep on Warehouse"}</a>}
                <button type="button" disabled={busy} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={() => pdf(true)}>Preview PDF</button>
                <button type="button" disabled={busy} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={() => pdf(false)}>Download {form.status === "quote" ? "quote" : "confirmation"} PDF</button>
                {form.status === "quote" && (full?.quoteSentAt
                  ? <span style={muted}>Sent {fmtDate(full.quoteSentAt)}</span>
                  : <button type="button" disabled={busy} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={markSent}>Mark quote as sent</button>)}
                {["confirmed", "out", "returned"].includes(form.status) && (full?.invoice
                  ? <span className="flex gap-2 items-center flex-wrap"><a href="/finance?tab=sales" className="font-semibold" style={{ color: "var(--tws-accent-ink)" }}>Invoice in Finance ({full.invoice.status})</a>
                      {full.invoice.status === "draft" && <button type="button" disabled={busy} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={invoice}>Update the draft invoice</button>}</span>
                  : <button type="button" disabled={busy} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={invoice}>Raise invoice</button>)}
              </div>
            )}

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
      {preview && (
        <div role="dialog" aria-modal="true" aria-label="PDF preview" className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="flex justify-end p-3"><button type="button" style={{ ...btnSolid, background: "#fff", color: "var(--tws-ink)" }} onClick={() => { URL.revokeObjectURL(preview); setPreview(null); }}>Close preview</button></div>
          <iframe title="PDF preview" src={preview} className="flex-1 mx-3 mb-3 bg-white" />
        </div>
      )}
    </>
  );
}
