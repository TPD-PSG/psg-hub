"use client";

// Add / edit one spend item on a budget line, with its quotes, purchase orders and invoices.
// Part of the Budget tab; mounted only while the modal is open, so its state starts fresh each time.

import { useState } from "react";
import { F, Modal, Btns, inp, inpStyle, sendJson, type Expense, type SpendDoc } from "../shared";

export const PHASES = ["Capitalisation", "running", "closing"];

const BLANK_EXPENSE = { phase: "Capitalisation", description: "", estimated: "", committed: "", spent: "", poNumber: "", paymentDue: "", issuedForPayment: false, vatExempt: false, supplier: "", notes: "", approvedBy: "", approvedDate: "", approvalMethod: "", isPSGExpense: false, paymentMethod: "" };

type PendingInvoice = { file: File; invoiceDate: string; invoiceAmount: string; invoiceNumber: string; issuedForPayment: boolean; extracting?: boolean };

function formFromExpense(exp: Expense): typeof BLANK_EXPENSE & { id?: number } {
  return {
    ...exp,
    id: exp.id,
    estimated: String(exp.estimated),
    committed: String(exp.committed),
    spent: String(exp.spent),
    poNumber: exp.poNumber ?? "",
    paymentDue: exp.paymentDue ? exp.paymentDue.slice(0, 10) : "",
    supplier: exp.supplier ?? "",
    notes: exp.notes ?? "",
    approvedBy: exp.approvedBy ?? "",
    approvedDate: exp.approvedDate ? exp.approvedDate.slice(0, 10) : "",
    approvalMethod: exp.approvalMethod ?? "",
    paymentMethod: exp.paymentMethod ?? "",
  };
}

