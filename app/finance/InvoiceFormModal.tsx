// Finance new/edit invoice form modal.
import type { Dispatch, SetStateAction } from "react";
import { BLANK_INV, PURCHASE_STATUSES, SALES_STATUSES, inp, inpStyle } from "./financeTypes";

type Props = {
  invForm: typeof BLANK_INV & { id?: number };
  setInvForm: Dispatch<SetStateAction<typeof BLANK_INV & { id?: number }>>;
  setShowForm: Dispatch<SetStateAction<boolean>>;
  saveInv: (e: React.FormEvent) => void;
};

export default function InvoiceFormModal({ invForm, setInvForm, setShowForm, saveInv }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl shadow-2xl w-full max-w-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
          <h2 className="font-semibold text-white">{invForm.id ? "Edit Invoice" : `New ${invForm.type === "sales" ? "Sales" : "Purchase"} Invoice`}</h2>
          <button onClick={() => setShowForm(false)} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
        </div>
        <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
          <form onSubmit={saveInv} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
                <select className={inp} style={inpStyle} value={invForm.type} onChange={e => setInvForm(f => ({ ...f, type: e.target.value, status: e.target.value === "sales" ? "draft" : "received" }))}>
                  <option value="sales">Sales Invoice</option>
                  <option value="purchase">Purchase Invoice</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Reference</label>
                <input className={inp} style={inpStyle} value={invForm.reference ?? ""} onChange={e => setInvForm(f => ({ ...f, reference: e.target.value }))} placeholder="INV-001" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{invForm.type === "sales" ? "Client" : "Supplier"} *</label>
              <input required className={inp} style={inpStyle} value={invForm.party ?? ""} onChange={e => setInvForm(f => ({ ...f, party: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Description *</label>
              <input required className={inp} style={inpStyle} value={invForm.description ?? ""} onChange={e => setInvForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Production</label>
              <input className={inp} style={inpStyle} value={invForm.production ?? ""} onChange={e => setInvForm(f => ({ ...f, production: e.target.value }))} placeholder="e.g. Curious Incident UK Tour" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Net Amount (£)</label>
                <input type="number" step="0.01" min="0" className={inp} style={inpStyle} value={invForm.netAmount ?? 0} onChange={e => setInvForm(f => ({ ...f, netAmount: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>VAT (£)</label>
                <input type="number" step="0.01" min="0" className={inp} style={inpStyle} value={invForm.vatAmount ?? 0} onChange={e => setInvForm(f => ({ ...f, vatAmount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Issue Date</label>
                <input type="date" className={inp} style={inpStyle} value={invForm.issueDate ?? ""} onChange={e => setInvForm(f => ({ ...f, issueDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Due Date</label>
                <input type="date" className={inp} style={inpStyle} value={invForm.dueDate ?? ""} onChange={e => setInvForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Status</label>
              <select className={inp} style={inpStyle} value={invForm.status ?? "draft"} onChange={e => setInvForm(f => ({ ...f, status: e.target.value }))}>
                {(invForm.type === "sales" ? SALES_STATUSES : PURCHASE_STATUSES).map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
              <textarea rows={2} className={inp} style={inpStyle} value={invForm.notes ?? ""} onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>{invForm.id ? "Save" : "Add Invoice"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
