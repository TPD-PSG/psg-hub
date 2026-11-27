"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { fmtMoney as fmt } from "@/lib/format";
import type { Expense, FinanceInitial, Invoice, Production } from "./financeTypes";
import { BLANK_EXP, BLANK_INV, EXPENSE_STATUSES, PURCHASE_STATUSES, SALES_STATUSES, isOverdue } from "./financeTypes";
import { useExpenseDocs, useInvoiceTodos, useProdSpend } from "./financeHooks";
import InvoiceTodoTab from "./InvoiceTodoTab";
import InvoicesTable from "./InvoicesTable";
import ExpensesTable from "./ExpensesTable";
import ProdSpendTab from "./ProdSpendTab";
import InvoiceDetailPanel from "./InvoiceDetailPanel";
import ExpenseDetailPanel from "./ExpenseDetailPanel";
import InvoiceFormModal from "./InvoiceFormModal";
import { HaulageDetailPanel, PsgExpenseDetailPanel } from "./ProdSpendDetailPanels";
import ExpenseFormModal from "./ExpenseFormModal";

export type { Invoice, Expense, Production, FinanceInitial } from "./financeTypes";

function FinancePageInner({ initial }: { initial: FinanceInitial }) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "member";
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>(initial?.invoices ?? []);
  const [expenses, setExpenses] = useState<Expense[]>(initial?.expenses ?? []);
  const [productions, setProductions] = useState<Production[]>(initial?.productions ?? []);
  const [tab, setTab] = useState<"sales" | "purchase" | "expenses" | "todo" | "prod-spend">("sales");

  // Sync tab with URL search param so sidebar nav links work
  useEffect(() => {
    const t = searchParams.get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows the ?tab= in the address when the sidebar link changes it
    if (t === "purchase" || t === "expenses" || t === "todo" || t === "prod-spend") setTab(t);
    else setTab("sales");
  }, [searchParams]);

  // Production Expenses (budget spend)
  const prodSpend = useProdSpend(tab);
  const { setSelectedPsgExpense, setSelectedHaulage } = prodSpend;

  // Invoice To-Do list
  const todo = useInvoiceTodos(initial);
  const { reloadTodos } = todo;
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [invForm, setInvForm] = useState<typeof BLANK_INV & { id?: number }>(BLANK_INV);
  const [expForm, setExpForm] = useState<typeof BLANK_EXP & { id?: number }>(BLANK_EXP);
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [selectedExp, setSelectedExp] = useState<Expense | null>(null);
  const expDocState = useExpenseDocs(selectedExp);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    if (initial) return; // already loaded on the server
    reloadAll();
    reloadTodos();
    fetch("/api/productions").then(r => r.json()).then(d => { if (Array.isArray(d)) setProductions(d); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      id: exp.id, production: exp.production ?? "", productionId: exp.productionId ?? null,
      productionLink: exp.productionLink, submittedByUser: exp.submittedByUser,
      category: exp.category, description: exp.description, supplier: exp.supplier ?? "",
      netAmount: exp.netAmount, vatAmount: exp.vatAmount,
      date: exp.date ? exp.date.slice(0, 10) : "",
      paymentMethod: exp.paymentMethod ?? "to_pay",
      status: exp.status, reference: exp.reference ?? "", notes: exp.notes ?? "",
    });
    setShowForm(true);
  }

  function switchTab(t: "sales" | "purchase" | "expenses" | "todo" | "prod-spend") {
    setTab(t);
    setFilterStatus("all");
    setSelectedInv(null);
    setSelectedExp(null);
    setSelectedPsgExpense(null);
    setSelectedHaulage(null);
  }

  const visibleInv = invoices
    .filter(i => i.type === tab)
    .filter(i => filterStatus === "all" || i.status === filterStatus);

  const visibleExp = expenses
    .filter(i => filterStatus === "all" || i.status === filterStatus);

  const invStatuses = tab === "purchase" ? PURCHASE_STATUSES : SALES_STATUSES;

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
        {tab !== "todo" && tab !== "prod-spend" && (
          <button onClick={openNew} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
            + {tab === "sales" ? "Sales Invoice" : tab === "purchase" ? "Purchase Invoice" : "Expense"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
          {(["sales", "purchase", "expenses", "todo", "prod-spend"] as const).map(t => (
            <button key={t} onClick={() => switchTab(t)} className="px-4 py-1.5 text-sm transition-colors" style={{ backgroundColor: tab === t ? "var(--psg-blue)" : "transparent", color: tab === t ? "#fff" : "var(--psg-muted)" }}>
              {t === "sales" ? "Sales Invoices" : t === "purchase" ? "Purchase Invoices" : t === "expenses" ? "Expenses" : t === "todo" ? "Invoice To-Do" : "Production Expenses"}
            </button>
          ))}
        </div>
        {tab !== "todo" && tab !== "prod-spend" && (
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterStatus("all")} className="px-3 py-1 rounded text-xs transition-colors" style={{ backgroundColor: filterStatus === "all" ? "rgba(255,255,255,0.1)" : "transparent", color: "var(--psg-muted)" }}>All</button>
            {(tab === "expenses" ? EXPENSE_STATUSES : invStatuses).map(s => (
              <button key={s.key} onClick={() => setFilterStatus(s.key)} className="px-3 py-1 rounded text-xs transition-colors" style={{ backgroundColor: filterStatus === s.key ? s.color + "33" : "transparent", color: filterStatus === s.key ? s.color : "var(--psg-muted)" }}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── INVOICE TO-DO TAB ─────────────────────────────────────────── */}
      {tab === "todo" && (
        <InvoiceTodoTab {...todo} productions={productions} />
      )}

      {/* Invoice Table */}
      {tab !== "expenses" && tab !== "todo" && tab !== "prod-spend" && (
        <InvoicesTable tab={tab} visibleInv={visibleInv} invStatuses={invStatuses} setSelectedInv={setSelectedInv} setSelectedExp={setSelectedExp} openEditInv={openEditInv} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} delInv={delInv} />
      )}

      {/* Expenses Table */}
      {tab === "expenses" && (
        <ExpensesTable visibleExp={visibleExp} setSelectedInv={setSelectedInv} setSelectedExp={setSelectedExp} openEditExp={openEditExp} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} delExp={delExp} />
      )}

      {/* Production Expenses Tab */}
      {tab === "prod-spend" && <ProdSpendTab {...prodSpend} />}

      {/* Invoice detail panel */}
      {selectedInv && (
        <InvoiceDetailPanel selectedInv={selectedInv} setSelectedInv={setSelectedInv} invStatuses={invStatuses} setInvStatus={setInvStatus} openEditInv={openEditInv} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} delInv={delInv} />
      )}

      {/* Expense detail panel */}
      {selectedExp && (
        <ExpenseDetailPanel {...expDocState} role={role} selectedExp={selectedExp} setSelectedExp={setSelectedExp} setExpStatus={setExpStatus} openEditExp={openEditExp} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} delExp={delExp} />
      )}

      {/* Invoice form modal */}
      {showForm && tab !== "expenses" && (
        <InvoiceFormModal invForm={invForm} setInvForm={setInvForm} setShowForm={setShowForm} saveInv={saveInv} />
      )}

      {/* PSG Expense detail panel */}
      {prodSpend.selectedPsgExpense && (
        <PsgExpenseDetailPanel selectedPsgExpense={prodSpend.selectedPsgExpense} setSelectedPsgExpense={setSelectedPsgExpense} />
      )}

      {/* Rechargeable Haulage detail panel */}
      {prodSpend.selectedHaulage && (
        <HaulageDetailPanel selectedHaulage={prodSpend.selectedHaulage} setSelectedHaulage={setSelectedHaulage} />
      )}

      {/* Expense form modal */}
      {showForm && tab === "expenses" && (
        <ExpenseFormModal role={role} productions={productions} expForm={expForm} setExpForm={setExpForm} setShowForm={setShowForm} saveExp={saveExp} />
      )}
    </div>
  );
}

// Invoices, expenses, productions and to-dos arrive with the page (loaded on the server by page.tsx)
export default function FinanceView({ initial }: { initial: FinanceInitial }) {
  return <Suspense><FinancePageInner initial={initial} /></Suspense>;
}
