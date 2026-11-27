// Won deal → production: the form that creates a production with its PM fee payment stages.
import { useRouter } from "next/navigation";
import { alertDialog } from "@/components/Dialogs";
import { PRODUCTION_TYPES, inp, inpStyle, fmtValue, stagesFor, type ConvertForm, type Opportunity } from "./bdTypes";

export type ConvertState = { opp: Opportunity; form: ConvertForm; saving: boolean };

export default function ConvertProductionModal({ convert, setConvert }: {
  convert: ConvertState;
  setConvert: React.Dispatch<React.SetStateAction<ConvertState | null>>;
}) {
  const router = useRouter();

  async function saveConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!convert) return;
    setConvert({ ...convert, saving: true });
    const res = await fetch(`/api/opportunities/${convert.opp.id}/convert`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(convert.form),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setConvert(c => c && { ...c, saving: false });
      await alertDialog(body.error ?? "Couldn't create the production");
      return;
    }
    router.push(`/productions/${body.id}?section=budget`);
  }

  const setConvertForm = (patch: Partial<ConvertForm>) => setConvert(c => c && { ...c, form: { ...c.form, ...patch } });
  const setStage = (i: number, patch: Partial<ConvertForm["stages"][number]>) =>
    setConvert(c => c && { ...c, form: { ...c.form, stages: c.form.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) } });

  const f = convert.form;
  const stagesTotal = f.stages.reduce((sum, st) => sum + (Number(st.amount) || 0), 0);
  const fee = Number(f.pmFee) || 0;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl shadow-2xl w-full max-w-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
          <h2 className="font-semibold text-white">Create production from won deal</h2>
          <button onClick={() => setConvert(null)} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
        </div>
        <form onSubmit={saveConvert} className="px-5 py-4 max-h-[75vh] overflow-y-auto space-y-3">
          <p className="text-xs" style={{ color: "var(--psg-muted)" }}>
            The production takes the deal&apos;s client{convert.opp.entity ? ` and entity (${convert.opp.entity.name})` : ""}, and you{convert.opp.owner ? ` and ${convert.opp.owner.name}` : ""} go on its team.
          </p>
          <div>
            <label htmlFor="cv-name" className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Production name *</label>
            <input id="cv-name" required className={inp} style={inpStyle} value={f.name} onChange={e => setConvertForm({ name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cv-type" className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
              <select id="cv-type" className={inp} style={inpStyle} value={f.type} onChange={e => setConvertForm({ type: e.target.value })}>
                {PRODUCTION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cv-venue" className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Venue</label>
              <input id="cv-venue" className={inp} style={inpStyle} value={f.venue} onChange={e => setConvertForm({ venue: e.target.value })} />
            </div>
            <div>
              <label htmlFor="cv-start" className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Start date</label>
              <input id="cv-start" type="date" className={inp} style={inpStyle} value={f.startDate}
                onChange={e => {
                  const startDate = e.target.value;
                  // Fit-up and opening follow the start date until someone sets them by hand
                  setConvertForm({ startDate, stages: f.stages.map((st, i) => (i > 0 && (!st.dueDate || st.dueDate === f.startDate) ? { ...st, dueDate: startDate } : st)) });
                }} />
            </div>
            <div>
              <label htmlFor="cv-end" className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>End date</label>
              <input id="cv-end" type="date" className={inp} style={inpStyle} value={f.endDate} onChange={e => setConvertForm({ endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label htmlFor="cv-fee" className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>PM fee (£)</label>
            <div className="flex gap-2">
              <input id="cv-fee" type="number" min={0} className={inp} style={inpStyle} value={f.pmFee} onChange={e => setConvertForm({ pmFee: e.target.value })} />
              <button type="button" onClick={() => setConvertForm({ stages: stagesFor(f.pmFee, f.startDate) })} className="shrink-0 border px-3 rounded text-xs hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                Split 30/40/30
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Payment stages</div>
            <div className="space-y-2">
              {f.stages.map((st, i) => (
                <div key={i} className="grid gap-2" style={{ gridTemplateColumns: "1fr 7rem 9rem auto" }}>
                  <input aria-label="Stage name" className={inp} style={inpStyle} value={st.label} onChange={e => setStage(i, { label: e.target.value })} />
                  <input aria-label={`${st.label} amount`} type="number" min={0} className={inp} style={inpStyle} value={st.amount} onChange={e => setStage(i, { amount: e.target.value })} />
                  <input aria-label={`${st.label} due date`} type="date" className={inp} style={inpStyle} value={st.dueDate} onChange={e => setStage(i, { dueDate: e.target.value })} />
                  <button type="button" aria-label={`Remove ${st.label}`} onClick={() => setConvertForm({ stages: f.stages.filter((_, j) => j !== i) })} className="text-red-400 text-sm px-1">×</button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <button type="button" onClick={() => setConvertForm({ stages: [...f.stages, { label: "", amount: "", dueDate: "" }] })} className="text-xs text-blue-400">+ Add stage</button>
              <span className="text-xs" style={{ color: Math.round(stagesTotal) === Math.round(fee) ? "var(--psg-muted)" : "#fbbf24" }}>
                Stages total {fmtValue(stagesTotal) ?? "£0"}{Math.round(stagesTotal) !== Math.round(fee) ? ` (fee is ${fmtValue(fee) ?? "£0"})` : ""}
              </span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={convert.saving} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#10b981" }}>
              {convert.saving ? "Creating…" : "Create production"}
            </button>
            <button type="button" onClick={() => setConvert(null)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
