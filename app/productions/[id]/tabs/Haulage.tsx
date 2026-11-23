"use client";

import { useState } from "react";
import ExportMenu from "@/components/ExportMenu";
import { exportHaulagePDF, exportHaulageXLSX } from "@/lib/exports";
import { confirmDialog } from "@/components/Dialogs";
import { F, Modal, Btns, inp, inpStyle, fmt, fmtDate, fmtTime, sendJson, type HaulageMovement, type TabProps } from "../shared";

export default function HaulageTab({ prod, reload }: TabProps) {
  const id = String(prod.id);
  const BLANK_MOVEMENT = { haulageCompany: "", driverName: "", vehicleInfo: "", fromLocation: "", toLocation: "", departureAt: "", arrivalAt: "", cargo: "", notes: "", estimatedCost: "", actualCost: "", rechargeable: false, budgetLineId: "" };
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [editMovement, setEditMovement] = useState<HaulageMovement | null>(null);
  const [movementForm, setMovementForm] = useState<typeof BLANK_MOVEMENT & { id?: number }>(BLANK_MOVEMENT);

  function closeMovementForm() {
    setShowMovementForm(false);
    setEditMovement(null);
    setMovementForm(BLANK_MOVEMENT);
  }

  async function saveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (movementForm.id) {
      await sendJson(`/api/haulage/${movementForm.id}`, "PUT", movementForm);
    } else {
      await sendJson(`/api/productions/${id}/haulage`, "POST", movementForm);
    }
    closeMovementForm();
    reload();
  }

  async function deleteMovement(mid: number) {
    if (!await confirmDialog("Delete this movement?")) return;
    await fetch(`/api/haulage/${mid}`, { method: "DELETE" });
    reload();
  }

  function openEditMovement(m: HaulageMovement) {
    setMovementForm({ ...m, id: m.id, driverName: m.driverName ?? "", vehicleInfo: m.vehicleInfo ?? "", departureAt: m.departureAt.slice(0, 16), arrivalAt: m.arrivalAt ? m.arrivalAt.slice(0, 16) : "", cargo: m.cargo ?? "", notes: m.notes ?? "", estimatedCost: m.estimatedCost != null ? String(m.estimatedCost) : "", actualCost: m.actualCost != null ? String(m.actualCost) : "", rechargeable: m.rechargeable, budgetLineId: m.budgetLineId != null ? String(m.budgetLineId) : "" });
    setEditMovement(m);
    setShowMovementForm(true);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <ExportMenu actions={[
            { label: "Export PDF", onClick: () => exportHaulagePDF(prod.name, prod.haulageMovements, false, prod.logoUrl) },
            { label: "Export Excel", onClick: () => void exportHaulageXLSX(prod.name, prod.haulageMovements) },
          ]} />
          <button onClick={() => { setMovementForm(BLANK_MOVEMENT); setEditMovement(null); setShowMovementForm(true); }} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
            + Add Movement
          </button>
        </div>
        {prod.haulageMovements.length === 0 ? (
          <p className="text-center py-10" style={{ color: "var(--psg-muted)" }}>No haulage movements recorded yet.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <th className="px-4 py-3 text-left font-medium text-white">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-white">From</th>
                  <th className="px-4 py-3 text-left font-medium text-white">To</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Departure</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Arrival</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Driver / Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Cargo</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Estimated</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Actual</th>
                  <th className="px-4 py-3 text-center font-medium text-white">Recharge</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {prod.haulageMovements.map((m) => (
                  <tr key={m.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-3 font-medium text-white">{m.haulageCompany}</td>
                    <td className="px-4 py-3 text-white">{m.fromLocation}</td>
                    <td className="px-4 py-3 text-white">{m.toLocation}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>
                      <div>{fmtDate(m.departureAt)}</div>
                      <div className="text-xs">{fmtTime(m.departureAt)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>
                      {m.arrivalAt ? (
                        <>
                          <div>{fmtDate(m.arrivalAt)}</div>
                          <div className="text-xs">{fmtTime(m.arrivalAt)}</div>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                      {m.driverName && <div>{m.driverName}</div>}
                      {m.vehicleInfo && <div>{m.vehicleInfo}</div>}
                      {!m.driverName && !m.vehicleInfo && "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{m.cargo || "—"}</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: "var(--psg-muted)" }}>{m.estimatedCost != null ? fmt(m.estimatedCost) : "—"}</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: "var(--psg-muted)" }}>{m.actualCost != null ? fmt(m.actualCost) : "—"}</td>
                    <td className="px-4 py-3 text-center">{m.rechargeable && <span className="inline-block text-xs font-semibold text-orange-400 border border-orange-400/40 rounded px-1.5 py-0.5">Invoice</span>}</td>
                    <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-2">
                        <button onClick={() => openEditMovement(m)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                        <button onClick={() => deleteMovement(m.id)} className="text-xs text-red-400 hover:text-red-300">×</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showMovementForm && (
        <Modal title={editMovement ? "Edit Movement" : "Add Haulage Movement"} onClose={closeMovementForm}>
          <form onSubmit={saveMovement} className="space-y-3">
            <F label="Haulage Company *"><input required className={inp} style={inpStyle} value={movementForm.haulageCompany} onChange={(e) => setMovementForm((f) => ({ ...f, haulageCompany: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="From *"><input required className={inp} style={inpStyle} value={movementForm.fromLocation} onChange={(e) => setMovementForm((f) => ({ ...f, fromLocation: e.target.value }))} /></F>
              <F label="To *"><input required className={inp} style={inpStyle} value={movementForm.toLocation} onChange={(e) => setMovementForm((f) => ({ ...f, toLocation: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Departure *"><input required type="datetime-local" className={inp} style={inpStyle} value={movementForm.departureAt} onChange={(e) => setMovementForm((f) => ({ ...f, departureAt: e.target.value }))} /></F>
              <F label="Arrival"><input type="datetime-local" className={inp} style={inpStyle} value={movementForm.arrivalAt} onChange={(e) => setMovementForm((f) => ({ ...f, arrivalAt: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Driver Name"><input className={inp} style={inpStyle} value={movementForm.driverName} onChange={(e) => setMovementForm((f) => ({ ...f, driverName: e.target.value }))} /></F>
              <F label="Vehicle Info"><input className={inp} style={inpStyle} value={movementForm.vehicleInfo} onChange={(e) => setMovementForm((f) => ({ ...f, vehicleInfo: e.target.value }))} placeholder="e.g. 7.5t curtainside" /></F>
            </div>
            <F label="Cargo / Description"><input className={inp} style={inpStyle} value={movementForm.cargo} onChange={(e) => setMovementForm((f) => ({ ...f, cargo: e.target.value }))} placeholder="e.g. Scenery and rigging" /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={movementForm.notes} onChange={(e) => setMovementForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Estimated Cost (£)"><input type="number" min="0" step="0.01" className={inp} style={inpStyle} value={movementForm.estimatedCost} onChange={(e) => setMovementForm((f) => ({ ...f, estimatedCost: e.target.value }))} placeholder="0.00" /></F>
              <F label="Actual Cost (£)"><input type="number" min="0" step="0.01" className={inp} style={inpStyle} value={movementForm.actualCost} onChange={(e) => setMovementForm((f) => ({ ...f, actualCost: e.target.value }))} placeholder="0.00" /></F>
            </div>
            <F label="Budget Line">
              <select className={inp} style={inpStyle} value={movementForm.budgetLineId} onChange={(e) => setMovementForm((f) => ({ ...f, budgetLineId: e.target.value }))}>
                <option value="">— not linked to a budget line —</option>
                {prod.budgetLines.map((l) => (
                  <option key={l.id} value={l.id}>{l.department} · {l.description}</option>
                ))}
              </select>
            </F>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 rounded accent-orange-400" checked={movementForm.rechargeable} onChange={(e) => setMovementForm((f) => ({ ...f, rechargeable: e.target.checked }))} />
              <span className="text-sm font-medium" style={{ color: "var(--psg-muted)" }}>Rechargeable to client</span>
              {movementForm.rechargeable && <span className="text-xs font-semibold text-orange-400 ml-1">— will appear in Finance as pending invoice</span>}
            </label>
            <Btns onCancel={closeMovementForm} label={editMovement ? "Save Changes" : "Add Movement"} />
          </form>
        </Modal>
      )}
    </>
  );
}
