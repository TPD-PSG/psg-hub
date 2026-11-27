// Finance production-spend side panels: PSG budget expense detail and rechargeable haulage detail.
import type { Dispatch, SetStateAction } from "react";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import type { PSGExpense, RechargeableMovement } from "./financeTypes";

export function PsgExpenseDetailPanel({ selectedPsgExpense, setSelectedPsgExpense }: { selectedPsgExpense: PSGExpense; setSelectedPsgExpense: Dispatch<SetStateAction<PSGExpense | null>> }) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l shadow-2xl flex flex-col z-40" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        <div>
          <h2 className="font-semibold text-white">{selectedPsgExpense.description}</h2>
          <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
            {selectedPsgExpense.budgetLine.production.name} · {selectedPsgExpense.budgetLine.department}
          </div>
        </div>
        <button onClick={() => setSelectedPsgExpense(null)} className="text-xl leading-none hover:text-white shrink-0" style={{ color: "var(--psg-muted)" }}>×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="rounded-lg p-4 space-y-2 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex justify-between text-sm"><span style={{ color: "var(--psg-muted)" }}>Committed</span><span className="text-white font-medium">{fmt(selectedPsgExpense.committed)}</span></div>
          <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: "var(--psg-card-border)" }}>
            <span className="font-medium text-white">Spent</span>
            <span className="font-bold text-white text-base">{fmt(selectedPsgExpense.spent)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {selectedPsgExpense.supplier && <div><div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Supplier</div><div className="text-white">{selectedPsgExpense.supplier}</div></div>}
          <div><div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Nominal Code</div><div className="text-white font-mono">{selectedPsgExpense.budgetLine.nominalCode ?? "—"}</div></div>
          <div><div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Payment Due</div>
            <div style={{ color: selectedPsgExpense.paymentDue && new Date(selectedPsgExpense.paymentDue) < new Date() ? "#ef4444" : "white" }}>
              {selectedPsgExpense.paymentDue ? fmtDate(selectedPsgExpense.paymentDue) : "—"}
            </div>
          </div>
          <div><div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Issued for Payment</div>
            <div>{selectedPsgExpense.issuedForPayment
              ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#10b98122", color: "#10b981" }}>Yes</span>
              : <span style={{ color: "var(--psg-muted)" }}>No</span>}
            </div>
          </div>
        </div>
        {selectedPsgExpense.documents.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>Documents</div>
            <div className="space-y-2">
              {selectedPsgExpense.documents.map(doc => (
                <div key={doc.id} className="rounded p-3 border text-sm" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{doc.name}</span>
                    <span className="text-xs capitalize px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "var(--psg-muted)" }}>{doc.type}</span>
                  </div>
                  {doc.invoiceNumber && <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>Inv #{doc.invoiceNumber}</div>}
                  <div className="flex gap-4 mt-1 text-xs" style={{ color: "var(--psg-muted)" }}>
                    {doc.invoiceDate && <span>{fmtDate(doc.invoiceDate)}</span>}
                    {doc.invoiceAmount != null && <span>{fmt(doc.invoiceAmount)}</span>}
                    {doc.issuedForPayment && <span className="text-green-400">Issued</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {selectedPsgExpense.notes && <div><div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div><p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedPsgExpense.notes}</p></div>}
        <div className="pt-2">
          <a href={`/productions/${selectedPsgExpense.budgetLine.production.id}?tab=budget`}
            className="text-sm text-blue-400 hover:text-blue-300">→ View in production budget</a>
        </div>
      </div>
    </div>
  );
}

export function HaulageDetailPanel({ selectedHaulage, setSelectedHaulage }: { selectedHaulage: RechargeableMovement; setSelectedHaulage: Dispatch<SetStateAction<RechargeableMovement | null>> }) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l shadow-2xl flex flex-col z-40" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        <div>
          <h2 className="font-semibold text-white">{selectedHaulage.haulageCompany}</h2>
          <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
            {selectedHaulage.production.name} · Rechargeable
          </div>
        </div>
        <button onClick={() => setSelectedHaulage(null)} className="text-xl leading-none hover:text-white shrink-0" style={{ color: "var(--psg-muted)" }}>×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="rounded-lg p-4 space-y-2 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex justify-between text-sm"><span style={{ color: "var(--psg-muted)" }}>Estimated Cost</span><span className="text-white">{selectedHaulage.estimatedCost != null ? fmt(selectedHaulage.estimatedCost) : "—"}</span></div>
          <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: "var(--psg-card-border)" }}>
            <span className="font-medium text-white">Actual Cost</span>
            <span className="font-bold text-white text-base">{selectedHaulage.actualCost != null ? fmt(selectedHaulage.actualCost) : "—"}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>From</div><div className="text-white">{selectedHaulage.fromLocation}</div></div>
          <div><div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>To</div><div className="text-white">{selectedHaulage.toLocation}</div></div>
          <div><div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Departure</div><div className="text-white">{fmtDate(selectedHaulage.departureAt)}</div></div>
          <div><div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Production</div><div className="text-white">{selectedHaulage.production.name}</div></div>
        </div>
        {selectedHaulage.notes && <div><div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div><p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedHaulage.notes}</p></div>}
        <div className="pt-2">
          <a href={`/productions/${selectedHaulage.production.id}?tab=haulage`}
            className="text-sm text-blue-400 hover:text-blue-300">→ View in production logistics</a>
        </div>
      </div>
    </div>
  );
}
