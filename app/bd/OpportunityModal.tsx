// Add / edit opportunity form modal.
import { STAGES, LEAD_SOURCES } from "@/lib/bdPipeline";
import { OPP_TYPES, BLANK_OPP, inp, inpStyle, type Client, type EntityOption, type Opportunity, type UserOption } from "./bdTypes";

export default function OpportunityModal({ editOpp, oppForm, setOppForm, setShowOppForm, saveOpp, clients, entities, staff }: {
  editOpp: Opportunity | null;
  oppForm: typeof BLANK_OPP & { id?: number };
  setOppForm: React.Dispatch<React.SetStateAction<typeof BLANK_OPP & { id?: number }>>;
  setShowOppForm: (show: boolean) => void;
  saveOpp: (e: React.FormEvent) => void;
  clients: Client[];
  entities: EntityOption[];
  staff: UserOption[];
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl shadow-2xl w-full max-w-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
          <h2 className="font-semibold text-white">{editOpp ? "Edit Opportunity" : "New Opportunity"}</h2>
          <button onClick={() => { setShowOppForm(false); }} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          <form onSubmit={saveOpp} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Title *</label>
              <input required className={inp} style={inpStyle} value={oppForm.title} onChange={e => setOppForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
                <select className={inp} style={inpStyle} value={oppForm.type} onChange={e => setOppForm(f => ({ ...f, type: e.target.value }))}>
                  {OPP_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Stage</label>
                <select className={inp} style={inpStyle} value={oppForm.stage} onChange={e => setOppForm(f => ({ ...f, stage: e.target.value }))}>
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Value (£)</label>
                <input type="number" className={inp} style={inpStyle} value={oppForm.value} onChange={e => setOppForm(f => ({ ...f, value: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Close date</label>
                <input type="date" className={inp} style={inpStyle} value={oppForm.closeDate} onChange={e => setOppForm(f => ({ ...f, closeDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Client</label>
              <select className={inp} style={inpStyle} value={oppForm.clientId} onChange={e => setOppForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">— None —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Entity</label>
                <select className={inp} style={inpStyle} value={oppForm.entityId} onChange={e => setOppForm(f => ({ ...f, entityId: e.target.value }))}>
                  <option value="">— None —</option>
                  {entities.filter(en => !en.archived || String(en.id) === oppForm.entityId).map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
                </select>
                {entities.length === 0 && <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>Admins add entities in Hub Settings</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Owner</label>
                <select className={inp} style={inpStyle} value={oppForm.ownerUserId} onChange={e => setOppForm(f => ({ ...f, ownerUserId: e.target.value }))}>
                  <option value="">{editOpp ? "— None —" : "Me"}</option>
                  {staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Chance of winning (%)</label>
                <input type="number" min={0} max={100} className={inp} style={inpStyle} value={oppForm.probability} onChange={e => setOppForm(f => ({ ...f, probability: e.target.value }))}
                  placeholder={`${STAGES.find(st => st.key === oppForm.stage)?.weight ?? 0} (stage default)`} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Next follow-up</label>
                <input type="date" className={inp} style={inpStyle} value={oppForm.followUpDate} onChange={e => setOppForm(f => ({ ...f, followUpDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bd-tender" className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Tender deadline</label>
                <input id="bd-tender" type="date" className={inp} style={inpStyle} value={oppForm.tenderDeadline} onChange={e => setOppForm(f => ({ ...f, tenderDeadline: e.target.value }))} />
                <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>The owner is reminded 7, 3 and 1 days before, and on the day.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Lead source</label>
                <input list="bd-lead-sources" className={inp} style={inpStyle} value={oppForm.leadSource} onChange={e => setOppForm(f => ({ ...f, leadSource: e.target.value }))} placeholder="e.g. Referral" />
                <datalist id="bd-lead-sources">{LEAD_SOURCES.map(l => <option key={l} value={l} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Competitor</label>
                <input className={inp} style={inpStyle} value={oppForm.competitor} onChange={e => setOppForm(f => ({ ...f, competitor: e.target.value }))} placeholder="Who else is bidding" />
              </div>
            </div>
            {(oppForm.stage === "won" || oppForm.stage === "lost") && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{oppForm.stage === "won" ? "Why we won" : "Why we lost"}</label>
                <textarea rows={2} className={inp} style={inpStyle} value={oppForm.lostReason} onChange={e => setOppForm(f => ({ ...f, lostReason: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Description</label>
              <textarea rows={2} className={inp} style={inpStyle} value={oppForm.description} onChange={e => setOppForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
              <textarea rows={2} className={inp} style={inpStyle} value={oppForm.notes} onChange={e => setOppForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>
                {editOpp ? "Save" : "Add Opportunity"}
              </button>
              <button type="button" onClick={() => setShowOppForm(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
