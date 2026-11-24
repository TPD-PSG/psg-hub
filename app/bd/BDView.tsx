"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { confirmDialog } from "@/components/Dialogs";
import { fmtDate as fmtDateShared, fmtDateTime } from "@/lib/format";
import { STAGES, ACTIVITY_KINDS, LEAD_SOURCES, weightPct, weightedValue, stuckReason, isOpen } from "@/lib/bdPipeline";
import { splitFee, type FeeStageInput } from "@/lib/feeStages";
import { alertDialog } from "@/components/Dialogs";
const fmtDate = (s: string | null) => (s ? fmtDateShared(s) : null);

export type Client = {
  id: number; name: string; type: string; website?: string | null; address?: string | null; notes?: string | null;
  billingName?: string | null; billingAddress?: string | null; billingEmail?: string | null;
  targetAccount?: boolean; targetOwner?: { id: number; name: string } | null; targetSource?: string | null;
  opportunities?: { id: number; stage: string }[];
};
type BDTask = { id: number; description: string; dueDate: string | null; completedAt: string | null };
export type Opportunity = {
  id: number; title: string; type: string; stage: string;
  value: number | null; clientId: number | null; client: Client | null;
  description: string | null; closeDate: string | null; lostReason: string | null; notes: string | null;
  tasks: BDTask[]; createdAt: string; updatedAt: string;
  entityId: number | null; entity: { id: number; name: string } | null;
  ownerUserId: number | null; owner: { id: number; name: string } | null;
  probability: number | null; followUpDate: string | null; leadSource: string | null; competitor: string | null;
  stageChangedAt: string | null; productionId: number | null; production: { id: number; name: string } | null;
  job?: { id: number; number: string } | null;
  lastActivityAt: string | null;
};
export type EntityOption = { id: number; name: string; archived: boolean };
export type UserOption = { id: number; name: string; role?: string };
type Activity = { id: number; kind: string; text: string; at: string; user: { id: number; name: string } | null };

const OPP_TYPES = ["production","event","scenic","rental","acquisition","f&b","other"];
const CLIENT_TYPES = ["promoter","venue","council","broadcaster","corporate","other"];

const BLANK_OPP = {
  title: "", type: "production", stage: "lead", value: "", clientId: "", description: "", closeDate: "", notes: "",
  entityId: "", ownerUserId: "", probability: "", followUpDate: "", leadSource: "", competitor: "", lostReason: "",
};
const BLANK_ACTIVITY = { kind: "note", text: "", followUpDate: "" };
const PRODUCTION_TYPES = ["Play", "Musical", "Opera", "Dance", "Comedy", "Drama", "Physical Theatre", "Event", "Other"];
type ConvertForm = { name: string; type: string; venue: string; startDate: string; endDate: string; pmFee: string; stages: { label: string; amount: string; dueDate: string }[] };
const todayIso = () => new Date().toISOString().slice(0, 10);
const stagesFor = (fee: string, startDate: string) =>
  splitFee(Number(fee) || 0, { today: todayIso(), startDate: startDate || null }).map((s: FeeStageInput) => ({ label: s.label, amount: String(s.amount), dueDate: s.dueDate ?? "" }));
const BLANK_TASK = { description: "", dueDate: "" };
const BLANK_CLIENT = { name: "", type: "promoter", website: "", address: "", notes: "", billingName: "", billingAddress: "", billingEmail: "" };
const BLANK_CONTACT = { name: "", role: "", email: "", phone: "" };

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

function fmtValue(v: number | null) {
  if (!v) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);
}
function isOverdue(s: string | null) {
  if (!s) return false;
  return new Date(s) < new Date();
}

export type BDInitial = { opps: Opportunity[]; clients: Client[]; entities: EntityOption[]; users: UserOption[] } | null;

