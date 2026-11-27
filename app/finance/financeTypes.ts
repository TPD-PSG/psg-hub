// Finance shared types, status/category lists, blank forms, input styles and small helpers.

export type Invoice = {
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

export type Expense = {
  id: number;
  production: string | null;
  productionId: number | null;
  productionLink: { id: number; name: string } | null;
  submittedByUser: { id: number; name: string; avatarUrl?: string | null } | null;
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

export type Production = { id: number; name: string };

export type FinanceInitial = { invoices: Invoice[]; expenses: Expense[]; productions: Production[]; todos: unknown[] } | null;

export type FinanceTab = "sales" | "purchase" | "expenses" | "todo" | "prod-spend";

// Production Expenses (budget spend)
export type PSGExpense = {
  id: number;
  description: string;
  supplier: string | null;
  committed: number;
  spent: number;
  paymentDue: string | null;
  issuedForPayment: boolean;
  isPSGExpense: boolean;
  invoicedToClient: boolean;
  notes: string | null;
  budgetLine: {
    id: number;
    department: string;
    description: string;
    nominalCode: string | null;
    production: { id: number; name: string };
  };
  documents: { id: number; type: string; name: string; invoiceDate: string | null; invoiceAmount: number | null; invoiceNumber: string | null; issuedForPayment: boolean }[];
};
export type RechargeableMovement = {
  id: number;
  haulageCompany: string;
  fromLocation: string;
  toLocation: string;
  cargo: string | null;
  departureAt: string;
  estimatedCost: number | null;
  actualCost: number | null;
  rechargeable: boolean;
  invoicedToClient: boolean;
  notes: string | null;
  production: { id: number; name: string };
};
export type ProdExpense = {
  id: number;
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
  invoicedToClient: boolean;
  productionLink: { id: number; name: string } | null;
  submittedByUser: { id: number; name: string } | null;
};

// Invoice To-Do list
export type InvoiceTodo = { id: number; client: string; description: string; amount: number | null; dueDate: string | null; notes: string | null; done: boolean; production: { id: number; name: string } | null };

export type ExpDoc = { id: number; type: string; name: string; mime: string; createdAt: string };

export const SALES_STATUSES = [
  { key: "draft",    label: "Draft",    color: "#6b7280" },
  { key: "sent",     label: "Sent",     color: "#3b82f6" },
  { key: "overdue",  label: "Overdue",  color: "#ef4444" },
  { key: "paid",     label: "Paid",     color: "#10b981" },
];
export const PURCHASE_STATUSES = [
  { key: "received", label: "Received", color: "#6b7280" },
  { key: "overdue",  label: "Overdue",  color: "#ef4444" },
  { key: "paid",     label: "Paid",     color: "#10b981" },
];
export const EXPENSE_STATUSES = [
  { key: "pending",  label: "Pending",  color: "#6b7280" },
  { key: "approved", label: "Approved", color: "#3b82f6" },
  { key: "paid",     label: "Paid",     color: "#10b981" },
  { key: "rejected", label: "Rejected", color: "#ef4444" },
];
export const EXPENSE_CATEGORIES = [
  "travel", "accommodation", "marketing", "props", "costume", "set", "equipment", "catering", "venue", "misc",
];
export const PAYMENT_METHODS = [
  { key: "to_pay",   label: "To Pay" },
  { key: "card",     label: "Card" },
  { key: "cash",     label: "Cash" },
  { key: "transfer", label: "Transfer" },
];

export const BLANK_INV: Partial<Invoice> & { type: string } = {
  type: "sales", reference: "", description: "", party: "", production: "",
  netAmount: 0, vatAmount: 0, issueDate: "", dueDate: "", status: "draft", notes: "",
};
export const BLANK_EXP: Partial<Expense> & { productionId: number | null } = {
  production: "", productionId: null, productionLink: null, submittedByUser: null,
  category: "misc", description: "", supplier: "",
  netAmount: 0, vatAmount: 0, date: "", paymentMethod: "to_pay", status: "pending", reference: "", notes: "",
};

export const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
export const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

export function isOverdue(s: string | null, status: string) {
  if (!s || status === "paid") return false;
  return new Date(s) < new Date();
}
export function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
