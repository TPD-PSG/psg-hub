"use client";

// Budget tab (PSG staff only): the production's PM fee and its payment stages, with when each
// was invoiced and paid. The Director forecast counts these as confirmed revenue.
import { useEffect, useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import { splitFee, type FeeStageRow } from "@/lib/feeStages";
import { fmtDate } from "@/lib/format";

type Fee = { pmFee: number | null; stages: FeeStageRow[]; deal: { id: number; title: string } | null };
type Row = { label: string; amount: string; dueDate: string; invoicedAt: string; paidAt: string };

const inp = "w-full rounded px-2 py-1.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const day = (s: string | null) => (s ? s.slice(0, 10) : "");
const today = () => new Date().toISOString().slice(0, 10);

export default function PmFeePanel({ productionId, startDate }: { productionId: number; startDate: string | null }) {
  const [fee, setFee] = useState<Fee | null>(null);
  const [failed, setFailed] = useState(false);
  const [edit, setEdit] = useState<{ pmFee: string; rows: Row[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/productions/${productionId}/fee`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setFee)
      .catch(() => setFailed(true));
  }, [productionId]);

  if (failed) return null; // not staff, or no budget access: the panel just isn't shown
  if (!fee) return null;

  const total = fee.stages.reduce((s, x) => s + x.amount, 0);
  const paid = fee.stages.filter(x => x.paidAt).reduce((s, x) => s + x.amount, 0);
  const invoiced = fee.stages.filter(x => x.invoicedAt && !x.paidAt).reduce((s, x) => s + x.amount, 0);

  function startEdit() {
    setEdit({
      pmFee: fee!.pmFee != null ? String(fee!.pmFee) : "",
      rows: fee!.stages.map(s => ({ label: s.label, amount: String(s.amount), dueDate: day(s.dueDate), invoicedAt: day(s.invoicedAt), paidAt: day(s.paidAt) })),
    });
  }
  const setRow = (i: number, patch: Partial<Row>) => setEdit(e => e && { ...e, rows: e.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    const res = await fetch(`/api/productions/${productionId}/fee`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pmFee: edit.pmFee, stages: edit.rows }),
    });
    setSaving(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(body.error ?? "Couldn't save the fee");
    setFee(body);
    setEdit(null);
  }

  const editTotal = edit ? edit.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0) : 0;

  return (
    <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-white text-sm">PM fee</h3>
          <p className="text-xs" style={{ color: "var(--psg-muted)" }}>
            PSG&apos;s fee for managing this show, in payment stages. Staff only.{fee.deal ? ` From the deal "${fee.deal.title}".` : ""}
          </p>
        </div>
        {!edit && (
          <button type="button" onClick={startEdit} className="text-xs border px-3 py-1.5 rounded hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            {fee.pmFee == null && fee.stages.length === 0 ? "+ Add PM fee" : "Edit"}
          </button>
        )}
      </div>

      {!edit && (fee.pmFee != null || fee.stages.length > 0) && (
        <>
          <div className="flex gap-6 flex-wrap text-sm">
            <span className="text-white">Fee {fee.pmFee != null ? gbp(fee.pmFee) : "—"}</span>
            <span style={{ color: "#4ade80" }}>Paid {gbp(paid)}</span>
            <span style={{ color: "#fbbf24" }}>Invoiced {gbp(invoiced)}</span>
            <span style={{ color: "var(--psg-muted)" }}>To invoice {gbp(Math.max(0, total - paid - invoiced))}</span>
            {fee.pmFee != null && Math.round(total) !== Math.round(fee.pmFee) && (
              <span style={{ color: "#fbbf24" }}>Stages add up to {gbp(total)}</span>
            )}
          </div>
          {fee.stages.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr style={{ color: "var(--psg-muted)" }}>
                <th className="text-left font-medium py-1">Stage</th><th className="text-right font-medium py-1">Amount</th>
                <th className="text-left font-medium py-1 pl-4">Due</th><th className="text-left font-medium py-1">Status</th>
              </tr></thead>
              <tbody>
                {fee.stages.map(s => (
                  <tr key={s.id} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="py-1.5 text-white">{s.label}</td>
                    <td className="py-1.5 text-right text-white">{gbp(s.amount)}</td>
                    <td className="py-1.5 pl-4" style={{ color: !s.paidAt && s.dueDate && s.dueDate.slice(0, 10) < today() ? "#f87171" : "var(--psg-muted)" }}>{s.dueDate ? fmtDate(s.dueDate) : "—"}</td>
                    <td className="py-1.5" style={{ color: s.paidAt ? "#4ade80" : s.invoicedAt ? "#fbbf24" : "var(--psg-muted)" }}>
                      {s.paidAt ? `Paid ${fmtDate(s.paidAt)}` : s.invoicedAt ? `Invoiced ${fmtDate(s.invoicedAt)}` : "Not invoiced"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {edit && (
        <form onSubmit={save} className="space-y-3">
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label htmlFor="pmfee-amount" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>PM fee (£)</label>
              <input id="pmfee-amount" type="number" min={0} className={inp} style={{ ...inpStyle, width: "10rem" }} value={edit.pmFee} onChange={e => setEdit({ ...edit, pmFee: e.target.value })} />
            </div>
            <button type="button" onClick={() => setEdit({ ...edit, rows: splitFee(Number(edit.pmFee) || 0, { today: today(), startDate: startDate?.slice(0, 10) ?? null }).map(s => ({ label: s.label, amount: String(s.amount), dueDate: s.dueDate ?? "", invoicedAt: "", paidAt: "" })) })}
              className="text-xs border px-3 py-2 rounded hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              Split 30/40/30
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead><tr style={{ color: "var(--psg-muted)" }}>
                <th className="text-left font-medium py-1 text-xs">Stage</th><th className="text-left font-medium py-1 text-xs">Amount</th>
                <th className="text-left font-medium py-1 text-xs">Due</th><th className="text-left font-medium py-1 text-xs">Invoiced</th>
                <th className="text-left font-medium py-1 text-xs">Paid</th><th />
              </tr></thead>
              <tbody>
                {edit.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="pr-2 py-1"><input aria-label="Stage name" required className={inp} style={inpStyle} value={r.label} onChange={e => setRow(i, { label: e.target.value })} /></td>
                    <td className="pr-2 py-1"><input aria-label={`${r.label} amount`} type="number" min={0} required className={inp} style={inpStyle} value={r.amount} onChange={e => setRow(i, { amount: e.target.value })} /></td>
                    <td className="pr-2 py-1"><input aria-label={`${r.label} due`} type="date" className={inp} style={inpStyle} value={r.dueDate} onChange={e => setRow(i, { dueDate: e.target.value })} /></td>
                    <td className="pr-2 py-1"><input aria-label={`${r.label} invoiced on`} type="date" className={inp} style={inpStyle} value={r.invoicedAt} onChange={e => setRow(i, { invoicedAt: e.target.value })} /></td>
                    <td className="pr-2 py-1"><input aria-label={`${r.label} paid on`} type="date" className={inp} style={inpStyle} value={r.paidAt} onChange={e => setRow(i, { paidAt: e.target.value })} /></td>
                    <td className="py-1"><button type="button" aria-label={`Remove ${r.label}`} onClick={() => setEdit({ ...edit, rows: edit.rows.filter((_, j) => j !== i) })} className="text-red-400 px-1">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button type="button" onClick={() => setEdit({ ...edit, rows: [...edit.rows, { label: "", amount: "", dueDate: "", invoicedAt: "", paidAt: "" }] })} className="text-xs text-blue-400">+ Add stage</button>
            <span className="text-xs" style={{ color: Math.round(editTotal) === Math.round(Number(edit.pmFee) || 0) ? "var(--psg-muted)" : "#fbbf24" }}>
              Stages total {gbp(editTotal)}
            </span>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="text-white px-4 py-1.5 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEdit(null)} className="border px-4 py-1.5 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
