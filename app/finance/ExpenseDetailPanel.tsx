// Finance expense detail side panel, including its invoices & receipts uploads.
import type { Dispatch, SetStateAction } from "react";
import UserAvatar from "@/components/UserAvatar";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import type { Expense } from "./financeTypes";
import { EXPENSE_STATUSES, PAYMENT_METHODS } from "./financeTypes";
import type { useExpenseDocs } from "./financeHooks";
import StatusBadge from "./StatusBadge";

type Props = ReturnType<typeof useExpenseDocs> & {
  role: string;
  selectedExp: Expense;
  setSelectedExp: Dispatch<SetStateAction<Expense | null>>;
  setExpStatus: (exp: Expense, status: string) => void;
  openEditExp: (exp: Expense) => void;
  confirmDelete: number | null;
  setConfirmDelete: Dispatch<SetStateAction<number | null>>;
  delExp: (id: number) => void;
};

export default function ExpenseDetailPanel({ role, selectedExp, setSelectedExp, setExpStatus, expDocs, setExpDocs, expDocUploading, setExpDocUploading, openEditExp, confirmDelete, setConfirmDelete, delExp }: Props) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l shadow-2xl flex flex-col z-40" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        <div>
          <h2 className="font-semibold text-white">{selectedExp.description}</h2>
          <div className="text-xs mt-0.5 capitalize" style={{ color: "var(--psg-muted)" }}>
            {selectedExp.category}{(selectedExp.productionLink?.name ?? selectedExp.production) ? ` · ${selectedExp.productionLink?.name ?? selectedExp.production}` : ""}
          </div>
        </div>
        <button onClick={() => setSelectedExp(null)} className="text-xl leading-none hover:text-white shrink-0" style={{ color: "var(--psg-muted)" }}>×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {role === "admin" && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>Status</div>
            <div className="flex flex-wrap gap-1">
              {EXPENSE_STATUSES.map(s => (
                <button key={s.key} onClick={() => setExpStatus(selectedExp, s.key)} className="px-3 py-1 rounded-full text-xs font-medium transition-colors" style={{ backgroundColor: selectedExp.status === s.key ? s.color : s.color + "22", color: selectedExp.status === s.key ? "#fff" : s.color }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {role !== "admin" && (
          <div className="flex items-center gap-2">
            <StatusBadge status={selectedExp.status} statuses={EXPENSE_STATUSES} />
            {selectedExp.status === "rejected" && <span className="text-xs text-red-400">Your expense was rejected.</span>}
          </div>
        )}
        <div className="rounded-lg p-4 space-y-2 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex justify-between text-sm"><span style={{ color: "var(--psg-muted)" }}>Net</span><span className="text-white font-medium">{fmt(selectedExp.netAmount)}</span></div>
          {selectedExp.vatAmount > 0 && <div className="flex justify-between text-sm"><span style={{ color: "var(--psg-muted)" }}>VAT</span><span className="text-white">{fmt(selectedExp.vatAmount)}</span></div>}
          <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: "var(--psg-card-border)" }}>
            <span className="font-medium text-white">Total</span>
            <span className="font-bold text-white text-base">{fmt(selectedExp.netAmount + selectedExp.vatAmount)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {selectedExp.submittedByUser && <div><div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Submitted by</div><div className="flex items-center gap-2"><UserAvatar name={selectedExp.submittedByUser.name} avatarUrl={selectedExp.submittedByUser.avatarUrl} size={24} /><span className="text-sm text-white">{selectedExp.submittedByUser.name}</span></div></div>}
          {selectedExp.supplier && <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Supplier</div><div className="text-sm text-white">{selectedExp.supplier}</div></div>}
          {selectedExp.date && <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Date</div><div className="text-sm text-white">{fmtDate(selectedExp.date)}</div></div>}
          <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Payment method</div><div className="text-sm text-white">{PAYMENT_METHODS.find(p => p.key === selectedExp.paymentMethod)?.label ?? selectedExp.paymentMethod}</div></div>
          {selectedExp.reference && <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Reference</div><div className="text-sm font-mono text-white">{selectedExp.reference}</div></div>}
        </div>
        {selectedExp.notes && <div><div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div><p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedExp.notes}</p></div>}

        {/* Documents */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>Invoices & Receipts</div>
          <div className="space-y-1 mb-3">
            {expDocs.length === 0 && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No documents uploaded yet.</p>}
            {expDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 rounded px-3 py-2 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
                <span className="text-xs px-1.5 py-0.5 rounded font-medium capitalize shrink-0" style={{ backgroundColor: doc.type === "invoice" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)", color: doc.type === "invoice" ? "#60a5fa" : "#10b981" }}>{doc.type}</span>
                <a href={`/api/expenses/${selectedExp.id}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="text-sm text-white hover:underline flex-1 truncate" title={doc.name}>{doc.name}</a>
                <button onClick={async () => { await fetch(`/api/expenses/${selectedExp.id}/documents/${doc.id}`, { method: "DELETE" }); setExpDocs(prev => prev.filter(d => d.id !== doc.id)); }} className="text-xs hover:text-red-400 shrink-0" style={{ color: "var(--psg-muted)" }}>✕</button>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <select
              id={`doctype-${selectedExp.id}`}
              defaultValue="receipt"
              className="rounded px-2 py-1 text-xs border focus:outline-none shrink-0"
              style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
              onClick={e => e.stopPropagation()}
            >
              <option value="invoice">Invoice</option>
              <option value="receipt">Receipt</option>
              <option value="other">Other</option>
            </select>
            <span className="flex-1 text-center border rounded px-3 py-1.5 text-xs cursor-pointer hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: expDocUploading ? "var(--psg-muted)" : "var(--psg-blue)" }}>
              {expDocUploading ? "Uploading…" : "+ Upload document"}
            </span>
            <input type="file" accept="image/*,application/pdf" className="hidden" disabled={expDocUploading}
              onChange={async (ev) => {
                const file = ev.target.files?.[0]; if (!file) return;
                setExpDocUploading(true);
                const sel = document.getElementById(`doctype-${selectedExp.id}`) as HTMLSelectElement;
                const fd = new FormData(); fd.append("file", file); fd.append("type", sel?.value ?? "receipt");
                const res = await fetch(`/api/expenses/${selectedExp.id}/documents`, { method: "POST", body: fd });
                if (res.ok) { const doc = await res.json(); setExpDocs(prev => [...prev, doc]); }
                setExpDocUploading(false); ev.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "var(--psg-card-border)" }}>
        {(role === "admin" || selectedExp.status === "pending") && (
          <button onClick={() => openEditExp(selectedExp)} className="flex-1 border py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
        )}
        {role === "admin" && selectedExp.status === "pending" && <button onClick={() => setExpStatus(selectedExp, "approved")} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#3b82f6" }}>Approve</button>}
        {role === "admin" && selectedExp.status === "approved" && <button onClick={() => setExpStatus(selectedExp, "paid")} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#10b981" }}>Mark Paid</button>}
        {confirmDelete === selectedExp.id ? (
          <><button onClick={() => delExp(selectedExp.id)} className="border py-2 px-3 rounded text-sm text-red-400" style={{ borderColor: "rgba(239,68,68,0.3)" }}>Yes, delete</button><button onClick={() => setConfirmDelete(null)} className="border py-2 px-3 rounded text-sm" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button></>
        ) : (
          (role === "admin" || selectedExp.status === "pending") && (
            <button onClick={() => setConfirmDelete(selectedExp.id)} className="border py-2 px-3 rounded text-sm text-red-400 hover:bg-red-900/20" style={{ borderColor: "rgba(239,68,68,0.3)" }}>Delete</button>
          )
        )}
      </div>
    </div>
  );
}
