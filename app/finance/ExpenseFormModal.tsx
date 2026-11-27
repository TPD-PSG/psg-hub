// Finance new/edit expense form modal.
import type { Dispatch, SetStateAction } from "react";
import type { Production } from "./financeTypes";
import { BLANK_EXP, EXPENSE_CATEGORIES, EXPENSE_STATUSES, PAYMENT_METHODS, cap, inp, inpStyle } from "./financeTypes";

type Props = {
  role: string;
  productions: Production[];
  expForm: typeof BLANK_EXP & { id?: number };
  setExpForm: Dispatch<SetStateAction<typeof BLANK_EXP & { id?: number }>>;
  setShowForm: Dispatch<SetStateAction<boolean>>;
  saveExp: (e: React.FormEvent) => void;
};

export default function ExpenseFormModal({ role, productions, expForm, setExpForm, setShowForm, saveExp }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl shadow-2xl w-full max-w-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
          <h2 className="font-semibold text-white">{expForm.id ? "Edit Expense" : "New Expense"}</h2>
          <button onClick={() => setShowForm(false)} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
        </div>
        <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
          <form onSubmit={saveExp} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Description *</label>
              <input required className={inp} style={inpStyle} value={expForm.description ?? ""} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Van hire for get-out" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Category</label>
                <select className={inp} style={inpStyle} value={expForm.category ?? "misc"} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{cap(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Production</label>
                <select className={inp} style={inpStyle} value={expForm.productionId ?? ""} onChange={e => setExpForm(f => ({ ...f, productionId: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">— None —</option>
                  {productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Supplier</label>
                <input className={inp} style={inpStyle} value={expForm.supplier ?? ""} onChange={e => setExpForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Reference / Receipt</label>
                <input className={inp} style={inpStyle} value={expForm.reference ?? ""} onChange={e => setExpForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Net Amount (£)</label>
                <input type="number" step="0.01" min="0" className={inp} style={inpStyle} value={expForm.netAmount ?? 0} onChange={e => setExpForm(f => ({ ...f, netAmount: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>VAT (£)</label>
                <input type="number" step="0.01" min="0" className={inp} style={inpStyle} value={expForm.vatAmount ?? 0} onChange={e => setExpForm(f => ({ ...f, vatAmount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Date</label>
                <input type="date" className={inp} style={inpStyle} value={expForm.date ?? ""} onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Payment Method</label>
                <select className={inp} style={inpStyle} value={expForm.paymentMethod ?? "to_pay"} onChange={e => setExpForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  {PAYMENT_METHODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            </div>
            {role === "admin" && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Status</label>
                <select className={inp} style={inpStyle} value={expForm.status ?? "pending"} onChange={e => setExpForm(f => ({ ...f, status: e.target.value }))}>
                  {EXPENSE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
              <textarea rows={2} className={inp} style={inpStyle} value={expForm.notes ?? ""} onChange={e => setExpForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>{expForm.id ? "Save" : "Add Expense"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