export default function BudgetSpendModal({ lineId, expense, onClose, onSaved }: {
  lineId: number;
  expense: Expense | null; // null = new spend item
  onClose: () => void;
  onSaved: () => void;
}) {
  const [expenseForm, setExpenseForm] = useState(() => expense ? formFromExpense(expense) : BLANK_EXPENSE as typeof BLANK_EXPENSE & { id?: number });
  const [existingDocs, setExistingDocs] = useState<SpendDoc[]>(expense?.documents ?? []);
  const [pendingQuotes, setPendingQuotes] = useState<File[]>([]);
  const [pendingPO, setPendingPO] = useState<File[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [docsUploading, setDocsUploading] = useState(false);

  async function addInvoiceFiles(files: File[]) {
    const newItems: PendingInvoice[] = files.map(f => ({ file: f, invoiceDate: "", invoiceAmount: "", invoiceNumber: "", issuedForPayment: false, extracting: true }));
    setPendingInvoices(prev => [...prev, ...newItems]);
    for (const item of newItems) {
      try {
        const fd = new FormData(); fd.append("file", item.file);
        const res = await fetch("/api/extract-invoice", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          setPendingInvoices(prev => prev.map(x => x.file === item.file
            ? { ...x, extracting: false, invoiceDate: data.dueDate ?? x.invoiceDate, invoiceAmount: data.grossAmount != null ? String(data.grossAmount) : x.invoiceAmount, invoiceNumber: data.invoiceNumber ?? x.invoiceNumber }
            : x));
          if (data.supplier) setExpenseForm(f => f.supplier ? f : { ...f, supplier: data.supplier });
        } else {
          setPendingInvoices(prev => prev.map(x => x.file === item.file ? { ...x, extracting: false } : x));
        }
      } catch {
        setPendingInvoices(prev => prev.map(x => x.file === item.file ? { ...x, extracting: false } : x));
      }
    }
  }

  async function uploadPendingDocs(expenseId: number) {
    const upload = (file: File, type: string, extra: Record<string, string> = {}) => {
      const fd = new FormData(); fd.append("file", file); fd.append("type", type);
      for (const [k, v] of Object.entries(extra)) fd.append(k, v);
      return fetch(`/api/budget-expenses/${expenseId}/documents`, { method: "POST", body: fd }).then(() => {});
    };
    await Promise.all([
      ...pendingQuotes.map(f => upload(f, "quote")),
      ...pendingPO.map(f => upload(f, "po")),
      ...pendingInvoices.map(inv => upload(inv.file, "invoice", {
        ...(inv.invoiceDate ? { invoiceDate: inv.invoiceDate } : {}),
        ...(inv.invoiceAmount ? { invoiceAmount: inv.invoiceAmount } : {}),
        ...(inv.invoiceNumber ? { invoiceNumber: inv.invoiceNumber } : {}),
        issuedForPayment: String(inv.issuedForPayment),
      })),
    ]);
  }

  const existingInvoices = existingDocs.filter(d => d.type === "invoice");
  // Gross cost (spent) is the total of the invoices, saved and pending
  const grossFromInvoices = existingInvoices.reduce((s, d) => s + (d.invoiceAmount ?? 0), 0) + pendingInvoices.reduce((s, inv) => s + (Number(inv.invoiceAmount) || 0), 0);

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    setDocsUploading(true);
    const payload = { ...expenseForm, spent: grossFromInvoices };
    let expenseId: number;
    if (expenseForm.id) {
      await sendJson(`/api/budget-expenses/${expenseForm.id}`, "PUT", payload);
      expenseId = expenseForm.id;
    } else {
      const res = await sendJson(`/api/budget-lines/${lineId}/expenses`, "POST", payload);
      const data = await res.json();
      expenseId = data.id;
    }
    await uploadPendingDocs(expenseId);
    setDocsUploading(false);
    onSaved();
  }

  async function deleteSpendDoc(docId: number) {
    await fetch(`/api/spend-documents/${docId}`, { method: "DELETE" });
    setExistingDocs(d => d.filter(doc => doc.id !== docId));
  }

  async function patchSpendDoc(docId: number, patch: Partial<SpendDoc>) {
    const res = await sendJson(`/api/spend-documents/${docId}`, "PATCH", patch);
    const updated = await res.json();
    setExistingDocs(d => d.map(doc => doc.id === docId ? updated : doc));
  }

  const setPendingInvoice = (i: number, patch: Partial<PendingInvoice>) => setPendingInvoices(a => a.map((x, j) => j === i ? { ...x, ...patch } : x));

  return (
    <>
      <Modal title={expense ? "Edit Spend" : "Add Spend"} onClose={onClose}>
        <form onSubmit={saveExpense} className="space-y-4">
          {/* Core fields */}
          <F label="Phase">
            <select className={inp} style={inpStyle} value={expenseForm.phase} onChange={(e) => setExpenseForm((f) => ({ ...f, phase: e.target.value }))}>
              {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </F>
          <F label="Description *"><input required className={inp} style={inpStyle} value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} /></F>
          <F label="Supplier"><input className={inp} style={inpStyle} value={expenseForm.supplier} onChange={(e) => setExpenseForm((f) => ({ ...f, supplier: e.target.value }))} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="PM Budget (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={expenseForm.estimated} onChange={(e) => setExpenseForm((f) => ({ ...f, estimated: e.target.value }))} /></F>
            <F label="Net Cost (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={expenseForm.committed} onChange={(e) => setExpenseForm((f) => ({ ...f, committed: e.target.value }))} /></F>
          </div>
          <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={expenseForm.notes} onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))} /></F>

          {/* Quotes */}
          <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
            <SectionHead title="Quotes" onFiles={(files) => setPendingQuotes(q => [...q, ...files])} />
            <DropZone label="Drop quote files here" onFiles={(files) => setPendingQuotes(q => [...q, ...files])} />
            {existingDocs.filter(d => d.type === "quote").map(d => <SavedDocRow key={d.id} doc={d} onDelete={() => deleteSpendDoc(d.id)} />)}
            {pendingQuotes.map((f, i) => <PendingFileRow key={i} file={f} onRemove={() => setPendingQuotes(q => q.filter((_, j) => j !== i))} />)}
          </div>

          {/* Approval + PO Number */}
          <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Approval</span>
              <button type="button" onClick={() => setShowApprovalModal(true)} className="text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                {expenseForm.approvedBy ? "Edit" : "+ Add Approval"}
              </button>
            </div>
            {expenseForm.approvedBy ? (
              <div className="text-xs rounded px-2 py-1.5 space-y-0.5 mb-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <p className="text-white">Approved by: <span style={{ color: "var(--psg-muted)" }}>{expenseForm.approvedBy}</span></p>
                {expenseForm.approvedDate && <p className="text-white">Date: <span style={{ color: "var(--psg-muted)" }}>{expenseForm.approvedDate}</span></p>}
                {expenseForm.approvalMethod && <p className="text-white">Method: <span style={{ color: "var(--psg-muted)" }}>{expenseForm.approvalMethod}</span></p>}
              </div>
            ) : (
              <p className="text-xs mb-3" style={{ color: "var(--psg-muted)" }}>No approval recorded</p>
            )}
            <F label="PO Number"><input className={inp} style={inpStyle} value={expenseForm.poNumber} onChange={(e) => setExpenseForm((f) => ({ ...f, poNumber: e.target.value }))} /></F>
          </div>

          {/* PO Upload */}
          <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
            <SectionHead title="Purchase Order" onFiles={(files) => setPendingPO(p => [...p, ...files])} />
            <DropZone label="Drop PO files here" onFiles={(files) => setPendingPO(p => [...p, ...files])} />
            {existingDocs.filter(d => d.type === "po").map(d => <SavedDocRow key={d.id} doc={d} onDelete={() => deleteSpendDoc(d.id)} />)}
            {pendingPO.map((f, i) => <PendingFileRow key={i} file={f} onRemove={() => setPendingPO(p => p.filter((_, j) => j !== i))} />)}
          </div>

          {/* Invoices */}
          <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
            <SectionHead title="Invoices" accept="application/pdf,image/*" onFiles={addInvoiceFiles} />
            {/* Drag-and-drop zone */}
            <DropZone label="Drop PDF or image invoices here — data will be extracted automatically"
              accept={(f) => f.type === "application/pdf" || f.type.startsWith("image/")} onFiles={addInvoiceFiles} />
            {existingInvoices.map(d => (
              <div key={d.id} className="rounded p-2 mb-2 space-y-1.5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--psg-card-border)" }}>
                <div className="flex items-center justify-between">
                  <a href={`/api/spend-documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-xs truncate hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>{d.name}</a>
                  <button type="button" onClick={() => deleteSpendDoc(d.id)} className="ml-2 shrink-0 text-xs text-red-400 hover:text-red-300">×</button>
                </div>
                <InvoiceFields
                  number={d.invoiceNumber ?? ""} date={d.invoiceDate ? d.invoiceDate.slice(0, 10) : ""} amount={d.invoiceAmount ?? ""} issued={d.issuedForPayment}
                  onNumber={(v) => patchSpendDoc(d.id, { invoiceNumber: v || null })}
                  onDate={(v) => patchSpendDoc(d.id, { invoiceDate: v || null })}
                  onAmount={(v) => patchSpendDoc(d.id, { invoiceAmount: v ? Number(v) : null })}
                  onIssued={(v) => patchSpendDoc(d.id, { issuedForPayment: v })}
                />
              </div>
            ))}
            {pendingInvoices.map((inv, i) => (
              <div key={i} className="rounded p-2 mb-2 space-y-1.5" style={{ backgroundColor: inv.extracting ? "rgba(234,179,8,0.06)" : "rgba(59,130,246,0.06)", border: `1px solid ${inv.extracting ? "rgba(234,179,8,0.25)" : "rgba(59,130,246,0.2)"}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs truncate" style={{ color: inv.extracting ? "rgb(234,179,8)" : "rgb(147,197,253)" }}>
                    {inv.file.name}
                    {inv.extracting ? <span className="ml-1 opacity-70">— extracting data…</span> : <span className="ml-1 opacity-60">(pending)</span>}
                  </span>
                  <button type="button" onClick={() => setPendingInvoices(a => a.filter((_, j) => j !== i))} className="ml-2 shrink-0 text-xs text-red-400 hover:text-red-300">×</button>
                </div>
                <InvoiceFields
                  number={inv.invoiceNumber} date={inv.invoiceDate} amount={inv.invoiceAmount} issued={inv.issuedForPayment}
                  onNumber={(v) => setPendingInvoice(i, { invoiceNumber: v })}
                  onDate={(v) => setPendingInvoice(i, { invoiceDate: v })}
                  onAmount={(v) => setPendingInvoice(i, { invoiceAmount: v })}
                  onIssued={(v) => setPendingInvoice(i, { issuedForPayment: v })}
                />
              </div>
            ))}
            {(existingInvoices.length > 0 || pendingInvoices.length > 0) && (
              <div className="text-xs text-right pt-1 font-medium text-white/60">
                Gross Cost: £{grossFromInvoices.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>

          <Btns onCancel={onClose} label={docsUploading ? "Saving…" : expense ? "Save Changes" : "Add Spend"} />
        </form>
      </Modal>

      {/* Approval sub-modal */}
      {showApprovalModal && (
        <Modal title="Approval Details" onClose={() => setShowApprovalModal(false)}>
          <div className="space-y-3">
            <F label="Approved By"><input className={inp} style={inpStyle} value={expenseForm.approvedBy} onChange={(e) => setExpenseForm(f => ({ ...f, approvedBy: e.target.value }))} placeholder="Name or role" /></F>
            <F label="Approved Date"><input type="date" className={inp} style={inpStyle} value={expenseForm.approvedDate} onChange={(e) => setExpenseForm(f => ({ ...f, approvedDate: e.target.value }))} /></F>
            <F label="Approval Method"><input className={inp} style={inpStyle} value={expenseForm.approvalMethod} onChange={(e) => setExpenseForm(f => ({ ...f, approvalMethod: e.target.value }))} placeholder="e.g. Email, Board meeting, Verbal" /></F>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowApprovalModal(false)} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Done</button>
              {expenseForm.approvedBy && (
                <button type="button" onClick={() => { setExpenseForm(f => ({ ...f, approvedBy: "", approvedDate: "", approvalMethod: "" })); setShowApprovalModal(false); }} className="border px-4 py-2 rounded text-sm text-red-400 hover:bg-red-900/20" style={{ borderColor: "rgba(248,113,113,0.3)" }}>Clear</button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// Section title with a "+ Upload" file picker on the right
function SectionHead({ title, accept, onFiles }: { title: string; accept?: string; onFiles: (files: File[]) => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>{title}</span>
      <label className="cursor-pointer text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
        + Upload
        <input type="file" multiple className="hidden" accept={accept} onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) onFiles(files); e.target.value = ""; }} />
      </label>
    </div>
  );
}

function DropZone({ label, accept, onFiles }: { label: string; accept?: (f: File) => boolean; onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className="rounded border-2 border-dashed mb-3 py-4 text-center text-xs transition-colors"
      style={{ borderColor: over ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: over ? "rgba(59,130,246,0.08)" : "transparent", color: "var(--psg-muted)" }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const files = Array.from(e.dataTransfer.files).filter(f => !accept || accept(f)); if (files.length) onFiles(files); }}
    >
      {label}
    </div>
  );
}

function SavedDocRow({ doc, onDelete }: { doc: SpendDoc; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded text-xs mb-1" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
      <a href={`/api/spend-documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>{doc.name}</a>
      <button type="button" onClick={onDelete} className="ml-2 shrink-0 text-red-400 hover:text-red-300">×</button>
    </div>
  );
}

function PendingFileRow({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded text-xs mb-1" style={{ backgroundColor: "rgba(59,130,246,0.08)" }}>
      <span className="truncate text-blue-300">{file.name} <span style={{ color: "var(--psg-muted)" }}>(pending)</span></span>
      <button type="button" onClick={onRemove} className="ml-2 shrink-0 text-red-400 hover:text-red-300">×</button>
    </div>
  );
}

// Invoice number / due date / amount / issued fields, shared by saved and pending invoices
function InvoiceFields({ number, date, amount, issued, onNumber, onDate, onAmount, onIssued }: {
  number: string; date: string; amount: string | number; issued: boolean;
  onNumber: (v: string) => void; onDate: (v: string) => void; onAmount: (v: string) => void; onIssued: (v: boolean) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs mb-0.5" style={{ color: "var(--psg-muted)" }}>Invoice No.</p>
          <input type="text" placeholder="e.g. INV-001" className={inp + " text-xs py-1"} style={inpStyle} value={number} onChange={(e) => onNumber(e.target.value)} />
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: "var(--psg-muted)" }}>Payment Due Date</p>
          <input type="date" className={inp + " text-xs py-1"} style={inpStyle} value={date} onChange={(e) => onDate(e.target.value)} />
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: "var(--psg-muted)" }}>Gross Amount (£)</p>
          <input type="number" step="0.01" className={inp + " text-xs py-1"} style={inpStyle} value={amount} onChange={(e) => onAmount(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
        <input type="checkbox" checked={issued} onChange={(e) => onIssued(e.target.checked)} />
        Issued for Payment
      </label>
    </>
  );
}
