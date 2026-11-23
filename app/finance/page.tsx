// Server side of Finance: invoices, expenses, productions and invoice to-dos arrive with the page
// (same API and checks as the browser). Production spend still loads when its tab is opened.
import { serverApi } from "@/lib/serverApi";
import FinanceView, { type Invoice, type Expense, type Production } from "./FinanceView";

export default async function FinancePage() {
  const [invoices, expenses, productions, todos] = await Promise.all([
    serverApi<Invoice[]>("/api/invoices"),
    serverApi<Expense[]>("/api/expenses"),
    serverApi<Production[]>("/api/productions"),
    serverApi<unknown[]>("/api/invoice-todos"),
  ]);
  const ok = [invoices, expenses, productions, todos].every(Array.isArray);
  return <FinanceView initial={ok ? { invoices: invoices!, expenses: expenses!, productions: productions!, todos: todos! } : null} />;
}
