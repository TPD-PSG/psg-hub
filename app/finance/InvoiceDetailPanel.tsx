// Finance invoice detail side panel.
import type { Dispatch, SetStateAction } from "react";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import type { Invoice } from "./financeTypes";
import { isOverdue } from "./financeTypes";

type Props = {
  selectedInv: Invoice;
  setSelectedInv: Dispatch<SetStateAction<Invoice | null>>;
  invStatuses: { key: string; label: string; color: string }[];
  setInvStatus: (inv: Invoice, status: string) => void;
  openEditInv: (inv: Invoice) => void;
  confirmDelete: number | null;
  setConfirmDelete: Dispatch<SetStateAction<number | null>>;
  delInv: (id: number) => void;
};

export default function InvoiceDetailPanel({ selectedInv, setSelectedInv, invStatuses, setInvStatus, openEditInv, confirmDelete, setConfirmDelete, delInv }: Props) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l shadow-2xl flex flex-col z-40" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        <div>
          <h2 className="font-semibold text-white">{selectedInv.party}</h2>
          {selectedInv.reference && <div className="text-xs font-mono mt-0.5" style={{ color: "var(--psg-muted)" }}>{selectedInv.reference}</div>}
        </div>
        <button onClick={() => setSelectedInv(null)} className="text-xl leading-none hover:text-white shrink-0" style={{ color: "var(--psg-muted)" }}>×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>Status</div>
          <div className="flex flex-wrap gap-1">
            {invStatuses.map(s => (
              <button key={s.key} onClick={() => setInvStatus(selectedInv, s.key)} className="px-3 py-1 rounded-full text-xs font-medium transition-colors" style={{ backgroundColor: selectedInv.status === s.key ? s.color : s.color + "22", color: selectedInv.status === s.key ? "#fff" : s.color }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg p-4 space-y-2 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex justify-between text-sm"><span style={{ color: "var(--psg-muted)" }}>Net</span><span className="text-white font-medium">{fmt(selectedInv.netAmount)}</span></div>
          {selectedInv.vatAmount > 0 && <div className="flex justify-between text-sm"><span style={{ color: "var(--psg-muted)" }}>VAT</span><span className="text-white">{fmt(selectedInv.vatAmount)}</span></div>}
          <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: "var(--psg-card-border)" }}>
            <span className="font-medium text-white">Total</span>
            <span className="font-bold text-white text-base">{fmt(selectedInv.netAmount + selectedInv.vatAmount)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Description</div><div className="text-sm text-white">{selectedInv.description}</div></div>
          {selectedInv.production && <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Production</div><div className="text-sm text-white">{selectedInv.production}</div></div>}
          {selectedInv.issueDate && <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Issue date</div><div className="text-sm text-white">{fmtDate(selectedInv.issueDate)}</div></div>}
          {selectedInv.dueDate && <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Due date</div><div className="text-sm" style={{ color: isOverdue(selectedInv.dueDate, selectedInv.status) ? "#ef4444" : "white" }}>{isOverdue(selectedInv.dueDate, selectedInv.status) && "⚠ "}{fmtDate(selectedInv.dueDate)}</div></div>}
        </div>
        {selectedInv.notes && <div><div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div><p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedInv.notes}</p></div>}
      </div>
      <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "var(--psg-card-border)" }}>
        <button onClick={() => openEditInv(selectedInv)} className="flex-1 border py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
        {selectedInv.status !== "paid" && <button onClick={() => setInvStatus(selectedInv, "paid")} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#10b981" }}>Mark Paid</button>}
        {confirmDelete === selectedInv.id ? (
          <><button onClick={() => delInv(selectedInv.id)} className="border py-2 px-3 rounded text-sm text-red-400" style={{ borderColor: "rgba(239,68,68,0.3)" }}>Yes, delete</button><button onClick={() => setConfirmDelete(null)} className="border py-2 px-3 rounded text-sm" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button></>
        ) : (
          <button onClick={() => setConfirmDelete(selectedInv.id)} className="border py-2 px-3 rounded text-sm text-red-400 hover:bg-red-900/20" style={{ borderColor: "rgba(239,68,68,0.3)" }}>Delete</button>
        )}
      </div>
    </div>
  );
}
