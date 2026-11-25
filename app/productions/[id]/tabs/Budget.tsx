"use client";

import { useEffect, useMemo, useState } from "react";
import ExportMenu from "@/components/ExportMenu";
import BudgetReallocationPanel from "@/components/BudgetReallocationPanel";
import PmFeePanel from "@/components/PmFeePanel";
import { useSession } from "next-auth/react";
import { exportBudgetPDF, exportBudgetXLSX, exportClientBudgetPDF } from "@/lib/budgetExport";
import { buildBudgetReport, type ReportVariation } from "@/lib/budgetReport";
import { confirmDialog } from "@/components/Dialogs";
import NotesPeek from "@/components/NotesPeek";
import { F, Modal, Btns, inp, inpStyle, fmt, fmtDate, fmtShortDate, sendJson, useList, toggled, type BudgetLine, type Expense, type HaulageMovement, type TabProps, type TourStop } from "../shared";
import BudgetSpendModal, { PHASES } from "./BudgetSpendModal";

const DEPARTMENTS = ["Scenery", "Props", "Wardrobe", "Wigs & Hair", "Makeup", "Sound Hires", "Sound Consumables", "Lighting Hires", "Lighting Consumables", "Rigging", "Instruments", "Video Hires", "Video Consumables", "Video Content", "Production Setup", "Transport", "Rehearsal", "Production Staffing", "Petty Cash", "Other"];

const PHASE_COLORS: Record<string, string> = {
  "Capitalisation": "text-yellow-400",
  running: "text-green-400",
  closing: "text-blue-400",
};

const BLANK_BUDGET_LINE = { department: "", description: "", nominalCode: "", budgeted: "", notes: "" };
const BLANK_PSG_EXPENSE = { description: "", supplier: "", committed: "", spent: "", paymentDue: "", notes: "", paymentMethod: "" };
const PSG_PAYMENT_METHODS = ["Soldo", "Personal Card", "PSG Trade Account", "TWS Trade Account"];

const sum = <T,>(items: T[], f: (x: T) => number) => items.reduce((s, x) => s + f(x), 0);

