"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";

type BudgetLine = { id: number; department: string; description: string };
type VariationItem = { id: number; budgetLineId: number; amount: number; note: string | null; budgetLine: BudgetLine };
type Variation = {
  id: number;
  type: string;
  status: string;
  title: string;
  justification: string | null;
  clientRef: string | null;
  notes: string | null;
  rejectionReason: string | null;
  requestedBy: { id: number; name: string } | null;
  requestedAt: string;
  approvedBy: { id: number; name: string } | null;
  approvedAt: string | null;
  items: VariationItem[];
};

const TYPE_LABELS: Record<string, string> = {
  reallocation: "Reallocation",
  additional_spend: "Additional Spend",
  saving: "Saving",
};

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  draft:            { label: "Draft",            color: "text-white/50",   bg: "bg-white/10" },
  pending_approval: { label: "Pending Approval", color: "text-yellow-300", bg: "bg-yellow-900/30" },
  approved:         { label: "Approved",         color: "text-green-300",  bg: "bg-green-900/30" },
  rejected:         { label: "Rejected",         color: "text-red-400",    bg: "bg-red-900/30" },
};



type ItemRow = { budgetLineId: string; amount: string; note: string };
const BLANK_ITEM: ItemRow = { budgetLineId: "", amount: "", note: "" };
const BLANK_FORM = { type: "reallocation", title: "", justification: "", clientRef: "", notes: "" };

