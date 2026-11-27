// Finance state hooks: production spend (budget/haulage/expenses), invoice to-dos and expense documents.
import { useEffect, useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import type { ExpDoc, Expense, FinanceInitial, FinanceTab, InvoiceTodo, PSGExpense, ProdExpense, RechargeableMovement } from "./financeTypes";

// Production Expenses (budget spend)
export function useProdSpend(tab: FinanceTab) {
  const [psgExpenses, setPsgExpenses] = useState<PSGExpense[]>([]);
  const [rechargeableMovements, setRechargeableMovements] = useState<RechargeableMovement[]>([]);
  const [productionExpenses, setProductionExpenses] = useState<ProdExpense[]>([]);
  const [prodSpendFilter, setProdSpendFilter] = useState({ productionId: "all", type: "all", search: "", uninvoicedOnly: false });
  const [selectedPsgExpense, setSelectedPsgExpense] = useState<PSGExpense | null>(null);
  const [selectedHaulage, setSelectedHaulage] = useState<RechargeableMovement | null>(null);

  async function reloadProdSpend() {
    const d = await fetch("/api/finance/production-spend").then(r => r.json());
    if (d.psgExpenses) setPsgExpenses(d.psgExpenses);
    if (d.rechargeableMovements) setRechargeableMovements(d.rechargeableMovements);
    if (d.productionExpenses) setProductionExpenses(d.productionExpenses);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads when the tab is opened; state is set after the fetch
  useEffect(() => { if (tab === "prod-spend") reloadProdSpend(); }, [tab]);

  return {
    psgExpenses, setPsgExpenses,
    rechargeableMovements, setRechargeableMovements,
    productionExpenses, setProductionExpenses,
    prodSpendFilter, setProdSpendFilter,
    selectedPsgExpense, setSelectedPsgExpense,
    selectedHaulage, setSelectedHaulage,
  };
}

// Invoice To-Do list
export function useInvoiceTodos(initial: FinanceInitial) {
  const [todos, setTodos] = useState<InvoiceTodo[]>((initial?.todos ?? []) as InvoiceTodo[]);
  const [todoForm, setTodoForm] = useState({ client: "", description: "", productionId: "", amount: "", dueDate: "", notes: "" });
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [editTodo, setEditTodo] = useState<InvoiceTodo | null>(null);

  async function reloadTodos() {
    const d = await fetch("/api/invoice-todos").then(r => r.json());
    if (Array.isArray(d)) setTodos(d);
  }

  async function saveTodo(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...todoForm, amount: todoForm.amount || null, dueDate: todoForm.dueDate || null, productionId: todoForm.productionId || null };
    const url = editTodo ? `/api/invoice-todos/${editTodo.id}` : "/api/invoice-todos";
    const method = editTodo ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await reloadTodos();
    setShowTodoForm(false);
    setEditTodo(null);
    setTodoForm({ client: "", description: "", productionId: "", amount: "", dueDate: "", notes: "" });
  }

  async function toggleTodoDone(todo: InvoiceTodo) {
    await fetch(`/api/invoice-todos/${todo.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !todo.done }) });
    await reloadTodos();
  }

  async function deleteTodo(id: number) {
    if (!await confirmDialog("Remove this item?")) return;
    await fetch(`/api/invoice-todos/${id}`, { method: "DELETE" });
    await reloadTodos();
  }

  return {
    todos, todoForm, setTodoForm, showTodoForm, setShowTodoForm, editTodo, setEditTodo,
    reloadTodos, saveTodo, toggleTodoDone, deleteTodo,
  };
}

// Documents (invoices & receipts) attached to the selected expense
export function useExpenseDocs(selectedExp: Expense | null) {
  const [expDocs, setExpDocs] = useState<ExpDoc[]>([]);
  const [expDocUploading, setExpDocUploading] = useState(false);

  const selectedId = selectedExp?.id;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the list when no expense is open
    if (!selectedId) { setExpDocs([]); return; }
    fetch(`/api/expenses/${selectedId}/documents`).then(r => r.json()).then(d => { if (Array.isArray(d)) setExpDocs(d); });
  }, [selectedId]);

  return { expDocs, setExpDocs, expDocUploading, setExpDocUploading };
}
