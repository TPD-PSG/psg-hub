// Finance expenses table.
import type { Dispatch, SetStateAction } from "react";
import UserAvatar from "@/components/UserAvatar";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import type { Expense, Invoice } from "./financeTypes";
import { EXPENSE_STATUSES } from "./financeTypes";
import StatusBadge from "./StatusBadge";

type Props = {
  visibleExp: Expense[];
  setSelectedInv: Dispatch<SetStateAction<Invoice | null>>;
  setSelectedExp: Dispatch<SetStateAction<Expense | null>>;
  openEditExp: (exp: Expense) => void;
  confirmDelete: number | null;
  setConfirmDelete: Dispatch<SetStateAction<number | null>>;
  delExp: (id: number) => void;
};

export default function ExpensesTable({ visibleExp, setSelectedInv, setSelectedExp, openEditExp, confirmDelete, setConfirmDelete, delExp }: Props) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
            <th className="px-4 py-3 text-left font-medium text-white">Date</th>
            <th className="px-4 py-3 text-left font-medium text-white">Production</th>
            <th className="px-4 py-3 text-left font-medium text-white">Category</th>
            <th className="px-4 py-3 text-left font-medium text-white">Description</th>
            <th className="px-4 py-3 text-left font-medium text-white">Submitted by</th>
            <th className="px-4 py-3 text-right font-medium text-white">Net</th>
            <th className="px-4 py-3 text-right font-medium text-white">Total</th>
            <th className="px-4 py-3 text-left font-medium text-white">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {visibleExp.map(exp => (
            <tr key={exp.id} onClick={() => { setSelectedExp(exp); setSelectedInv(null); }} className="border-t hover:bg-white/5 transition-colors cursor-pointer group" style={{ borderColor: "var(--psg-card-border)" }}>
              <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{fmtDate(exp.date)}</td>
              <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{exp.productionLink?.name ?? exp.production ?? "—"}</td>
              <td className="px-4 py-3 text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{exp.category}</td>
              <td className="px-4 py-3 font-medium text-white">{exp.description}</td>
              <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                {exp.submittedByUser ? (
                  <span className="flex items-center gap-1.5">
                    <UserAvatar name={exp.submittedByUser.name} avatarUrl={exp.submittedByUser.avatarUrl} size={20} />
                    {exp.submittedByUser.name}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-medium text-white">{fmt(exp.netAmount)}</td>
              <td className="px-4 py-3 text-right font-medium text-white">{fmt(exp.netAmount + exp.vatAmount)}</td>
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
            <tr><td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No expenses yet — add one to get started</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