export default function BudgetReallocationPanel({
  productionId,
  budgetLines,
  isAdmin,
  canApprove,
}: {
  productionId: number;
  budgetLines: BudgetLine[];
  isAdmin: boolean;
  canApprove?: boolean;
}) {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [items, setItems] = useState<ItemRow[]>([{ ...BLANK_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/budget-reallocation?productionId=${productionId}`).then(r => r.json());
    if (Array.isArray(data)) setVariations(data);
    setLoading(false);
  }, [productionId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads when the production changes; shows the loading state first
  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter(i => i.budgetLineId && i.amount);
    if (validItems.length === 0) return;
    setSaving(true);
    await fetch("/api/budget-reallocation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productionId,
        type: form.type,
        title: form.title,
        justification: form.justification,
        clientRef: form.clientRef,
        notes: form.notes,
        items: validItems.map(i => ({
          budgetLineId: Number(i.budgetLineId),
          amount: Number(i.amount),
          note: i.note || null,
        })),
      }),
    });
    setForm(BLANK_FORM);
    setItems([{ ...BLANK_ITEM }]);
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function updateStatus(id: number, status: string, extra: Record<string, string> = {}) {
    await fetch(`/api/budget-reallocation/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    });
    load();
  }

  async function deleteVariation(id: number) {
    if (!await confirmDialog("Delete this reallocation request?")) return;
    await fetch(`/api/budget-reallocation/${id}`, { method: "DELETE" });
    load();
  }

  function toggleExpanded(id: number) {
    setExpanded(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function exportCSV() {
    const rows: string[][] = [
      ["ID", "Type", "Status", "Title", "Justification", "Client Ref", "Requested By", "Requested At", "Approved By", "Approved At", "Budget Line", "Department", "Amount", "Note"],
    ];
    for (const v of variations) {
      for (const item of v.items) {
        rows.push([
          String(v.id),
          TYPE_LABELS[v.type] ?? v.type,
          STATUS_STYLES[v.status]?.label ?? v.status,
          v.title,
          v.justification ?? "",
          v.clientRef ?? "",
          v.requestedBy?.name ?? "",
          fmtDate(v.requestedAt),
          v.approvedBy?.name ?? "",
          v.approvedAt ? fmtDate(v.approvedAt) : "",
          item.budgetLine.description,
          item.budgetLine.department,
          String(item.amount),
          item.note ?? "",
        ]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-reallocation-${productionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
  const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

  const pending = variations.filter(v => v.status === "pending_approval").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Budget Reallocation</h3>
          {pending > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 font-medium">
              {pending} pending
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {variations.length > 0 && (
            <button onClick={exportCSV} className="text-xs border px-3 py-1.5 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowForm(v => !v)}
            className="text-xs px-3 py-1.5 rounded text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--psg-blue)" }}
          >
            + New Request
          </button>
        </div>
      </div>

      {/* New request form */}
      {showForm && (
        <div className="rounded-lg border p-4 space-y-4" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          <h4 className="text-sm font-semibold text-white">New Reallocation Request</h4>
          <form onSubmit={submit} className="space-y-3">
            <div className="flex gap-3">
              <select className={inp} style={inpStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="reallocation">Reallocation (move budget between lines)</option>
                <option value="additional_spend">Additional Spend (increase budget)</option>
                <option value="saving">Saving (reduce budget)</option>
              </select>
            </div>
            <input required className={inp} style={inpStyle} placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <textarea className={inp} style={inpStyle} placeholder="Justification / reason" rows={2} value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))} />
            <input className={inp} style={inpStyle} placeholder="Client reference / PO / approval email ref" value={form.clientRef} onChange={e => setForm(f => ({ ...f, clientRef: e.target.value }))} />

            {/* Line items */}
            <div>
              <p className="text-xs font-semibold mb-2 text-white/60 uppercase tracking-wider">Budget Line Adjustments</p>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <select
                      className={`${inp} flex-1`} style={inpStyle}
                      value={item.budgetLineId}
                      onChange={e => setItems(it => it.map((r, j) => j === i ? { ...r, budgetLineId: e.target.value } : r))}
                    >
                      <option value="">Select budget line…</option>
                      {(() => {
                        const depts: Record<string, BudgetLine[]> = {};
                        for (const l of budgetLines) { if (!depts[l.department]) depts[l.department] = []; depts[l.department].push(l); }
                        return Object.entries(depts).map(([dept, lines]) => (
                          <optgroup key={dept} label={dept}>
                            {lines.map(l => <option key={l.id} value={l.id}>{l.description}</option>)}
                          </optgroup>
                        ));
                      })()}
                    </select>
                    <input
                      type="number" step="0.01" placeholder="Amount (£)" style={inpStyle}
                      className="w-32 rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={item.amount}
                      onChange={e => setItems(it => it.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                    />
                    <input
                      placeholder="Note (optional)" style={inpStyle}
                      className="flex-1 rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={item.note}
                      onChange={e => setItems(it => it.map((r, j) => j === i ? { ...r, note: e.target.value } : r))}
                    />
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(it => it.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 text-lg leading-none px-1">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setItems(it => [...it, { ...BLANK_ITEM }])} className="mt-2 text-xs" style={{ color: "var(--psg-blue)" }}>
                + Add line
              </button>
              {form.type === "reallocation" && (
                <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
                  Tip: use negative amounts for lines losing budget, positive for lines gaining it.
                </p>
              )}
            </div>

            <textarea className={inp} style={inpStyle} placeholder="Internal notes (optional)" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded text-sm text-white font-medium disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>
                {saving ? "Saving…" : "Save as Draft"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded text-sm border hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading && <p className="text-sm py-4 text-center" style={{ color: "var(--psg-muted)" }}>Loading…</p>}
      {!loading && variations.length === 0 && (
        <p className="text-sm py-6 text-center" style={{ color: "var(--psg-muted)" }}>No reallocation requests yet.</p>
      )}
      {variations.map(v => {
        const st = STATUS_STYLES[v.status] ?? STATUS_STYLES.draft;
        const isExpanded = expanded.has(v.id);
        const netAmount = v.items.reduce((s, i) => s + i.amount, 0);
        return (
          <div key={v.id} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
            {/* Summary row */}
            <div
              className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors select-none"
              style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
              onClick={() => toggleExpanded(v.id)}
            >
              <span className="text-xs shrink-0" style={{ color: "var(--psg-muted)", transform: isExpanded ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▸</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">{v.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${st.bg} ${st.color}`}>{st.label}</span>
                  <span className="text-xs shrink-0 px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "var(--psg-muted)" }}>{TYPE_LABELS[v.type] ?? v.type}</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                  {v.requestedBy?.name ?? "Unknown"} · {fmtDate(v.requestedAt)}
                  {v.clientRef && <> · Ref: <span className="text-white/70">{v.clientRef}</span></>}
                </p>
              </div>
              <div className="text-sm font-semibold shrink-0" style={{ color: netAmount >= 0 ? "rgb(134,239,172)" : "rgb(248,113,113)" }}>
                {netAmount >= 0 ? "+" : ""}{fmt(netAmount)}
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                {/* Line items table */}
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--psg-card-border)" }}>
                      <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Budget Line</th>
                      <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Department</th>
                      <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Amount</th>
                      <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.items.map(item => (
                      <tr key={item.id} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                        <td className="px-4 py-2 text-white">{item.budgetLine.description}</td>
                        <td className="px-4 py-2" style={{ color: "var(--psg-muted)" }}>{item.budgetLine.department}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${item.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {item.amount >= 0 ? "+" : ""}{fmt(item.amount)}
                        </td>
                        <td className="px-4 py-2" style={{ color: "var(--psg-muted)" }}>{item.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Meta */}
                <div className="px-4 py-3 space-y-1 border-t" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                  {v.justification && <p className="text-xs" style={{ color: "var(--psg-muted)" }}><span className="text-white/60">Justification:</span> {v.justification}</p>}
                  {v.clientRef && <p className="text-xs" style={{ color: "var(--psg-muted)" }}><span className="text-white/60">Client ref:</span> {v.clientRef}</p>}
                  {v.notes && <p className="text-xs" style={{ color: "var(--psg-muted)" }}><span className="text-white/60">Notes:</span> {v.notes}</p>}
                  {v.approvedBy && <p className="text-xs" style={{ color: "var(--psg-muted)" }}><span className="text-white/60">Approved by:</span> {v.approvedBy.name} · {v.approvedAt ? fmtDate(v.approvedAt) : ""}</p>}
                  {v.rejectionReason && <p className="text-xs text-red-400"><span className="text-white/60">Rejection reason:</span> {v.rejectionReason}</p>}
                </div>

                {/* Rejection form */}
                {rejectingId === v.id && (
                  <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: "var(--psg-card-border)" }}>
                    <p className="text-xs font-semibold text-white">Reason for rejection</p>
                    <input className={inp} style={inpStyle} placeholder="Reason…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={() => { updateStatus(v.id, "rejected", { rejectionReason: rejectReason }); setRejectingId(null); setRejectReason(""); }} className="text-xs px-3 py-1.5 rounded bg-red-900/50 text-red-300 hover:bg-red-900/70 transition-colors">Confirm Reject</button>
                      <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="text-xs px-3 py-1.5 rounded hover:bg-white/5" style={{ color: "var(--psg-muted)" }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="px-4 py-2.5 border-t flex gap-2 flex-wrap" style={{ borderColor: "var(--psg-card-border)" }}>
                  {v.status === "draft" && (
                    <button onClick={() => updateStatus(v.id, "pending_approval")} className="text-xs border px-3 py-1.5 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "rgba(234,179,8,0.4)", color: "rgb(253,224,71)" }}>
                      Submit for Approval
                    </button>
                  )}
                  {v.status === "pending_approval" && (isAdmin || canApprove) && (
                    <>
                      <button onClick={() => updateStatus(v.id, "approved")} className="text-xs border px-3 py-1.5 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "rgba(74,222,128,0.4)", color: "rgb(74,222,128)" }}>
                        Approve
                      </button>
                      <button onClick={() => { setRejectingId(v.id); setRejectReason(""); }} className="text-xs border px-3 py-1.5 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "rgba(248,113,113,0.4)", color: "rgb(248,113,113)" }}>
                        Reject
                      </button>
                    </>
                  )}
                  {v.status === "draft" && (
                    <button onClick={() => deleteVariation(v.id)} className="text-xs text-red-400 hover:text-red-300 ml-auto">Delete</button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
