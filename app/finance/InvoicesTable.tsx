// Finance sales/purchase invoices table.
import type { Dispatch, SetStateAction } from "react";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import type { Expense, Invoice } from "./financeTypes";
import { isOverdue } from "./financeTypes";
import StatusBadge from "./StatusBadge";

type Props = {
  tab: string;
  visibleInv: Invoice[];
  invStatuses: { key: string; label: string; color: string }[];
  setSelectedInv: Dispatch<SetStateAction<Invoice | null>>;
  setSelectedExp: Dispatch<SetStateAction<Expense | null>>;
  openEditInv: (inv: Invoice) => void;
  confirmDelete: number | null;
  setConfirmDelete: Dispatch<SetStateAction<number | null>>;
  delInv: (id: number) => void;
};

export default function InvoicesTable({ tab, visibleInv, invStatuses, setSelectedInv, setSelectedExp, openEditInv, confirmDelete, setConfirmDelete, delInv }: Props) {
  return (
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
  );
}