export default function BudgetTab({ prod, reload, isAdmin, userRole }: TabProps & { isAdmin: boolean; userRole: string }) {
  const id = String(prod.id);
  const [budgetView, setBudgetView] = useState<"summary" | "detail">("detail");
  const [expandedBudgetLines, setExpandedBudgetLines] = useState<Set<number>>(new Set());
  const [expandedBudgetDepts, setExpandedBudgetDepts] = useState<Set<string>>(new Set());
  const [renamingDept, setRenamingDept] = useState<string | null>(null);
  const [deptRenameValue, setDeptRenameValue] = useState("");
  const [budgetDeptOrder, setBudgetDeptOrder] = useState<string[] | null>(null);
  const [dragDept, setDragDept] = useState<string | null>(null);
  // Spend modal: which line it's for, and the item being edited (null = new)
  const [spendTarget, setSpendTarget] = useState<{ lineId: number; expense: Expense | null } | null>(null);
  const [showContra, setShowContra] = useState(false);
  const [tourStops] = useList<TourStop>(`/api/productions/${id}/tour-stops`);

  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editBudgetLine, setEditBudgetLine] = useState<BudgetLine | null>(null);
  const [showPSGExpenseForm, setShowPSGExpenseForm] = useState<number | null>(null);
  const [editingPSGExpense, setEditingPSGExpense] = useState<Expense | null>(null);
  const [psgExpenseForm, setPSGExpenseForm] = useState<typeof BLANK_PSG_EXPENSE & { id?: number }>(BLANK_PSG_EXPENSE);
  const [psgReceiptFile, setPsgReceiptFile] = useState<File | null>(null);
  const [budgetForm, setBudgetForm] = useState(BLANK_BUDGET_LINE);
  const [clientReport, setClientReport] = useState<{ note: string; busy: boolean } | null>(null);
  const { data: session } = useSession();

  // Restore this production's saved department order, dropping departments that no longer exist
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`budget-dept-order-${id}`);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const existing = new Set(prod.budgetLines.map(l => l.department));
        const filtered = parsed.filter(d => existing.has(d));
        const missing = [...existing].filter(d => !parsed.includes(d));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage, so can't run during render
        setBudgetDeptOrder([...filtered, ...missing]);
      }
    } catch {}
  }, [id, prod.budgetLines]);

  function closeBudgetForm() { setShowBudgetForm(false); setEditBudgetLine(null); setBudgetForm(BLANK_BUDGET_LINE); }
  function closePSGForm() { setShowPSGExpenseForm(null); setEditingPSGExpense(null); setPSGExpenseForm(BLANK_PSG_EXPENSE); setPsgReceiptFile(null); }

  async function saveBudgetLine(e: React.FormEvent) {
    e.preventDefault();
    if (editBudgetLine) {
      await sendJson(`/api/budget-lines/${editBudgetLine.id}`, "PUT", budgetForm);
      setEditBudgetLine(null);
    } else {
      await sendJson(`/api/productions/${id}/budget`, "POST", budgetForm);
    }
    setShowBudgetForm(false);
    setBudgetForm(BLANK_BUDGET_LINE);
    reload();
  }

  async function deleteBudgetLine(lid: number) {
    if (!await confirmDialog("Delete this budget line and all its items?")) return;
    await fetch(`/api/budget-lines/${lid}`, { method: "DELETE" });
    reload();
  }

  async function deleteDepartment(lineIds: number[]) {
    if (!await confirmDialog(`Delete this department and all ${lineIds.length} line${lineIds.length !== 1 ? "s" : ""} within it?`)) return;
    await Promise.all(lineIds.map(id => fetch(`/api/budget-lines/${id}`, { method: "DELETE" })));
    reload();
  }

  async function renameDepartment(oldName: string, newName: string, lines: BudgetLine[]) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) { setRenamingDept(null); return; }
    await Promise.all(lines.map(l => sendJson(`/api/budget-lines/${l.id}`, "PUT", { department: trimmed, description: l.description, nominalCode: l.nominalCode ?? "", budgeted: String(l.budgeted), notes: l.notes ?? "" })));
    setRenamingDept(null);
    reload();
  }

  async function deleteExpense(eid: number) {
    if (!await confirmDialog("Delete this item?")) return;
    await fetch(`/api/budget-expenses/${eid}`, { method: "DELETE" });
    reload();
  }

  async function savePSGExpense(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...psgExpenseForm, isPSGExpense: true, phase: "Capitalisation", estimated: 0, issuedForPayment: false, vatExempt: false };
    let expenseId: number;
    if (editingPSGExpense) {
      await sendJson(`/api/budget-expenses/${editingPSGExpense.id}`, "PUT", payload);
      expenseId = editingPSGExpense.id;
    } else {
      const res = await sendJson(`/api/budget-lines/${showPSGExpenseForm}/expenses`, "POST", payload);
      expenseId = (await res.json()).id;
    }
    // Receipt, if one was attached, is stored as the item's invoice
    if (psgReceiptFile) {
      const fd = new FormData(); fd.append("file", psgReceiptFile); fd.append("type", "invoice");
      await fetch(`/api/budget-expenses/${expenseId}/documents`, { method: "POST", body: fd });
    }
    closePSGForm();
    reload();
  }

  async function deletePSGExpense(eid: number) {
    if (!await confirmDialog("Delete this PSG expense?")) return;
    await fetch(`/api/budget-expenses/${eid}`, { method: "DELETE" });
    reload();
  }

  async function toggleIssued(exp: Expense) {
    await sendJson(`/api/budget-expenses/${exp.id}`, "PUT", { ...exp, issuedForPayment: !exp.issuedForPayment });
    reload();
  }

  // ── Totals ── (PM budget = estimated, net cost = committed, gross cost = spent).
  // Worked out in lib/budgetReport.ts, which the exports use too, so they always match.
  const report = useMemo(
    () => buildBudgetReport(prod.budgetLines, prod.haulageMovements, tourStops, budgetDeptOrder),
    [prod.budgetLines, prod.haulageMovements, tourStops, budgetDeptOrder],
  );
  const { allocation: totalBudgeted, pm: totalEstimated, net: totalCommitted, gross: totalSpent } = report.totals;
  const { pm: haulageEstimated, net: haulageActual } = report.unlinkedHaulage;
  const { pm: contraEstimateTotal, net: contraActualTotal } = report.contra;
  const rechargeables = prod.haulageMovements.filter((m) => m.rechargeable);
  const lineTotals = (line: BudgetLine) => {
    const l = report.lineById.get(line.id)!;
    return { movements: l.movements as HaulageMovement[], est: l.pm, com: l.net, spt: l.gross };
  };

  async function loadVariations(): Promise<ReportVariation[]> {
    try {
      const res = await fetch(`/api/budget-reallocation?productionId=${prod.id}`);
      if (res.ok) return await res.json();
    } catch {}
    return [];
  }

  async function runExport(kind: "pdf" | "xlsx") {
    const variations = await loadVariations();
    if (kind === "pdf") await exportBudgetPDF(prod.name, report, variations, prod.logoUrl);
    else await exportBudgetXLSX(prod.name, report, variations);
  }

  async function runClientReport(e: React.FormEvent) {
    e.preventDefault();
    if (!clientReport) return;
    setClientReport({ ...clientReport, busy: true });
    try {
      await exportClientBudgetPDF({
        productionName: prod.name, report, variations: await loadVariations(),
        rechargeables: prod.haulageMovements, note: clientReport.note, preparedBy: session?.user?.name ?? null,
      }, prod.logoUrl);
      setClientReport(null);
    } catch {
      setClientReport(c => c && { ...c, busy: false });
    }
  }

  return (
    <>
      {/* PSG's fee for this show: staff only (the panel also checks with the API) */}
      {(isAdmin || userRole === "member") && <PmFeePanel productionId={prod.id} startDate={prod.startDate} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Allocation", value: totalBudgeted, color: "text-white" },
          { label: "PM Budget", value: totalEstimated, color: "text-yellow-300" },
          { label: "Net Cost", value: totalCommitted, color: "text-orange-300" },
          { label: "Gross Cost", value: totalSpent, color: totalSpent > totalBudgeted ? "text-red-400" : "text-green-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--psg-muted)" }}>{label}</p>
            <p className={`text-xl font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 rounded-lg overflow-hidden border text-xs" style={{ borderColor: "var(--psg-card-border)" }}>
            {(["detail", "summary"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setBudgetView(v)}
                className="px-3 py-1.5 capitalize transition-colors"
                style={budgetView === v
                  ? { backgroundColor: "var(--psg-blue)", color: "#fff" }
                  : { backgroundColor: "transparent", color: "var(--psg-muted)" }}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <ExportMenu actions={[
              { label: "Export PDF", onClick: () => void runExport("pdf") },
              { label: "Export Excel", onClick: () => void runExport("xlsx") },
              { label: "Client report (PDF)…", onClick: () => setClientReport({ note: "", busy: false }) },
            ]} />
            <button onClick={() => setShowBudgetForm(true)} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
              + Add Department
            </button>
          </div>
        </div>

        {/* Summary view — department totals table */}
        {budgetView === "summary" && (
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <th className="px-4 py-3 text-left font-medium text-white">Department</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Allocation</th>
                  <th className="px-4 py-3 text-right font-medium text-yellow-300">PM Budget</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-300">Net Cost</th>
                  <th className="px-4 py-3 text-right font-medium text-green-400">Gross Cost</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: "var(--psg-muted)" }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {report.departments.map(({ name: dept, allocation, pm, net, gross }) => ({ dept, s: { budgeted: allocation, estimated: pm, committed: net, spent: gross } })).map(({ dept, s }) => (
                  <tr key={dept} className="border-t hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-2.5 text-white">{dept}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--psg-muted)" }}>{fmt(s.budgeted)}</td>
                    <td className="px-4 py-2.5 text-right text-yellow-300">{fmt(s.estimated)}</td>
                    <td className="px-4 py-2.5 text-right text-orange-300">{fmt(s.committed)}</td>
                    <td className="px-4 py-2.5 text-right text-green-400">{fmt(s.spent)}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${s.budgeted - s.committed < 0 ? "text-red-400" : "text-white/60"}`}>
                      {fmt(s.budgeted - s.committed)}
                    </td>
                  </tr>
                ))}
                {(haulageEstimated > 0 || haulageActual > 0) && (
                  <tr className="border-t" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(59,130,246,0.04)" }}>
                    <td className="px-4 py-2.5 text-white/70 text-xs italic">Haulage (from movements)</td>
                    <td className="px-4 py-2.5 text-right text-white/40 text-xs">—</td>
                    <td className="px-4 py-2.5 text-right text-yellow-300/70 text-xs">{haulageEstimated > 0 ? fmt(haulageEstimated) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-orange-300/70 text-xs">{haulageActual > 0 ? fmt(haulageActual) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-green-400/70 text-xs">—</td>
                    <td className="px-4 py-2.5 text-right text-white/40 text-xs">—</td>
                  </tr>
                )}
                {(contraEstimateTotal > 0 || contraActualTotal > 0) && (
                  <tr className="border-t" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(59,130,246,0.04)" }}>
                    <td className="px-4 py-2.5 text-white/70 text-xs italic">Venue contra</td>
                    <td className="px-4 py-2.5 text-right text-white/40 text-xs">—</td>
                    <td className="px-4 py-2.5 text-right text-yellow-300/70 text-xs">{contraEstimateTotal > 0 ? fmt(contraEstimateTotal) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-orange-300/70 text-xs">{contraActualTotal > 0 ? fmt(contraActualTotal) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-green-400/70 text-xs">—</td>
                    <td className="px-4 py-2.5 text-right text-white/40 text-xs">—</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <td className="px-4 py-3 font-semibold text-white">TOTAL</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">{fmt(totalBudgeted)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-yellow-300">{fmt(totalEstimated)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-300">{fmt(totalCommitted)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400">{fmt(totalSpent)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${totalBudgeted - totalCommitted < 0 ? "text-red-400" : "text-white/60"}`}>
                    {fmt(totalBudgeted - totalCommitted)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Detail view — grouped by department */}
        {budgetView === "detail" && (
          <div className="space-y-4">
            {prod.budgetLines.length === 0 && <p className="text-center py-10" style={{ color: "var(--psg-muted)" }}>No budget lines yet.</p>}
            {(() => {
              // Group lines by department
              const naturalOrder: string[] = [];
              const deptLines: Record<string, typeof prod.budgetLines> = {};
              for (const line of prod.budgetLines) {
                if (!deptLines[line.department]) { naturalOrder.push(line.department); deptLines[line.department] = []; }
                deptLines[line.department].push(line);
              }
              // Use saved order if available, else natural order
              const deptOrder = budgetDeptOrder
                ? [...budgetDeptOrder.filter(d => deptLines[d]), ...naturalOrder.filter(d => !budgetDeptOrder.includes(d))]
                : naturalOrder;
              return deptOrder.map((dept) => {
                const lines = deptLines[dept];
                // Aggregate figures for the department header
                const lineFigures = lines.map(lineTotals);
                const deptEst = sum(lineFigures, t => t.est);
                const deptCom = sum(lineFigures, t => t.com);
                const deptSpt = sum(lineFigures, t => t.spt);
                const deptAlloc = sum(lines, l => l.budgeted);
                const deptPct = deptAlloc > 0 ? Math.min((deptCom / deptAlloc) * 100, 100) : 0;
                const isDeptExpanded = expandedBudgetDepts.has(dept);
                const toggleDept = () => setExpandedBudgetDepts(s => toggled(s, dept));

                return (
                  <div
                    key={dept}
                    draggable
                    onDragStart={e => { e.stopPropagation(); setDragDept(dept); }}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={e => {
                      e.preventDefault(); e.stopPropagation();
                      if (!dragDept || dragDept === dept) { setDragDept(null); return; }
                      const fromIdx = deptOrder.indexOf(dragDept);
                      const toIdx = deptOrder.indexOf(dept);
                      if (fromIdx === -1 || toIdx === -1) { setDragDept(null); return; }
                      const next = [...deptOrder];
                      const [moved] = next.splice(fromIdx, 1);
                      next.splice(toIdx, 0, moved);
                      setBudgetDeptOrder(next);
                      try { localStorage.setItem(`budget-dept-order-${id}`, JSON.stringify(next)); } catch {}
                      setDragDept(null);
                    }}
                    onDragEnd={() => setDragDept(null)}
                    className={`rounded-lg border overflow-hidden transition-opacity ${dragDept === dept ? "opacity-40" : ""}`}
                    style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}
                  >
                    {/* Department header */}
                    <div
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 cursor-pointer select-none hover:bg-white/5 transition-colors"
                      style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                      onClick={toggleDept}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 basis-[12rem]">
                        <span className="text-xs shrink-0 cursor-grab active:cursor-grabbing opacity-30 hover:opacity-70 transition-opacity" style={{ color: "var(--psg-muted)" }} onClick={e => e.stopPropagation()}>⠿</span>
                        <span className="text-xs shrink-0 transition-transform" style={{ color: "var(--psg-muted)", transform: isDeptExpanded ? "rotate(90deg)" : "none" }}>▸</span>
                        {renamingDept === dept ? (
                          <form onSubmit={e => { e.preventDefault(); renameDepartment(dept, deptRenameValue, lines); }} onClick={e => e.stopPropagation()} className="flex items-center gap-2">
                            <input
                              autoFocus
                              className="text-sm font-semibold text-white rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)", border: "1px solid" }}
                              value={deptRenameValue}
                              onChange={e => setDeptRenameValue(e.target.value)}
                            />
                            <button type="submit" className="text-xs text-blue-400 hover:text-blue-300">Save</button>
                            <button type="button" onClick={() => setRenamingDept(null)} className="text-xs" style={{ color: "var(--psg-muted)" }}>Cancel</button>
                          </form>
                        ) : (
                          <span className="font-semibold text-sm text-white truncate">{dept}</span>
                        )}
                        <span className="text-xs shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "var(--psg-muted)" }}>{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs min-w-0">
                        <span className="font-semibold text-white">Alloc: {fmt(deptAlloc)}</span>
                        <span className={`font-semibold ${deptAlloc - deptCom < 0 ? "text-red-400" : "text-green-400"}`}>Remaining: {fmt(deptAlloc - deptCom)}</span>
                        <span className="w-0.5 h-4 rounded-full shrink-0" style={{ backgroundColor: "var(--psg-card-border)" }} />
                        <span className="text-yellow-300">PM: {fmt(deptEst)}</span>
                        <span className="text-orange-300">Net: {fmt(deptCom)}</span>
                        <span className="text-green-400">Gross: {fmt(deptSpt)}</span>
                        <span className="w-0.5 h-4 rounded-full shrink-0" style={{ backgroundColor: "var(--psg-card-border)" }} />
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setRenamingDept(dept); setDeptRenameValue(dept); }} className="text-xs border px-2 py-1 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
                          <button onClick={() => deleteDepartment(lines.map(l => l.id))} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      </div>
                    </div>
                    {/* Department progress bar */}
                    <div className="h-2" style={{ backgroundColor: "var(--psg-card-border)" }}>
                      <div className={`h-full transition-all ${deptPct >= 100 ? "bg-red-500" : deptPct >= 75 ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${deptPct}%` }} />
                    </div>

                    {/* Individual lines inside the department */}
                    {isDeptExpanded && lines.map((line) => {
                      const { movements: lineMovements, est: lineEst, com: lineCom, spt: lineSpt } = lineTotals(line);
                      const pct = line.budgeted > 0 ? Math.min((lineCom / line.budgeted) * 100, 100) : 0;
                      const byPhase = PHASES.reduce((acc, p) => {
                        acc[p] = line.expenses.filter((x) => !x.isPSGExpense && x.phase === p);
                        return acc;
                      }, {} as Record<string, Expense[]>);
                      const psgExpenses = line.expenses.filter((x) => x.isPSGExpense);
                      const isLineExpanded = expandedBudgetLines.has(line.id);
                      const toggleLine = () => setExpandedBudgetLines(s => toggled(s, line.id));

                      return (
                        <div key={line.id} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                          {/* Line row — click to expand expenses */}
                          <div
                            className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 cursor-pointer select-none hover:bg-white/5 transition-colors"
                            style={{ paddingLeft: "2rem" }}
                            onClick={toggleLine}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 basis-[12rem]">
                              <span className="text-xs shrink-0" style={{ color: "var(--psg-muted)", transform: isLineExpanded ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▸</span>
                              <span className="text-sm text-white truncate">{line.description}</span>
                              {line.notes?.trim() && <NotesPeek notes={line.notes} label={`Notes: ${line.description}`} />}
                              {line.nominalCode && <span className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "var(--psg-muted)" }}>{line.nominalCode}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs min-w-0">
                              <span className="text-white">Alloc: {fmt(line.budgeted)}</span>
                              <span className={pct >= 100 ? "text-red-400" : ""}>{Math.round(pct)}%</span>
                              <span className="w-0.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: "var(--psg-card-border)" }} />
                              <span className="text-yellow-300">PM: {fmt(lineEst)}</span>
                              <span className="text-orange-300">Net: {fmt(lineCom)}</span>
                              <span className="text-green-400">Gross: {fmt(lineSpt)}</span>
                            </div>
                            <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                              <button onClick={() => setSpendTarget({ lineId: line.id, expense: null })} className="text-xs border px-2 py-1 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "rgba(99,102,241,0.5)", color: "rgb(165,180,252)" }}>+ Spend</button>
                              <button onClick={() => { setPSGExpenseForm(BLANK_PSG_EXPENSE); setEditingPSGExpense(null); setPsgReceiptFile(null); setShowPSGExpenseForm(line.id); }} className="text-xs border px-2 py-1 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "rgba(99,102,241,0.5)", color: "rgb(165,180,252)" }}>+ PSG Expense</button>
                              <button onClick={() => { setEditBudgetLine(line); setBudgetForm({ department: line.department, description: line.description, nominalCode: line.nominalCode ?? "", budgeted: String(line.budgeted), notes: line.notes ?? "" }); setShowBudgetForm(true); }} className="text-xs border px-2 py-1 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
                              <button onClick={() => deleteBudgetLine(line.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                            </div>
                          </div>
                          {/* Line progress bar */}
                          <div className="h-1" style={{ backgroundColor: "var(--psg-card-border)", marginLeft: "2rem" }}>
                            <div className={`h-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${pct}%` }} />
                          </div>

                          {/* Expanded: expenses */}
                          {isLineExpanded && <>
                            {line.notes?.trim() && (
                              <div className="px-4 py-2 text-xs whitespace-pre-wrap border-t" style={{ paddingLeft: "2rem", borderColor: "var(--psg-card-border)", color: "var(--psg-muted)", backgroundColor: "rgba(251,191,36,0.05)" }}>
                                <span className="font-semibold" style={{ color: "#fbbf24" }}>Notes: </span>{line.notes}
                              </div>
                            )}
                            {/* Haulage movements linked to this budget line */}
                            {lineMovements.length > 0 && (
                              <div>
                                <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest border-t" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.04)" }}>
                                  Haulage Movements
                                </div>
                                <table className="w-full text-xs">
                                  <tbody>
                                    {lineMovements.map((m) => (
                                      <tr key={m.id} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                                        <td className="px-4 py-2 text-white w-1/4">{m.haulageCompany}</td>
                                        <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{m.fromLocation} → {m.toLocation}</td>
                                        <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{fmtDate(m.departureAt)}</td>
                                        <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{m.cargo || "—"}</td>
                                        <td className="px-3 py-2 text-right text-yellow-300 font-medium">{m.estimatedCost != null ? fmt(m.estimatedCost) : "—"}</td>
                                        <td className="px-3 py-2 text-right text-orange-300 font-medium">{m.actualCost != null ? fmt(m.actualCost) : "—"}</td>
                                        <td className="px-3 py-2 text-right">—</td>
                                        {m.rechargeable && <td className="px-2 py-2"><span className="text-orange-400 border border-orange-400/40 rounded px-1 py-0.5">Invoice</span></td>}
                                        {!m.rechargeable && <td className="px-2 py-2" />}
                                        <td className="px-3 py-2" />
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Line items grouped by phase */}
                            {PHASES.map((phase) => {
                              const items = byPhase[phase];
                              if (items.length === 0) return null;
                              return (
                                <div key={phase}>
                                  <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest border-t" style={{ borderColor: "var(--psg-card-border)", color: PHASE_COLORS[phase] ?? "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                                    {phase}
                                  </div>
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {items.map((x) => (
                                        <tr key={x.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                                          <td className="px-4 py-2 text-white w-1/4">{x.description}</td>
                                          <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.supplier || "—"}</td>
                                          <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.poNumber ? `PO: ${x.poNumber}` : ""}</td>
                                          <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.paymentDue ? fmtShortDate(x.paymentDue) : ""}</td>
                                          <td className="px-3 py-2 text-right text-yellow-300 font-medium">{x.estimated > 0 ? fmt(x.estimated) : "—"}</td>
                                          <td className="px-3 py-2 text-right text-orange-300 font-medium">{x.committed > 0 ? fmt(x.committed) : "—"}</td>
                                          <td className="px-3 py-2 text-right text-green-400 font-medium">{x.spent > 0 ? fmt(x.spent) : "—"}</td>
                                          <td className="px-3 py-2">
                                            <button
                                              onClick={() => toggleIssued(x)}
                                              className={`px-2 py-0.5 rounded-full ${x.issuedForPayment ? "bg-green-900/60 text-green-300" : "bg-white/10 text-white/40"}`}
                                            >
                                              {x.issuedForPayment ? "Issued" : "Pending"}
                                            </button>
                                          </td>
                                          {x.vatExempt && <td className="px-2 py-2 text-white/30 text-xs">No VAT</td>}
                                          {!x.vatExempt && <td className="px-2 py-2" />}
                                          <td className="px-3 py-2 opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                                            <button onClick={() => setSpendTarget({ lineId: line.id, expense: x })} className="text-blue-400 hover:text-blue-300">Edit</button>
                                            <button onClick={() => deleteExpense(x.id)} className="text-red-400 hover:text-red-300">×</button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })}

                            {/* PSG Expenses section */}
                            {psgExpenses.length > 0 && (
                              <div>
                                <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest border-t" style={{ borderColor: "var(--psg-card-border)", color: "rgb(165,180,252)", backgroundColor: "rgba(99,102,241,0.06)" }}>
                                  PSG Expenses
                                </div>
                                <table className="w-full text-xs">
                                  <tbody>
                                    {psgExpenses.map((x) => (
                                      <tr key={x.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                                        <td className="px-4 py-2 text-white w-1/4">{x.description}</td>
                                        <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.supplier || "—"}</td>
                                        <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.paymentMethod || "—"}</td>
                                        <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.paymentDue ? fmtShortDate(x.paymentDue) : ""}</td>
                                        <td className="px-3 py-2 text-right" />
                                        <td className="px-3 py-2 text-right text-orange-300 font-medium">{x.committed > 0 ? fmt(x.committed) : "—"}</td>
                                        <td className="px-3 py-2 text-right text-green-400 font-medium">{x.spent > 0 ? fmt(x.spent) : "—"}</td>
                                        <td className="px-3 py-2" />
                                        <td className="px-3 py-2 opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                                          <button onClick={() => { setPSGExpenseForm({ description: x.description, supplier: x.supplier ?? "", committed: String(x.committed), spent: String(x.spent), paymentDue: x.paymentDue ? x.paymentDue.slice(0, 10) : "", notes: x.notes ?? "", paymentMethod: x.paymentMethod ?? "", id: x.id }); setEditingPSGExpense(x); setPsgReceiptFile(null); setShowPSGExpenseForm(null); }} className="text-blue-400 hover:text-blue-300">Edit</button>
                                          <button onClick={() => deletePSGExpense(x.id)} className="text-red-400 hover:text-red-300">×</button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Venue Contra section */}
        {tourStops.length > 0 && (
          <div>
            <button onClick={() => setShowContra(v => !v)} className="flex items-center gap-2 mb-3 hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>
              <span className="text-xs">{showContra ? "▾" : "▸"}</span>
              <span className="text-sm font-semibold text-white">Venue Contra</span>
              <span className="text-xs">{fmt(contraEstimateTotal)} est · {fmt(contraActualTotal)} act</span>
            </button>
            {showContra && <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--psg-card-border)" }}>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Venue</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Estimate</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {[...tourStops].sort((a, b) => a.stopNumber - b.stopNumber).map((stop, i) => (
                    <tr key={stop.id} style={{ borderTop: i > 0 ? "1px solid var(--psg-card-border)" : undefined }}>
                      <td className="px-4 py-3 text-white">
                        <span className="text-xs mr-2 font-mono" style={{ color: "var(--psg-muted)" }}>#{stop.stopNumber}</span>
                        {stop.venue.name}{stop.venue.city ? `, ${stop.venue.city}` : ""}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-yellow-300">{stop.contraEstimate != null ? fmt(stop.contraEstimate) : <span style={{ color: "var(--psg-muted)" }}>—</span>}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-orange-300">{stop.contraActual != null ? fmt(stop.contraActual) : <span style={{ color: "var(--psg-muted)" }}>—</span>}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-yellow-300">{fmt(contraEstimateTotal)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-300">{fmt(contraActualTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>}
          </div>
        )}

        {/* Budget Reallocation panel */}
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          <BudgetReallocationPanel
            productionId={prod.id}
            budgetLines={prod.budgetLines.map(l => ({ id: l.id, department: l.department, description: l.description }))}
            isAdmin={isAdmin}
            canApprove={isAdmin || userRole === "client"}
          />
        </div>

        {/* Rechargeable haulage panel */}
        {rechargeables.length > 0 && (
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "rgba(251,146,60,0.4)" }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "rgba(251,146,60,0.08)", borderBottom: "1px solid rgba(251,146,60,0.3)" }}>
              <span className="text-orange-400 font-semibold text-sm">Rechargeables — Pending Client Invoice</span>
              <span className="ml-auto text-xs text-orange-400/70">{rechargeables.length} movement{rechargeables.length !== 1 ? "s" : ""}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Company</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Route</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Cargo</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Date</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Actual Cost</th>
                </tr>
              </thead>
              <tbody>
                {rechargeables.map((m) => (
                  <tr key={m.id} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-2.5 text-white">{m.haulageCompany}</td>
                    <td className="px-4 py-2.5" style={{ color: "var(--psg-muted)" }}>{m.fromLocation} → {m.toLocation}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--psg-muted)" }}>{m.cargo || "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--psg-muted)" }}>{fmtDate(m.departureAt)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-orange-400">{m.actualCost != null ? fmt(m.actualCost) : <span style={{ color: "var(--psg-muted)" }}>TBC</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(251,146,60,0.3)", backgroundColor: "rgba(251,146,60,0.06)" }}>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-orange-400">Total to invoice</td>
                  <td className="px-4 py-2.5 text-right font-bold text-orange-400">{fmt(sum(rechargeables, m => m.actualCost ?? 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {clientReport && (
        <Modal title="Client budget report" onClose={() => setClientReport(null)}>
          <form onSubmit={runClientReport} className="space-y-3">
            <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
              A PDF for the client: totals by department and budget line, approved and pending variations, and rechargeables still to be invoiced. Suppliers, POs and individual items aren&apos;t included.
            </p>
            <F label="Covering note (optional)">
              <textarea rows={5} className={inp} style={inpStyle} value={clientReport.note} maxLength={2000}
                onChange={(e) => setClientReport(c => c && { ...c, note: e.target.value })}
                placeholder="e.g. Scenery is over following the agreed change to the truck pack; we expect to recover this from the paint call." />
            </F>
            <Btns onCancel={() => setClientReport(null)} label={clientReport.busy ? "Creating…" : "Create PDF"} />
          </form>
        </Modal>
      )}
      {showBudgetForm && (
        <Modal title={editBudgetLine ? "Edit Budget Line" : "Add Budget Department"} onClose={closeBudgetForm}>
          <form onSubmit={saveBudgetLine} className="space-y-3">
            <F label="Department">
              <input list="budget-departments" required className={inp} style={inpStyle} value={budgetForm.department} onChange={(e) => setBudgetForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Scenery" />
              <datalist id="budget-departments">
                {Array.from(new Set([...DEPARTMENTS, ...prod.budgetLines.map(l => l.department)])).map(d => <option key={d} value={d} />)}
              </datalist>
            </F>
            <F label="Description *"><input required className={inp} style={inpStyle} value={budgetForm.description} onChange={(e) => setBudgetForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Sound Hires" /></F>
            <F label="Nominal Code"><input className={inp} style={inpStyle} value={budgetForm.nominalCode} onChange={(e) => setBudgetForm((f) => ({ ...f, nominalCode: e.target.value }))} placeholder="e.g. 4100" /></F>
            <F label="Overall Allocation (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={budgetForm.budgeted} onChange={(e) => setBudgetForm((f) => ({ ...f, budgeted: e.target.value }))} /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={budgetForm.notes} onChange={(e) => setBudgetForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={closeBudgetForm} label={editBudgetLine ? "Save Changes" : "Add"} />
          </form>
        </Modal>
      )}
      {/* Modal: Add / Edit Spend Item */}
      {spendTarget && (
        <BudgetSpendModal lineId={spendTarget.lineId} expense={spendTarget.expense}
          onClose={() => setSpendTarget(null)}
          onSaved={() => { setSpendTarget(null); reload(); }} />
      )}

      {/* Modal: Add / Edit PSG Expense */}
      {(showPSGExpenseForm !== null || editingPSGExpense !== null) && (
        <Modal title={editingPSGExpense ? "Edit PSG Expense" : "Add PSG Expense"} onClose={closePSGForm}>
          <form onSubmit={savePSGExpense} className="space-y-3">
            <F label="Description *"><input required className={inp} style={inpStyle} value={psgExpenseForm.description} onChange={(e) => setPSGExpenseForm(f => ({ ...f, description: e.target.value }))} /></F>
            <F label="Supplier"><input className={inp} style={inpStyle} value={psgExpenseForm.supplier} onChange={(e) => setPSGExpenseForm(f => ({ ...f, supplier: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Net Cost (£)"><input type="number" min="0" step="0.01" className={inp} style={inpStyle} value={psgExpenseForm.committed} onChange={(e) => setPSGExpenseForm(f => ({ ...f, committed: e.target.value }))} placeholder="0.00" /></F>
              <F label="Gross Cost (£)"><input type="number" min="0" step="0.01" className={inp} style={inpStyle} value={psgExpenseForm.spent} onChange={(e) => setPSGExpenseForm(f => ({ ...f, spent: e.target.value }))} placeholder="0.00" /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Payment Date"><input type="date" className={inp} style={inpStyle} value={psgExpenseForm.paymentDue} onChange={(e) => setPSGExpenseForm(f => ({ ...f, paymentDue: e.target.value }))} /></F>
              <F label="Payment Method">
                <select className={inp} style={inpStyle} value={PSG_PAYMENT_METHODS.includes(psgExpenseForm.paymentMethod) || psgExpenseForm.paymentMethod === "" ? psgExpenseForm.paymentMethod : "Other"} onChange={(e) => setPSGExpenseForm(f => ({ ...f, paymentMethod: e.target.value === "Other" ? "" : e.target.value }))}>
                  <option value="">— select —</option>
                  {[...PSG_PAYMENT_METHODS, "Other"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {![...PSG_PAYMENT_METHODS, ""].includes(psgExpenseForm.paymentMethod) && (
                  <input className={`${inp} mt-1`} style={inpStyle} placeholder="Specify payment method…" value={psgExpenseForm.paymentMethod} onChange={(e) => setPSGExpenseForm(f => ({ ...f, paymentMethod: e.target.value }))} />
                )}
              </F>
            </div>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={psgExpenseForm.notes} onChange={(e) => setPSGExpenseForm(f => ({ ...f, notes: e.target.value }))} /></F>
            <F label="Receipt / Invoice">
              <input type="file" accept="image/*,application/pdf" className={inp} style={inpStyle} onChange={(e) => setPsgReceiptFile(e.target.files?.[0] ?? null)} />
              {psgReceiptFile && <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>{psgReceiptFile.name}</p>}
            </F>
            <Btns onCancel={closePSGForm} label={editingPSGExpense ? "Save Changes" : "Add PSG Expense"} />
          </form>
        </Modal>
      )}
    </>
  );
}
