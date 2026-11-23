"use client";

import { useState } from "react";
import ExportMenu from "@/components/ExportMenu";
import { exportCrewPDF, exportCrewXLSX } from "@/lib/exports";
import { confirmDialog } from "@/components/Dialogs";
import { F, Modal, Btns, inp, inpStyle, fmt, fmtShortDate, sendJson, useList, type CrewMember, type TabProps } from "../shared";

export default function CrewTab({ prod, reload }: TabProps) {
  const id = String(prod.id);
  const [allCrew] = useList<CrewMember>("/api/crew");
  const BLANK_CREW = { crewId: "", role: "", startDate: "", endDate: "", dayRate: "", notes: "" };
  const [showCrewForm, setShowCrewForm] = useState(false);
  const [crewForm, setCrewForm] = useState(BLANK_CREW);

  async function saveCrewAssignment(e: React.FormEvent) {
    e.preventDefault();
    await sendJson(`/api/productions/${id}/crew`, "POST", crewForm);
    setShowCrewForm(false);
    setCrewForm(BLANK_CREW);
    reload();
  }

  async function removeCrewFromProduction(pcId: number, name: string) {
    if (!await confirmDialog(`Remove ${name} from this production?`)) return;
    await fetch(`/api/production-crew/${pcId}`, { method: "DELETE" });
    reload();
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <ExportMenu actions={[
            { label: "Export PDF", onClick: () => exportCrewPDF(prod.name, prod.crew.map((pc) => pc.crew), prod.logoUrl) },
            { label: "Export Excel", onClick: () => void exportCrewXLSX(prod.name, prod.crew.map((pc) => pc.crew)) },
          ]} />
          <button onClick={() => setShowCrewForm(true)} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
            + Add Crew Member
          </button>
        </div>
        {prod.crew.length === 0 ? (
          <p className="text-center py-10" style={{ color: "var(--psg-muted)" }}>No crew assigned to this production yet.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <th className="px-4 py-3 text-left font-medium text-white">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Role on This Show</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Dates</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Day Rate</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Contact</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Insurance</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {prod.crew.map((pc) => {
                  const insExpired = pc.crew.insuranceExpiry && new Date(pc.crew.insuranceExpiry) < new Date();
                  const insExpiringSoon = !insExpired && pc.crew.insuranceExpiry && (new Date(pc.crew.insuranceExpiry).getTime() - Date.now()) < 60 * 24 * 60 * 60 * 1000;
                  return (
                    <tr key={pc.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                      <td className="px-4 py-3">
                        <a href={`/crew/${pc.crewId}`} className="font-medium text-white hover:underline">{pc.crew.name}</a>
                        <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{pc.crew.discipline}</p>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{pc.role || pc.crew.discipline}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                        {pc.startDate ? fmtShortDate(pc.startDate) : "—"} → {pc.endDate ? fmtShortDate(pc.endDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>
                        {pc.dayRate ? fmt(pc.dayRate) + "/day" : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                        {pc.crew.email && <div>{pc.crew.email}</div>}
                        {pc.crew.phone && <div>{pc.crew.phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {pc.crew.insuranceExpiry ? (
                          <span className={`px-2 py-0.5 rounded-full font-medium ${insExpired ? "bg-red-900/60 text-red-300" : insExpiringSoon ? "bg-yellow-900/60 text-yellow-300" : "bg-green-900/40 text-green-400"}`}>
                            {insExpired ? "Expired" : insExpiringSoon ? "Expiring" : "Valid"}
                          </span>
                        ) : <span style={{ color: "var(--psg-muted)" }}>—</span>}
                      </td>
                      <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => removeCrewFromProduction(pc.id, pc.crew.name)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showCrewForm && (
        <Modal title="Add Crew to Production" onClose={() => setShowCrewForm(false)}>
          <form onSubmit={saveCrewAssignment} className="space-y-3">
            <F label="Crew Member *">
              <select required className={inp} style={inpStyle} value={crewForm.crewId} onChange={(e) => setCrewForm((f) => ({ ...f, crewId: e.target.value }))}>
                <option value="">— select —</option>
                {allCrew.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.discipline}</option>
                ))}
              </select>
            </F>
            <F label="Role on this Production">
              <input className={inp} style={inpStyle} value={crewForm.role} onChange={(e) => setCrewForm((f) => ({ ...f, role: e.target.value }))} placeholder="Leave blank to use their discipline" />
            </F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Start Date"><input type="date" className={inp} style={inpStyle} value={crewForm.startDate} onChange={(e) => setCrewForm((f) => ({ ...f, startDate: e.target.value }))} /></F>
              <F label="End Date"><input type="date" className={inp} style={inpStyle} value={crewForm.endDate} onChange={(e) => setCrewForm((f) => ({ ...f, endDate: e.target.value }))} /></F>
            </div>
            <F label="Day Rate (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={crewForm.dayRate} onChange={(e) => setCrewForm((f) => ({ ...f, dayRate: e.target.value }))} /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={crewForm.notes} onChange={(e) => setCrewForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => setShowCrewForm(false)} label="Add to Production" />
          </form>
        </Modal>
      )}
    </>
  );
}
