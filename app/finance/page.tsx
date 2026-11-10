"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Invoice = {
  id: number;
  type: string;
  reference: string | null;
  description: string;
  party: string;
  production: string | null;
  netAmount: number;
  vatAmount: number;
  issueDate: string | null;
  dueDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

type Expense = {
  id: number;
  production: string | null;
  category: string;
  description: string;
  supplier: string | null;
  netAmount: number;
  vatAmount: number;
  date: string | null;
  paymentMethod: string | null;
  status: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
};

const SALES_STATUSES = [
  { key: "draft",    label: "Draft",    color: "#6b7280" },
  { key: "sent",     label: "Sent",     color: "#3b82f6" },
  { key: "overdue",  label: "Overdue",  color: "#ef4444" },
  { key: "paid",     label: "Paid",     color: "#10b981" },
];
const PURCHASE_STATUSES = [
  { key: "received", label: "Received", color: "#6b7280" },
  { key: "overdue",  label: "Overdue",  color: "#ef4444" },
  { key: "paid",     label: "Paid",     color: "#10b981" },
];
const EXPENSE_STATUSES = [
  { key: "pending",  label: "Pending",  color: "#6b7280" },
  { key: "approved", label: "Approved", color: "#3b82f6" },
  { key: "paid",     label: "Paid",     color: "#10b981" },
];
const EXPENSE_CATEGORIES = [
  "travel", "accommodation", "marketing", "props", "costume", "set", "equipment", "catering", "venue", "misc",
];
const PAYMENT_METHODS = [
  { key: "to_pay",   label: "To Pay" },
  { key: "card",     label: "Card" },
  { key: "cash",     label: "Cash" },
  { key: "transfer", label: "Transfer" },
];

const BLANK_INV: Partial<Invoice> & { type: string } = {
  type: "sales", reference: "", description: "", party: "", production: "",
  netAmount: 0, vatAmount: 0, issueDate: "", dueDate: "", status: "draft", notes: "",
};
const BLANK_EXP: Partial<Expense> = {
  production: "", category: "misc", description: "", supplier: "",
  netAmount: 0, vatAmount: 0, date: "", paymentMethod: "to_pay", status: "pending", reference: "", notes: "",
};

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function isOverdue(s: string | null, status: string) {
  if (!s || status === "paid") return false;
  return new Date(s) < new Date();
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function StatusBadge({ status, statuses }: { status: string; statuses: { key: string; label: string; color: string }[] }) {
  const s = statuses.find(x => x.key === status) ?? { label: status, color: "#6b7280" };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: s.color + "22", color: s.color }}>
      {s.label}
    </span>
  );
}