// Opportunities and clients arrive with the page (loaded on the server by page.tsx)
export default function BDView({ initial }: { initial: BDInitial }) {
  const router = useRouter();
  const [opps, setOpps] = useState<Opportunity[]>(initial?.opps ?? []);
  const [clients, setClients] = useState<Client[]>(initial?.clients ?? []);
  const [entities, setEntities] = useState<EntityOption[]>(initial?.entities ?? []);
  const [users, setUsers] = useState<UserOption[]>(initial?.users ?? []);
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [filterStage, setFilterStage] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [targetsOnly, setTargetsOnly] = useState(false);

  // Activity log for the open deal
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [activityForm, setActivityForm] = useState(BLANK_ACTIVITY);
  const [savingActivity, setSavingActivity] = useState(false);

  // Quotes for the open deal
  const [dealQuotes, setDealQuotes] = useState<{ id: number; number: string; status: string; totals: { net: number } }[] | null>(null);
  async function loadQuotes(id: number) {
    const d = await fetch(`/api/quotes?opportunityId=${id}`).then(r => (r.ok ? r.json() : [])).catch(() => []);
    setDealQuotes(Array.isArray(d) ? d : []);
  }
  async function newQuote(opp: Opportunity) {
    const res = await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: opp.id }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(body.error ?? "Couldn't start a quote");
    router.push(`/bd/quotes/${body.id}`);
  }

  // Won deal → job (work that isn't a production; PM jobs open with the production)
  async function convertToJob(opp: Opportunity) {
    if (!await confirmDialog(`Open a job for "${opp.title}"? Use "→ Production" instead for production management work.`)) return;
    const res = await fetch(`/api/opportunities/${opp.id}/job`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(body.error ?? "Couldn't open the job");
    router.push(`/jobs/${body.id}`);
  }

  // Won deal → production
  const [convert, setConvert] = useState<{ opp: Opportunity; form: ConvertForm; saving: boolean } | null>(null);

  // Opportunity form
  const [showOppForm, setShowOppForm] = useState(false);
  const [editOpp, setEditOpp] = useState<Opportunity | null>(null);
  const [oppForm, setOppForm] = useState<typeof BLANK_OPP & { id?: number }>(BLANK_OPP);

  // Selected opp for detail panel
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);

  // Task form
  const [taskInput, setTaskInput] = useState(BLANK_TASK);
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Client form
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState(BLANK_CLIENT);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editClientForm, setEditClientForm] = useState(BLANK_CLIENT);
  const [contactForm, setContactForm] = useState(BLANK_CONTACT);
  const [showContactForm, setShowContactForm] = useState<number | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!initial) reload(); }, []);

  async function reload() {
    const [o, c, en, us] = await Promise.all([
      fetch("/api/opportunities").then(r => r.json()),
      fetch("/api/clients").then(r => r.json()),
      fetch("/api/entities").then(r => r.json()).catch(() => null),
      fetch("/api/users").then(r => r.json()).catch(() => null),
    ]);
    if (Array.isArray(o)) setOpps(o);
    if (Array.isArray(c)) setClients(c);
    if (Array.isArray(en)) setEntities(en);
    if (Array.isArray(us)) setUsers(us);
    if (selectedOpp) {
      const fresh = (Array.isArray(o) ? o : []).find((x: Opportunity) => x.id === selectedOpp.id);
      if (fresh) setSelectedOpp(fresh);
    }
  }

  async function saveOpp(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...oppForm, value: oppForm.value || null, clientId: oppForm.clientId || null };
    delete (payload as { id?: number }).id;
    if (oppForm.id) {
      await fetch(`/api/opportunities/${oppForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setShowOppForm(false);
    setEditOpp(null);
    setOppForm(BLANK_OPP);
    reload();
  }

  async function deleteOpp(id: number) {
    if (!await confirmDialog("Delete this opportunity? This cannot be undone.")) return;
    await fetch(`/api/opportunities/${id}`, { method: "DELETE" });
    if (selectedOpp?.id === id) setSelectedOpp(null);
    reload();
  }

  async function moveStage(opp: Opportunity, stage: string) {
    await fetch(`/api/opportunities/${opp.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
    reload();
    loadActivities(opp.id);
  }

  async function loadActivities(id: number) {
    const d = await fetch(`/api/opportunities/${id}/activities`).then(r => r.json()).catch(() => null);
    if (Array.isArray(d)) setActivities(d);
  }

  function openOpp(opp: Opportunity) {
    setSelectedOpp(opp);
    setActivities(null);
    setActivityForm({ ...BLANK_ACTIVITY, followUpDate: opp.followUpDate ? opp.followUpDate.slice(0, 10) : "" });
    loadActivities(opp.id);
    setDealQuotes(null);
    loadQuotes(opp.id);
  }

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOpp || !activityForm.text.trim()) return;
    setSavingActivity(true);
    await fetch(`/api/opportunities/${selectedOpp.id}/activities`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activityForm),
    });
    setSavingActivity(false);
    setActivityForm(f => ({ ...BLANK_ACTIVITY, followUpDate: f.followUpDate }));
    loadActivities(selectedOpp.id);
    reload();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOpp) return;
    await fetch(`/api/opportunities/${selectedOpp.id}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskInput) });
    setTaskInput(BLANK_TASK);
    setShowTaskForm(false);
    reload();
  }

  async function toggleTask(task: BDTask) {
    await fetch(`/api/bd-tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...task, completedAt: task.completedAt ? null : new Date().toISOString() }),
    });
    reload();
  }

  async function deleteTask(id: number) {
    await fetch(`/api/bd-tasks/${id}`, { method: "DELETE" });
    reload();
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clientForm) });
    setShowClientForm(false);
    setClientForm(BLANK_CLIENT);
    reload();
  }

  async function saveEditClient(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient) return;
    await fetch(`/api/clients/${editingClient.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editClientForm) });
    setEditingClient(null);
    reload();
  }

  function convertToProduction(opp: Opportunity) {
    const pmFee = opp.value ? String(Math.round(opp.value)) : "";
    setConvert({ opp, saving: false, form: { name: opp.title, type: opp.type === "event" ? "Event" : "Other", venue: "", startDate: "", endDate: "", pmFee, stages: stagesFor(pmFee, "") } });
  }

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

  function openEdit(opp: Opportunity) {
    setOppForm({
      id: opp.id, title: opp.title, type: opp.type, stage: opp.stage,
      value: opp.value?.toString() ?? "", clientId: opp.clientId?.toString() ?? "",
      description: opp.description ?? "", closeDate: opp.closeDate ? opp.closeDate.slice(0, 10) : "",
      notes: opp.notes ?? "",
      entityId: opp.entityId?.toString() ?? "", ownerUserId: opp.ownerUserId?.toString() ?? "",
      probability: opp.probability?.toString() ?? "", followUpDate: opp.followUpDate ? opp.followUpDate.slice(0, 10) : "",
      leadSource: opp.leadSource ?? "", competitor: opp.competitor ?? "", lostReason: opp.lostReason ?? "",
    });
    setEditOpp(opp);
    setShowOppForm(true);
  }

  const stageMap = Object.fromEntries(STAGES.map(s => [s.key, s]));
  const now = new Date();
  const stuck = (o: Opportunity) => stuckReason(o, now);
  // Entity, owner and "needs attention" filters apply to both views; the stage filter to the list
  const filtered = opps.filter(o =>
    (filterEntity === "all" || (filterEntity === "none" ? !o.entityId : String(o.entityId) === filterEntity)) &&
    (filterOwner === "all" || (filterOwner === "none" ? !o.ownerUserId : String(o.ownerUserId) === filterOwner)) &&
    (!attentionOnly || !!stuck(o)));
  const visibleOpps = filterStage === "all" ? filtered : filtered.filter(o => o.stage === filterStage);
  const activeOpps = filtered.filter(o => isOpen(o.stage));
  const totalPipeline = activeOpps.reduce((s, o) => s + (o.value ?? 0), 0);
  const weightedPipeline = activeOpps.reduce((s, o) => s + weightedValue(o), 0);
  const wonValue = filtered.filter(o => o.stage === "won").reduce((s, o) => s + (o.value ?? 0), 0);
  const stuckCount = opps.filter(o => stuck(o)).length;
  const activeEntities = entities.filter(e => !e.archived);
  const staff = users.filter(u => !u.role || u.role === "admin" || u.role === "member");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Business Development</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
            {activeOpps.length} active · {fmtValue(totalPipeline) ?? "£0"} pipeline ({fmtValue(weightedPipeline) ?? "£0"} weighted) · {fmtValue(wonValue) ?? "£0"} won
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowClientForm(true)} className="border px-3 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            + Client
          </button>
          <button onClick={() => { setOppForm(BLANK_OPP); setEditOpp(null); setShowOppForm(true); }} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
            + Opportunity
          </button>
        </div>
      </div>

      {/* View toggle + stage filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
          {(["pipeline","list"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 text-sm capitalize transition-colors" style={{ backgroundColor: view === v ? "var(--psg-blue)" : "transparent", color: view === v ? "#fff" : "var(--psg-muted)" }}>
              {v}
            </button>
          ))}
        </div>
        {activeEntities.length > 0 && (
          <select aria-label="Entity" className="rounded px-2 py-1.5 text-sm border" style={inpStyle} value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
            <option value="all">All entities</option>
            {activeEntities.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
            <option value="none">No entity set</option>
          </select>
        )}
        <select aria-label="Owner" className="rounded px-2 py-1.5 text-sm border" style={inpStyle} value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
          <option value="all">Everyone&apos;s deals</option>
          {staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          <option value="none">No owner</option>
        </select>
        <button type="button" onClick={() => setAttentionOnly(v => !v)} className="px-3 py-1.5 rounded text-sm border transition-colors"
          style={{ borderColor: attentionOnly ? "#f59e0b" : "var(--psg-card-border)", backgroundColor: attentionOnly ? "rgba(245,158,11,0.15)" : "transparent", color: stuckCount ? "#fbbf24" : "var(--psg-muted)" }}>
          Needs attention ({stuckCount})
        </button>
        {view === "list" && (
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterStage("all")} className="px-3 py-1 rounded text-xs transition-colors" style={{ backgroundColor: filterStage === "all" ? "rgba(255,255,255,0.1)" : "transparent", color: "var(--psg-muted)" }}>All</button>
            {STAGES.map(s => (
              <button key={s.key} onClick={() => setFilterStage(s.key)} className="px-3 py-1 rounded text-xs transition-colors" style={{ backgroundColor: filterStage === s.key ? s.color + "33" : "transparent", color: filterStage === s.key ? s.color : "var(--psg-muted)" }}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline kanban */}
      {view === "pipeline" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {STAGES.map(stage => {
            const cols = filtered.filter(o => o.stage === stage.key);
            const colWeighted = cols.reduce((sum, o) => sum + weightedValue(o), 0);
            return (
              <div key={stage.key} className="rounded-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", borderTop: `3px solid ${stage.color}` }}>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</span>
                  <span className="text-xs" style={{ color: "var(--psg-muted)" }} title={isOpen(stage.key) ? `${stage.weight}% of each deal's value counts, unless the deal sets its own` : undefined}>
                    {cols.length}{isOpen(stage.key) && colWeighted > 0 ? ` · ${fmtValue(colWeighted)}` : ""}
                  </span>
                </div>
                <div className="px-3 pb-3 space-y-2">
                  {cols.map(opp => (
                    <button key={opp.id} onClick={() => openOpp(opp)} className="w-full text-left rounded-lg p-3 border transition-colors hover:border-white/20" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: stuck(opp) ? "rgba(245,158,11,0.6)" : "var(--psg-card-border)" }}>
                      <div className="text-sm font-medium text-white mb-1 leading-tight">{opp.title}</div>
                      {opp.client && <div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>{opp.client.name}</div>}
                      {(opp.entity || opp.owner) && (
                        <div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>{[opp.entity?.name, opp.owner?.name].filter(Boolean).join(" · ")}</div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{opp.type}</span>
                        {opp.value && <span className="text-xs font-medium" style={{ color: stage.color }}>{fmtValue(opp.value)}</span>}
                      </div>
                      {opp.closeDate && (
                        <div className="text-xs mt-1" style={{ color: isOverdue(opp.closeDate) && opp.stage !== "won" && opp.stage !== "lost" ? "#ef4444" : "var(--psg-muted)" }}>
                          {isOverdue(opp.closeDate) && opp.stage !== "won" && opp.stage !== "lost" ? "⚠ " : ""}Close {fmtDate(opp.closeDate)}
                        </div>
                      )}
                      {stuck(opp) && <div className="text-xs mt-1" style={{ color: "#fbbf24" }}>⚠ {stuck(opp)}</div>}
                      {!stuck(opp) && opp.followUpDate && isOpen(opp.stage) && (
                        <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>Follow up {fmtDate(opp.followUpDate)}</div>
                      )}
                      {opp.tasks.filter(t => !t.completedAt).length > 0 && (
                        <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
                          {opp.tasks.filter(t => !t.completedAt).length} task{opp.tasks.filter(t => !t.completedAt).length !== 1 ? "s" : ""} open
                        </div>
                      )}
                    </button>
                  ))}
                  {cols.length === 0 && <div className="text-xs py-4 text-center" style={{ color: "var(--psg-muted)" }}>No opportunities</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3 text-left font-medium text-white">Opportunity</th>
                <th className="px-4 py-3 text-left font-medium text-white">Client</th>
                <th className="px-4 py-3 text-left font-medium text-white">Entity · owner</th>
                <th className="px-4 py-3 text-left font-medium text-white">Stage</th>
                <th className="px-4 py-3 text-left font-medium text-white">Value</th>
                <th className="px-4 py-3 text-left font-medium text-white">Follow-up</th>
                <th className="px-4 py-3 text-left font-medium text-white">Close</th>
                <th className="px-4 py-3 text-left font-medium text-white">Tasks</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleOpps.map(opp => {
                const s = stageMap[opp.stage];
                return (
                  <tr key={opp.id} onClick={() => openOpp(opp)} className="border-t hover:bg-white/5 transition-colors cursor-pointer group" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{opp.title}</div>
                      <div className="text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{opp.type}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{opp.client?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{opp.entity?.name ?? "—"}<br />{opp.owner?.name ?? "No owner"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: s?.color + "22", color: s?.color }}>{s?.label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {fmtValue(opp.value) ?? "—"}
                      {opp.value && isOpen(opp.stage) ? <div className="text-xs font-normal" style={{ color: "var(--psg-muted)" }}>{fmtValue(weightedValue(opp))} at {weightPct(opp)}%</div> : null}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: stuck(opp) ? "#fbbf24" : "var(--psg-muted)" }}>
                      {stuck(opp) ?? (isOpen(opp.stage) ? fmtDate(opp.followUpDate) ?? "—" : "—")}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: isOverdue(opp.closeDate) && opp.stage !== "won" && opp.stage !== "lost" ? "#ef4444" : "var(--psg-muted)" }}>
                      {fmtDate(opp.closeDate) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                      {opp.tasks.filter(t => !t.completedAt).length}/{opp.tasks.length}
                    </td>
                    <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(opp)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                        <button onClick={() => deleteOpp(opp.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleOpps.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No opportunities yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selectedOpp && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md border-l shadow-2xl flex flex-col z-40" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            <h2 className="font-semibold text-white truncate pr-4">{selectedOpp.title}</h2>
            <button onClick={() => { setSelectedOpp(null); setActivities(null); }} className="text-xl leading-none shrink-0 hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Stage selector */}
            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>Stage</div>
              <div className="flex flex-wrap gap-1">
                {STAGES.map(s => (
                  <button key={s.key} onClick={() => moveStage(selectedOpp, s.key)} className="px-3 py-1 rounded-full text-xs font-medium transition-colors" style={{ backgroundColor: selectedOpp.stage === s.key ? s.color : s.color + "22", color: selectedOpp.stage === s.key ? "#fff" : s.color }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3">
              {selectedOpp.client && (
                <div>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Client</div>
                  <div className="text-sm text-white">{selectedOpp.client.name}</div>
                </div>
              )}
              {selectedOpp.value && (
                <div>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Value</div>
                  <div className="text-sm font-medium text-white">{fmtValue(selectedOpp.value)}</div>
                </div>
              )}
              <div>
                <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Type</div>
                <div className="text-sm text-white capitalize">{selectedOpp.type}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Entity</div>
                <div className="text-sm text-white">{selectedOpp.entity?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Owner</div>
                <div className="text-sm text-white">{selectedOpp.owner?.name ?? "—"}</div>
              </div>
              {selectedOpp.value && isOpen(selectedOpp.stage) ? (
                <div>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Weighted</div>
                  <div className="text-sm text-white">{fmtValue(weightedValue(selectedOpp))} <span className="text-xs" style={{ color: "var(--psg-muted)" }}>at {weightPct(selectedOpp)}%{selectedOpp.probability == null ? " (stage default)" : ""}</span></div>
                </div>
              ) : null}
              {selectedOpp.leadSource && (
                <div>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Lead source</div>
                  <div className="text-sm text-white">{selectedOpp.leadSource}</div>
                </div>
              )}
              {selectedOpp.competitor && (
                <div>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Competitor</div>
                  <div className="text-sm text-white">{selectedOpp.competitor}</div>
                </div>
              )}
              {selectedOpp.closeDate && (
                <div>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Close date</div>
                  <div className="text-sm" style={{ color: isOverdue(selectedOpp.closeDate) && selectedOpp.stage !== "won" && selectedOpp.stage !== "lost" ? "#ef4444" : "white" }}>
                    {fmtDate(selectedOpp.closeDate)}
                  </div>
                </div>
              )}
            </div>

            {selectedOpp.lostReason && (selectedOpp.stage === "won" || selectedOpp.stage === "lost") && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>{selectedOpp.stage === "won" ? "Why we won" : "Why we lost"}</div>
                <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedOpp.lostReason}</p>
              </div>
            )}

            {selectedOpp.description && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Description</div>
                <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedOpp.description}</p>
              </div>
            )}

            {selectedOpp.notes && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div>
                <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedOpp.notes}</p>
              </div>
            )}

            {/* Quotes for this deal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Quotes</div>
                <button type="button" onClick={() => newQuote(selectedOpp)} className="text-xs text-blue-400">+ Quote</button>
              </div>
              {dealQuotes === null ? <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Loading…</p>
                : dealQuotes.length === 0 ? <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No quotes yet</p>
                : (
                  <ul className="space-y-1">
                    {dealQuotes.map(dq => (
                      <li key={dq.id} className="flex justify-between text-sm">
                        <Link href={`/bd/quotes/${dq.id}`} className="text-blue-300 hover:underline">{dq.number}</Link>
                        <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{dq.status} · {fmtValue(dq.totals.net) ?? "£0"}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            {/* Activity log, with the next follow-up date */}
            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>Activity</div>
              {isOpen(selectedOpp.stage) && stuck(selectedOpp) && (
                <p className="text-xs mb-2" style={{ color: "#fbbf24" }}>⚠ {stuck(selectedOpp)}. Log what&apos;s happened and set the next follow-up.</p>
              )}
              <form onSubmit={addActivity} className="mb-3 space-y-2 rounded-lg p-3 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
                <div className="flex gap-2">
                  <select aria-label="Kind" className={inp} style={{ ...inpStyle, width: "auto" }} value={activityForm.kind} onChange={e => setActivityForm(f => ({ ...f, kind: e.target.value }))}>
                    {ACTIVITY_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                  <input aria-label="What happened" placeholder="What happened?" className={inp} style={inpStyle} value={activityForm.text} onChange={e => setActivityForm(f => ({ ...f, text: e.target.value }))} />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs shrink-0" style={{ color: "var(--psg-muted)" }} htmlFor="bd-next-follow-up">Next follow-up</label>
                  <input id="bd-next-follow-up" type="date" className={inp} style={inpStyle} value={activityForm.followUpDate} onChange={e => setActivityForm(f => ({ ...f, followUpDate: e.target.value }))} />
                  <button type="submit" disabled={savingActivity || !activityForm.text.trim()} className="text-white px-3 py-2 rounded text-sm font-medium hover:opacity-90 shrink-0 disabled:opacity-40" style={{ backgroundColor: "var(--psg-blue)" }}>Log</button>
                </div>
              </form>
              <div className="space-y-2">
                {activities === null && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Loading…</p>}
                {activities?.length === 0 && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Nothing logged yet</p>}
                {activities?.map(a => (
                  <div key={a.id} className="text-sm">
                    <div style={{ color: a.kind === "stage" ? "var(--psg-muted)" : "white" }}>
                      {a.kind !== "stage" && a.kind !== "note" && <span className="text-xs uppercase tracking-wider mr-1.5" style={{ color: "var(--psg-muted)" }}>{a.kind}</span>}
                      {a.text}
                    </div>
                    <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{a.user?.name ?? "Someone"} · {fmtDateTime(a.at)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Follow-up tasks</div>
                <button onClick={() => setShowTaskForm(t => !t)} className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
              </div>

              {showTaskForm && (
                <form onSubmit={addTask} className="mb-3 space-y-2 rounded-lg p-3 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
                  <input required placeholder="Task description" className={inp} style={inpStyle} value={taskInput.description} onChange={e => setTaskInput(t => ({ ...t, description: e.target.value }))} />
                  <div className="flex gap-2">
                    <input type="date" className={inp} style={inpStyle} value={taskInput.dueDate} onChange={e => setTaskInput(t => ({ ...t, dueDate: e.target.value }))} />
                    <button type="submit" className="text-white px-3 py-2 rounded text-sm font-medium hover:opacity-90 shrink-0" style={{ backgroundColor: "var(--psg-blue)" }}>Add</button>
                  </div>
                </form>
              )}

              <div className="space-y-1">
                {selectedOpp.tasks.length === 0 && !showTaskForm && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No tasks yet</p>}
                {selectedOpp.tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2 rounded p-2 group" style={{ backgroundColor: task.completedAt ? "transparent" : "rgba(255,255,255,0.03)" }}>
                    <button onClick={() => toggleTask(task)} className="mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors" style={{ borderColor: task.completedAt ? "#10b981" : "var(--psg-card-border)", backgroundColor: task.completedAt ? "#10b981" : "transparent" }}>
                      {task.completedAt && <span className="text-white text-xs">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm" style={{ color: task.completedAt ? "var(--psg-muted)" : "white", textDecoration: task.completedAt ? "line-through" : "none" }}>{task.description}</div>
                      {task.dueDate && <div className="text-xs mt-0.5" style={{ color: isOverdue(task.dueDate) && !task.completedAt ? "#ef4444" : "var(--psg-muted)" }}>{fmtDate(task.dueDate)}</div>}
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="text-xs opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel actions */}
          <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "var(--psg-card-border)" }}>
            <button onClick={() => openEdit(selectedOpp)} className="flex-1 border py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
            {selectedOpp.stage === "won" && !selectedOpp.production && (
              <button onClick={() => convertToProduction(selectedOpp)} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "#10b981" }}>
                → Production
              </button>
            )}
            {selectedOpp.stage === "won" && !selectedOpp.production && !selectedOpp.job && (
              <button onClick={() => convertToJob(selectedOpp)} className="border py-2 px-3 rounded text-sm hover:bg-white/5" style={{ borderColor: "#10b981", color: "#10b981" }}>
                → Job
              </button>
            )}
            {selectedOpp.job && !selectedOpp.production && (
              <button onClick={() => router.push(`/jobs/${selectedOpp.job!.id}`)} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#10b981" }}>
                Open job {selectedOpp.job.number}
              </button>
            )}
            {selectedOpp.production && (
              <button onClick={() => router.push(`/productions/${selectedOpp.production!.id}`)} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity truncate px-2" style={{ backgroundColor: "#10b981" }}>
                Open {selectedOpp.production.name}
              </button>
            )}
            <button onClick={() => deleteOpp(selectedOpp.id)} className="border py-2 px-3 rounded text-sm hover:bg-red-900/20 transition-colors text-red-400" style={{ borderColor: "rgba(239,68,68,0.3)" }}>Delete</button>
          </div>
        </div>
      )}

      {/* Won deal → production */}
      {convert && (() => {
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
      })()}

      {/* Opportunity form modal */}
      {showOppForm && (
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
      )}

      {/* Clients list */}
      {clients.length > 0 && (
        <div className="rounded-lg border" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--psg-card-border)" }}>
            <span className="text-sm font-semibold text-white">Clients ({clients.length})</span>
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--psg-muted)" }}>
              <input type="checkbox" checked={targetsOnly} onChange={e => setTargetsOnly(e.target.checked)} />
              Target accounts only ({clients.filter(c => c.targetAccount).length})
            </label>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
            {/* Target accounts first, then the rest alphabetically */}
            {[...clients].filter(c => !targetsOnly || c.targetAccount).sort((a, b) => Number(!!b.targetAccount) - Number(!!a.targetAccount) || a.name.localeCompare(b.name)).map(c => {
              const openDeals = (c.opportunities ?? []).filter(o => isOpen(o.stage)).length;
              return (
              <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/bd/clients/${c.id}`} className="text-sm font-medium text-white hover:underline">{c.targetAccount && <span title="Target account" style={{ color: "#5b8def" }}>★ </span>}{c.name}</Link>
                  <div className="text-xs capitalize" style={{ color: "var(--psg-muted)" }}>
                    {c.type}{c.opportunities ? ` · ${openDeals} open deal${openDeals === 1 ? "" : "s"}` : ""}
                  </div>
                  {c.targetAccount && (
                    <div className="text-xs" style={{ color: openDeals ? "var(--psg-muted)" : "#fbbf24" }}>
                      Target · {c.targetOwner?.name ?? "no owner"}{c.targetSource ? ` · ${c.targetSource}` : ""}{openDeals ? "" : " · no open deal"}
                    </div>
                  )}
                  {c.billingName && <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Bill to: {c.billingName}</div>}
                  {c.billingEmail && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{c.billingEmail}</div>}
                </div>
                <button onClick={() => { setEditingClient(c); setEditClientForm({ name: c.name, type: c.type, website: c.website ?? "", address: c.address ?? "", notes: c.notes ?? "", billingName: c.billingName ?? "", billingAddress: c.billingAddress ?? "", billingEmail: c.billingEmail ?? "" }); }} className="text-xs px-2 py-1 rounded border shrink-0 hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit client modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl w-full max-w-md border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold text-white">Edit Client</h2>
              <button onClick={() => setEditingClient(null)} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              <form onSubmit={saveEditClient} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Name *</label>
                  <input required className={inp} style={inpStyle} value={editClientForm.name} onChange={e => setEditClientForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
                  <select className={inp} style={inpStyle} value={editClientForm.type} onChange={e => setEditClientForm(f => ({ ...f, type: e.target.value }))}>
                    {CLIENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Website</label>
                  <input className={inp} style={inpStyle} value={editClientForm.website} onChange={e => setEditClientForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
                  <textarea rows={2} className={inp} style={inpStyle} value={editClientForm.notes} onChange={e => setEditClientForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: "var(--psg-muted)" }}>Billing Details</p>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Name</label>
                  <input className={inp} style={inpStyle} value={editClientForm.billingName} onChange={e => setEditClientForm(f => ({ ...f, billingName: e.target.value }))} placeholder="Legal entity name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Address</label>
                  <textarea rows={3} className={inp} style={inpStyle} value={editClientForm.billingAddress} onChange={e => setEditClientForm(f => ({ ...f, billingAddress: e.target.value }))} placeholder="Full billing address" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Email</label>
                  <input type="email" className={inp} style={inpStyle} value={editClientForm.billingEmail} onChange={e => setEditClientForm(f => ({ ...f, billingEmail: e.target.value }))} placeholder="accounts@..." />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Save</button>
                  <button type="button" onClick={() => setEditingClient(null)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Client form modal */}
      {showClientForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl w-full max-w-md border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold text-white">Add Client</h2>
              <button onClick={() => setShowClientForm(false)} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <div className="px-5 py-4">
              <form onSubmit={saveClient} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Name *</label>
                  <input required className={inp} style={inpStyle} value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
                  <select className={inp} style={inpStyle} value={clientForm.type} onChange={e => setClientForm(f => ({ ...f, type: e.target.value }))}>
                    {CLIENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Website</label>
                  <input className={inp} style={inpStyle} value={clientForm.website} onChange={e => setClientForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
                  <textarea rows={2} className={inp} style={inpStyle} value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: "var(--psg-muted)" }}>Billing Details</p>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Name</label>
                  <input className={inp} style={inpStyle} value={clientForm.billingName} onChange={e => setClientForm(f => ({ ...f, billingName: e.target.value }))} placeholder="Legal entity name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Address</label>
                  <textarea rows={3} className={inp} style={inpStyle} value={clientForm.billingAddress} onChange={e => setClientForm(f => ({ ...f, billingAddress: e.target.value }))} placeholder="Full billing address" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Email</label>
                  <input type="email" className={inp} style={inpStyle} value={clientForm.billingEmail} onChange={e => setClientForm(f => ({ ...f, billingEmail: e.target.value }))} placeholder="accounts@..." />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Add Client</button>
                  <button type="button" onClick={() => setShowClientForm(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
