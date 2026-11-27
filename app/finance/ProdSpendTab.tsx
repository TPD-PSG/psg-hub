// Finance "Production Expenses" tab: filters, export and the PSG expense / haulage / production expense tables.
import { exportProductionSpendPDF, exportProductionSpendXLSX } from "@/lib/exports";
import ExportMenu from "@/components/ExportMenu";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import type { useProdSpend } from "./financeHooks";

type Props = ReturnType<typeof useProdSpend>;

export default function ProdSpendTab({ psgExpenses, setPsgExpenses, rechargeableMovements, setRechargeableMovements, productionExpenses, setProductionExpenses, prodSpendFilter, setProdSpendFilter, setSelectedPsgExpense, setSelectedHaulage }: Props) {
  const allProductions = Array.from(new Map<number, string>([
    ...psgExpenses.map(e => [e.budgetLine.production.id, e.budgetLine.production.name] as [number, string]),
    ...rechargeableMovements.map(m => [m.production.id, m.production.name] as [number, string]),
    ...productionExpenses.filter(e => e.productionLink).map(e => [e.productionLink!.id, e.productionLink!.name] as [number, string]),
  ]).entries()).map(([id, name]) => ({ id, name }));

  const filteredExpenses = psgExpenses.filter(e =>
    (prodSpendFilter.productionId === "all" || String(e.budgetLine.production.id) === prodSpendFilter.productionId) &&
    (prodSpendFilter.type === "all" || prodSpendFilter.type === "psg") &&
    (!prodSpendFilter.uninvoicedOnly || !e.invoicedToClient) &&
    (!prodSpendFilter.search || e.description.toLowerCase().includes(prodSpendFilter.search.toLowerCase()) || (e.supplier ?? "").toLowerCase().includes(prodSpendFilter.search.toLowerCase()))
  );
  const filteredMovements = rechargeableMovements.filter(m =>
    (prodSpendFilter.productionId === "all" || String(m.production.id) === prodSpendFilter.productionId) &&
    (prodSpendFilter.type === "all" || prodSpendFilter.type === "haulage") &&
    (!prodSpendFilter.uninvoicedOnly || !m.invoicedToClient) &&
    (!prodSpendFilter.search || m.haulageCompany.toLowerCase().includes(prodSpendFilter.search.toLowerCase()) || m.fromLocation.toLowerCase().includes(prodSpendFilter.search.toLowerCase()) || m.toLocation.toLowerCase().includes(prodSpendFilter.search.toLowerCase()))
  );
  const filteredProdExp = productionExpenses.filter(e =>
    (prodSpendFilter.productionId === "all" || String(e.productionLink?.id) === prodSpendFilter.productionId) &&
    (prodSpendFilter.type === "all" || prodSpendFilter.type === "prod-exp") &&
    (!prodSpendFilter.uninvoicedOnly || !e.invoicedToClient) &&
    (!prodSpendFilter.search || e.description.toLowerCase().includes(prodSpendFilter.search.toLowerCase()) || (e.supplier ?? "").toLowerCase().includes(prodSpendFilter.search.toLowerCase()) || e.category.toLowerCase().includes(prodSpendFilter.search.toLowerCase()))
  );

  const totalPSG = filteredExpenses.reduce((s, e) => s + e.spent, 0);
  const totalHaulage = filteredMovements.reduce((s, m) => s + (m.actualCost ?? m.estimatedCost ?? 0), 0);
  const totalProdExp = filteredProdExp.reduce((s, e) => s + e.netAmount + e.vatAmount, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="rounded px-3 py-1.5 text-sm border focus:outline-none" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
          value={prodSpendFilter.productionId} onChange={e => setProdSpendFilter(f => ({ ...f, productionId: e.target.value }))}>
          <option value="all">All Productions</option>
          {allProductions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="rounded px-3 py-1.5 text-sm border focus:outline-none" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
          value={prodSpendFilter.type} onChange={e => setProdSpendFilter(f => ({ ...f, type: e.target.value }))}>
          <option value="all">All Types</option>
          <option value="psg">PSG Expenses</option>
          <option value="haulage">Rechargeable Haulage</option>
          <option value="prod-exp">Production Expenses</option>
        </select>
        <input className="rounded px-3 py-1.5 text-sm border focus:outline-none flex-1 min-w-[180px]"
          style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)", color: "white" }}
          placeholder="Search…" value={prodSpendFilter.search} onChange={e => setProdSpendFilter(f => ({ ...f, search: e.target.value }))} />
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm shrink-0" style={{ color: "var(--psg-muted)" }}>
          <input type="checkbox" checked={prodSpendFilter.uninvoicedOnly} onChange={e => setProdSpendFilter(f => ({ ...f, uninvoicedOnly: e.target.checked }))} className="w-4 h-4 cursor-pointer accent-blue-500" />
          Not yet invoiced
        </label>
        <div className="text-sm" style={{ color: "var(--psg-muted)" }}>
          Total: <span className="text-white font-medium">{fmt(totalPSG + totalHaulage + totalProdExp)}</span>
        </div>
        <ExportMenu actions={(["pdf", "xlsx"] as const).map(kind => ({
          label: kind === "pdf" ? "Export PDF" : "Export Excel",
          onClick: () => {
            const filterLabel = [
              prodSpendFilter.productionId !== "all" ? allProductions.find(p => String(p.id) === prodSpendFilter.productionId)?.name : "All Productions",
              prodSpendFilter.uninvoicedOnly ? "Not yet invoiced" : null,
            ].filter(Boolean).join(" · ");
            void (kind === "pdf" ? exportProductionSpendPDF : exportProductionSpendXLSX)(
              filteredExpenses.map(e => ({ production: e.budgetLine.production.name, department: e.budgetLine.department, description: e.description, supplier: e.supplier, spent: e.spent, paymentDue: e.paymentDue, invoicedToClient: e.invoicedToClient })),
              filteredMovements.map(m => ({ production: m.production.name, haulageCompany: m.haulageCompany, route: `${m.fromLocation} → ${m.toLocation}`, cargo: m.cargo, departureAt: m.departureAt, actualCost: m.actualCost, estimatedCost: m.estimatedCost, invoicedToClient: m.invoicedToClient })),
              filteredProdExp.map(e => ({ production: e.productionLink?.name ?? "—", category: e.category, description: e.description, supplier: e.supplier, submittedBy: e.submittedByUser?.name ?? null, date: e.date, netAmount: e.netAmount, vatAmount: e.vatAmount, status: e.status, invoicedToClient: e.invoicedToClient })),
              filterLabel || "All",
            );
          },
        }))} />
      </div>

      {/* PSG Expenses table */}
      {(prodSpendFilter.type === "all" || prodSpendFilter.type === "psg") && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>
            PSG Expenses · {fmt(totalPSG)}
          </h3>
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <th className="px-4 py-3 text-left font-medium text-white">Production</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Supplier</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Committed</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Spent</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Payment Due</th>
                  <th className="px-4 py-3 text-center font-medium text-white">Issued</th>
                  <th className="px-4 py-3 text-center font-medium text-white">Invoiced</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(e => (
                  <tr key={e.id} onClick={() => { setSelectedPsgExpense(e); setSelectedHaulage(null); }} className="border-t hover:bg-white/5 transition-colors cursor-pointer" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{e.budgetLine.production.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{e.budgetLine.department}</td>
                    <td className="px-4 py-3 font-medium text-white">{e.description}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{e.supplier ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: "var(--psg-muted)" }}>{e.committed > 0 ? fmt(e.committed) : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">{fmt(e.spent)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: e.paymentDue && new Date(e.paymentDue) < new Date() ? "#ef4444" : "var(--psg-muted)" }}>
                      {e.paymentDue ? fmtDate(e.paymentDue) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {e.issuedForPayment
                        ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#10b98122", color: "#10b981" }}>Yes</span>
                        : <span className="text-xs" style={{ color: "var(--psg-muted)" }}>No</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={e.invoicedToClient}
                        onChange={async (ev) => {
                          const val = ev.target.checked;
                          await fetch(`/api/budget-expenses/${e.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoicedToClient: val }) });
                          setPsgExpenses(prev => prev.map(x => x.id === e.id ? { ...x, invoicedToClient: val } : x));
                        }}
                        className="w-4 h-4 cursor-pointer accent-blue-500"
                        title={e.invoicedToClient ? "Invoiced to client" : "Not yet invoiced"}
                      />
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No PSG expenses found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rechargeable Haulage table */}
      {(prodSpendFilter.type === "all" || prodSpendFilter.type === "haulage") && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>
            Rechargeable Haulage · {fmt(totalHaulage)}
          </h3>
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <th className="px-4 py-3 text-left font-medium text-white">Production</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Haulage Company</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Route</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Cargo</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Departure</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Est. Cost</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Actual Cost</th>
                  <th className="px-4 py-3 text-center font-medium text-white">Invoiced</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map(m => (
                  <tr key={m.id} onClick={() => { setSelectedHaulage(m); setSelectedPsgExpense(null); }} className="border-t hover:bg-white/5 transition-colors cursor-pointer" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{m.production.name}</td>
                    <td className="px-4 py-3 font-medium text-white">{m.haulageCompany}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{m.fromLocation} → {m.toLocation}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{m.cargo || "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{fmtDate(m.departureAt)}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: "var(--psg-muted)" }}>{m.estimatedCost != null ? fmt(m.estimatedCost) : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">{m.actualCost != null ? fmt(m.actualCost) : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={m.invoicedToClient}
                        onChange={async (ev) => {
                          const val = ev.target.checked;
                          await fetch(`/api/haulage/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoicedToClient: val }) });
                          setRechargeableMovements(prev => prev.map(x => x.id === m.id ? { ...x, invoicedToClient: val } : x));
                        }}
                        className="w-4 h-4 cursor-pointer accent-blue-500"
                        title={m.invoicedToClient ? "Invoiced to client" : "Not yet invoiced"}
                      />
                    </td>
                  </tr>
                ))}
                {filteredMovements.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No rechargeable haulage movements found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Production Expenses table */}
      {(prodSpendFilter.type === "all" || prodSpendFilter.type === "prod-exp") && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>
            Production Expenses · {fmt(totalProdExp)}
          </h3>
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <th className="px-4 py-3 text-left font-medium text-white">Production</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Submitted By</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Net</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Total (inc. VAT)</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-white">Invoiced</th>
                </tr>
              </thead>
              <tbody>
                {filteredProdExp.map(e => (
                  <tr key={e.id} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{e.productionLink?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{e.category}</td>
                    <td className="px-4 py-3 font-medium text-white">{e.description}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{e.supplier ?? "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{e.submittedByUser?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{e.date ? fmtDate(e.date) : "—"}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: "var(--psg-muted)" }}>{fmt(e.netAmount)}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">{fmt(e.netAmount + e.vatAmount)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                        style={{
                          backgroundColor: e.status === "approved" ? "#10b98122" : e.status === "paid" ? "#3b82f622" : e.status === "rejected" ? "#ef444422" : "rgba(255,255,255,0.08)",
                          color: e.status === "approved" ? "#10b981" : e.status === "paid" ? "#60a5fa" : e.status === "rejected" ? "#ef4444" : "var(--psg-muted)",
                        }}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={e.invoicedToClient}
                        onChange={async (ev) => {
                          const val = ev.target.checked;
                          await fetch(`/api/expenses/${e.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoicedToClient: val }) });
                          setProductionExpenses(prev => prev.map(x => x.id === e.id ? { ...x, invoicedToClient: val } : x));
                        }}
                        className="w-4 h-4 cursor-pointer accent-blue-500"
                        title={e.invoicedToClient ? "Invoiced to client" : "Not yet invoiced"}
                      />
                    </td>
                  </tr>
                ))}
                {filteredProdExp.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No production expenses with a linked production found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