function FinancePageInner() {
  const searchParams = useSearchParams();
  const initTab = searchParams.get("tab") === "purchase" ? "purchase" : searchParams.get("tab") === "expenses" ? "expenses" : "sales";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<"sales" | "purchase" | "expenses">(initTab as "sales" | "purchase" | "expenses");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [invForm, setInvForm] = useState<typeof BLANK_INV & { id?: number }>(BLANK_INV);
  const [expForm, setExpForm] = useState<typeof BLANK_EXP & { id?: number }>(BLANK_EXP);
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [selectedExp, setSelectedExp] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => { reloadAll(); }, []);

  async function reloadAll() {
    const [invData, expData] = await Promise.all([
      fetch("/api/invoices").then(r => r.json()),
      fetch("/api/expenses").then(r => r.json()),
    ]);
    if (Array.isArray(invData)) {
      setInvoices(invData);
      if (selectedInv) {
        const fresh = invData.find((x: Invoice) => x.id === selectedInv.id);
        if (fresh) setSelectedInv(fresh);
      }
    }
    if (Array.isArray(expData)) {
      setExpenses(expData);
      if (selectedExp) {
        const fresh = expData.find((x: Expense) => x.id === selectedExp.id);
        if (fresh) setSelectedExp(fresh);
      }
    }
  }

  // Invoice CRUD
  async function saveInv(e: React.FormEvent) {
    e.preventDefault();
    if (invForm.id) {
      await fetch(`/api/invoices/${invForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(invForm) });
    } else {
      await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(invForm) });
    }
    setShowForm(false);
    setInvForm({ ...BLANK_INV, type: tab === "purchase" ? "purchase" : "sales" });
    reloadAll();
  }
  async function delInv(id: number) {
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (selectedInv?.id === id) setSelectedInv(null);
    setConfirmDelete(null);
    reloadAll();
  }
  async function setInvStatus(inv: Invoice, status: string) {
    await fetch(`/api/invoices/${inv.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    reloadAll();
  }

  // Expense CRUD
  async function saveExp(e: React.FormEvent) {
    e.preventDefault();
    if (expForm.id) {
      await fetch(`/api/expenses/${expForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(expForm) });
    } else {
      await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(expForm) });
    }
    setShowForm(false);
    setExpForm({ ...BLANK_EXP });
    reloadAll();
  }
  async function delExp(id: number) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (selectedExp?.id === id) setSelectedExp(null);
    setConfirmDelete(null);
    reloadAll();
  }
  async function setExpStatus(exp: Expense, status: string) {
    await fetch(`/api/expenses/${exp.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    reloadAll();
  }

  function openNew() {
    if (tab === "expenses") {
      setExpForm({ ...BLANK_EXP });
    } else {
      setInvForm({ ...BLANK_INV, type: tab, status: tab === "sales" ? "draft" : "received" });
    }
    setShowForm(true);
  }

  function openEditInv(inv: Invoice) {
    setInvForm({
      id: inv.id, type: inv.type, reference: inv.reference ?? "", description: inv.description,
      party: inv.party, production: inv.production ?? "",
      netAmount: inv.netAmount, vatAmount: inv.vatAmount,
      issueDate: inv.issueDate ? inv.issueDate.slice(0, 10) : "",
      dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "",
      status: inv.status, notes: inv.notes ?? "",
    });
    setShowForm(true);
  }

  function openEditExp(exp: Expense) {
    setExpForm({
      id: exp.id, production: exp.production ?? "", category: exp.category,
      description: exp.description, supplier: exp.supplier ?? "",
      netAmount: exp.netAmount, vatAmount: exp.vatAmount,
      date: exp.date ? exp.date.slice(0, 10) : "",
      paymentMethod: exp.paymentMethod ?? "to_pay",
      status: exp.status, reference: exp.reference ?? "", notes: exp.notes ?? "",
    });
    setShowForm(true);
  }

  function switchTab(t: "sales" | "purchase" | "expenses") {
    setTab(t);
    setFilterStatus("all");
    setSelectedInv(null);
    setSelectedExp(null);
  }

  const visibleInv = invoices
    .filter(i => i.type === tab)
    .filter(i => filterStatus === "all" || i.status === filterStatus);

  const visibleExp = expenses
    .filter(i => filterStatus === "all" || i.status === filterStatus);

  const invStatuses = tab === "sales" ? SALES_STATUSES : PURCHASE_STATUSES;

  const outstanding = invoices.filter(i => i.type === "sales" && i.status !== "paid").reduce((s, i) => s + i.netAmount + i.vatAmount, 0);
  const owed = invoices.filter(i => i.type === "purchase" && i.status !== "paid").reduce((s, i) => s + i.netAmount + i.vatAmount, 0);
  const expTotal = expenses.filter(e => e.status !== "paid").reduce((s, e) => s + e.netAmount + e.vatAmount, 0);
  const overdueCount = invoices.filter(i => i.status !== "paid" && isOverdue(i.dueDate, i.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Finance</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
            {fmt(outstanding)} outstanding · {fmt(owed)} to pay · {fmt(expTotal)} in expenses
            {overdueCount > 0 && <span className="ml-2 text-red-400">{overdueCount} overdue</span>}
          </p>
        </div>
        <button onClick={openNew} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
          + {tab === "sales" ? "Sales Invoice" : tab === "purchase" ? "Purchase Invoice" : "Expense"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
          {(["sales", "purchase", "expenses"] as const).map(t => (
            <button key={t} onClick={() => switchTab(t)} className="px-4 py-1.5 text-sm transition-colors" style={{ backgroundColor: tab === t ? "var(--psg-blue)" : "transparent", color: tab === t ? "#fff" : "var(--psg-muted)" }}>
              {t === "sales" ? "Sales Invoices" : t === "purchase" ? "Purchase Invoices" : "Expenses"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterStatus("all")} className="px-3 py-1 rounded text-xs transition-colors" style={{ backgroundColor: filterStatus === "all" ? "rgba(255,255,255,0.1)" : "transparent", color: "var(--psg-muted)" }}>All</button>
          {(tab === "expenses" ? EXPENSE_STATUSES : invStatuses).map(s => (
            <button key={s.key} onClick={() => setFilterStatus(s.key)} className="px-3 py-1 rounded text-xs transition-colors" style={{ backgroundColor: filterStatus === s.key ? s.color + "33" : "transparent", color: filterStatus === s.key ? s.color : "var(--psg-muted)" }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      {tab !== "expenses" && (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3 text-left font-medium text-white">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-white">{tab === "sales" ? "Client" : "Supplier"}</th>
                <th className="px-4 py-3 text-left font-medium text-white">Description</th>
                <th className="px-4 py-3 text-left font-medium text-white">Production</th>
                <th className="px-4 py-3 text-right font-medium text-white">Net</th>
                <th className="px-4 py-3 text-right font-medium text-white">VAT</th>
                <th className="px-4 py-3 text-right font-medium text-white">Total</th>
                <th className="px-4 py-3 text-left font-medium text-white">Due</th>
                <th className="px-4 py-3 text-left font-medium text-white">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleInv.map(inv => {
                const overdue = isOverdue(inv.dueDate, inv.status);
                return (
                  <tr key={inv.id} onClick={() => { setSelectedInv(inv); setSelectedExp(null); }} className="border-t hover:bg-white/5 transition-colors cursor-pointer group" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--psg-muted)" }}>{inv.reference || "—"}</td>
                    <td className="px-4 py-3 font-medium text-white">{inv.party}</td>
                    <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{inv.description}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{inv.production || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">{fmt(inv.netAmount)}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: "var(--psg-muted)" }}>{inv.vatAmount > 0 ? fmt(inv.vatAmount) : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">{fmt(inv.netAmount + inv.vatAmount)}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: overdue ? "#ef4444" : "var(--psg-muted)" }}>{overdue && "⚠ "}{fmtDate(inv.dueDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} statuses={invStatuses} /></td>
                    <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-3 items-center">
                        <button onClick={() => openEditInv(inv)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                        {confirmDelete === inv.id ? (
                          <><button onClick={() => delInv(inv.id)} className="text-xs text-red-400 hover:text-red-300">Yes</button><button onClick={() => setConfirmDelete(null)} className="text-xs" style={{ color: "var(--psg-muted)" }}>No</button></>
                        ) : (
                          <button onClick={() => setConfirmDelete(inv.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleInv.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No {tab === "sales" ? "sales invoices" : "purchase invoices"} yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Expenses Table */}
      {tab === "expenses" && (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3 text-left font-medium text-white">Date</th>
                <th className="px-4 py-3 text-left font-medium text-white">Production</th>
                <th className="px-4 py-3 text-left font-medium text-white">Category</th>
                <th className="px-4 py-3 text-left font-medium text-white">Description</th>
                <th className="px-4 py-3 text-left font-medium text-white">Supplier</th>
                <th className="px-4 py-3 text-right font-medium text-white">Net</th>
                <th className="px-4 py-3 text-right font-medium text-white">VAT</th>
                <th className="px-4 py-3 text-right font-medium text-white">Total</th>
                <th className="px-4 py-3 text-left font-medium text-white">Payment</th>
                <th className="px-4 py-3 text-left font-medium text-white">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleExp.map(exp => (
                <tr key={exp.id} onClick={() => { setSelectedExp(exp); setSelectedInv(null); }} className="border-t hover:bg-white/5 transition-colors cursor-pointer group" style={{ borderColor: "var(--psg-card-border)" }}>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{fmtDate(exp.date)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{exp.production || "—"}</td>
                  <td className="px-4 py-3 text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{exp.category}</td>
                  <td className="px-4 py-3 font-medium text-white">{exp.description}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{exp.supplier || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-white">{fmt(exp.netAmount)}</td>
                  <td className="px-4 py-3 text-right text-xs" style={{ color: "var(--psg-muted)" }}>{exp.vatAmount > 0 ? fmt(exp.vatAmount) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-white">{fmt(exp.netAmount + exp.vatAmount)}</td>
                  <td className="px-4 py-3 text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{PAYMENT_METHODS.find(p => p.key === exp.paymentMethod)?.label ?? exp.paymentMethod}</td>
                  <td className="px-4 py-3"><StatusBadge status={exp.status} statuses={EXPENSE_STATUSES} /></td>
                  <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-3 items-center">
                      <button onClick={() => openEditExp(exp)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                      {confirmDelete === exp.id ? (
                        <><button onClick={() => delExp(exp.id)} className="text-xs text-red-400 hover:text-red-300">Yes</button><button onClick={() => setConfirmDelete(null)} className="text-xs" style={{ color: "var(--psg-muted)" }}>No</button></>
                      ) : (
                        <button onClick={() => setConfirmDelete(exp.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleExp.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No expenses yet — add one to get started</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice detail panel */}
      {selectedInv && (
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
      )}

      {/* Expense detail panel */}
      {selectedExp && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md border-l shadow-2xl flex flex-col z-40" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            <div>
              <h2 className="font-semibold text-white">{selectedExp.description}</h2>
              <div className="text-xs mt-0.5 capitalize" style={{ color: "var(--psg-muted)" }}>{selectedExp.category}{selectedExp.production ? ` · ${selectedExp.production}` : ""}</div>
            </div>
            <button onClick={() => setSelectedExp(null)} className="text-xl leading-none hover:text-white shrink-0" style={{ color: "var(--psg-muted)" }}>×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
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
            <div className="rounded-lg p-4 space-y-2 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
              <div className="flex justify-between text-sm"><span style={{ color: "var(--psg-muted)" }}>Net</span><span className="text-white font-medium">{fmt(selectedExp.netAmount)}</span></div>
              {selectedExp.vatAmount > 0 && <div className="flex justify-between text-sm"><span style={{ color: "var(--psg-muted)" }}>VAT</span><span className="text-white">{fmt(selectedExp.vatAmount)}</span></div>}
              <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: "var(--psg-card-border)" }}>
                <span className="font-medium text-white">Total</span>
                <span className="font-bold text-white text-base">{fmt(selectedExp.netAmount + selectedExp.vatAmount)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {selectedExp.supplier && <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Supplier</div><div className="text-sm text-white">{selectedExp.supplier}</div></div>}
              {selectedExp.date && <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Date</div><div className="text-sm text-white">{fmtDate(selectedExp.date)}</div></div>}
              <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Payment method</div><div className="text-sm text-white">{PAYMENT_METHODS.find(p => p.key === selectedExp.paymentMethod)?.label ?? selectedExp.paymentMethod}</div></div>
              {selectedExp.reference && <div><div className="text-xs" style={{ color: "var(--psg-muted)" }}>Reference</div><div className="text-sm font-mono text-white">{selectedExp.reference}</div></div>}
            </div>
            {selectedExp.notes && <div><div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div><p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedExp.notes}</p></div>}
          </div>
          <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "var(--psg-card-border)" }}>
            <button onClick={() => openEditExp(selectedExp)} className="flex-1 border py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
            {selectedExp.status !== "paid" && <button onClick={() => setExpStatus(selectedExp, "paid")} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#10b981" }}>Mark Paid</button>}
            {confirmDelete === selectedExp.id ? (
              <><button onClick={() => delExp(selectedExp.id)} className="border py-2 px-3 rounded text-sm text-red-400" style={{ borderColor: "rgba(239,68,68,0.3)" }}>Yes, delete</button><button onClick={() => setConfirmDelete(null)} className="border py-2 px-3 rounded text-sm" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button></>
            ) : (
              <button onClick={() => setConfirmDelete(selectedExp.id)} className="border py-2 px-3 rounded text-sm text-red-400 hover:bg-red-900/20" style={{ borderColor: "rgba(239,68,68,0.3)" }}>Delete</button>
            )}
          </div>
        </div>
      )}

      {/* Invoice form modal */}
      {showForm && tab !== "expenses" && (
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
      )}

      {/* Expense form modal */}
      {showForm && tab === "expenses" && (
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
                    <input className={inp} style={inpStyle} value={expForm.production ?? ""} onChange={e => setExpForm(f => ({ ...f, production: e.target.value }))} placeholder="e.g. Curious Incident" />
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
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Status</label>
                  <select className={inp} style={inpStyle} value={expForm.status ?? "pending"} onChange={e => setExpForm(f => ({ ...f, status: e.target.value }))}>
                    {EXPENSE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
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
      )}
    </div>
  );
}

export default function FinancePage() {
  return <Suspense><FinancePageInner /></Suspense>;
}
