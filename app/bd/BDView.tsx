"use client";

// Business Development screen shell: data and deal state, header, view switcher and filters.
// Each view and modal lives in its own file in this folder.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/Dialogs";
import { STAGES, weightedValue, stuckReason, isOpen } from "@/lib/bdPipeline";
import { alertDialog } from "@/components/Dialogs";
import {
  BLANK_OPP, BLANK_ACTIVITY, BLANK_TASK, BLANK_CLIENT, inpStyle, fmtValue, stagesFor,
  type Client, type Opportunity, type EntityOption, type UserOption, type BDInitial, type BDTask, type Activity, type DealQuote,
} from "./bdTypes";
import ResultsView from "./ResultsView";
import PipelineBoard from "./PipelineBoard";
import OpportunityList from "./OpportunityList";
import OpportunityPanel from "./OpportunityPanel";
import ConvertProductionModal, { type ConvertState } from "./ConvertProductionModal";
import OpportunityModal from "./OpportunityModal";
import ClientsList from "./ClientsList";
import { EditClientModal, AddClientModal } from "./ClientModals";

export type { Client, Opportunity, EntityOption, UserOption, BDInitial } from "./bdTypes";

// Opportunities and clients arrive with the page (loaded on the server by page.tsx)
export default function BDView({ initial }: { initial: BDInitial }) {
  const router = useRouter();
  const [opps, setOpps] = useState<Opportunity[]>(initial?.opps ?? []);
  const [clients, setClients] = useState<Client[]>(initial?.clients ?? []);
  const [entities, setEntities] = useState<EntityOption[]>(initial?.entities ?? []);
  const [users, setUsers] = useState<UserOption[]>(initial?.users ?? []);
  const [view, setView] = useState<"pipeline" | "list" | "results">("pipeline");
  const [resultsMonths, setResultsMonths] = useState(12);
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
  const [dealQuotes, setDealQuotes] = useState<DealQuote[] | null>(null);
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
  const [convert, setConvert] = useState<ConvertState | null>(null);

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


  function openEdit(opp: Opportunity) {
    setOppForm({
      id: opp.id, title: opp.title, type: opp.type, stage: opp.stage,
      value: opp.value?.toString() ?? "", clientId: opp.clientId?.toString() ?? "",
      description: opp.description ?? "", closeDate: opp.closeDate ? opp.closeDate.slice(0, 10) : "",
      notes: opp.notes ?? "",
      entityId: opp.entityId?.toString() ?? "", ownerUserId: opp.ownerUserId?.toString() ?? "",
      probability: opp.probability?.toString() ?? "", followUpDate: opp.followUpDate ? opp.followUpDate.slice(0, 10) : "", tenderDeadline: opp.tenderDeadline ? opp.tenderDeadline.slice(0, 10) : "",
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
          {(["pipeline","list","results"] as const).map(v => (
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

      {/* Results: win rate, average won deal, time to close (deals decided in the period) */}
      {view === "results" && <ResultsView filtered={filtered} resultsMonths={resultsMonths} setResultsMonths={setResultsMonths} />}

      {/* Pipeline kanban */}
      {view === "pipeline" && <PipelineBoard filtered={filtered} openOpp={openOpp} stuck={stuck} />}

      {/* List view */}
      {view === "list" && (
        <OpportunityList visibleOpps={visibleOpps} stageMap={stageMap} openOpp={openOpp} openEdit={openEdit} deleteOpp={deleteOpp} stuck={stuck} />
      )}

      {/* Detail panel */}
      {selectedOpp && (
        <OpportunityPanel
          selectedOpp={selectedOpp} setSelectedOpp={setSelectedOpp} setActivities={setActivities}
          activities={activities} activityForm={activityForm} setActivityForm={setActivityForm} savingActivity={savingActivity} addActivity={addActivity}
          dealQuotes={dealQuotes} newQuote={newQuote} moveStage={moveStage}
          showTaskForm={showTaskForm} setShowTaskForm={setShowTaskForm} taskInput={taskInput} setTaskInput={setTaskInput}
          addTask={addTask} toggleTask={toggleTask} deleteTask={deleteTask}
          openEdit={openEdit} convertToProduction={convertToProduction} convertToJob={convertToJob} deleteOpp={deleteOpp} stuck={stuck}
        />
      )}

      {/* Won deal → production */}
      {convert && <ConvertProductionModal convert={convert} setConvert={setConvert} />}

      {/* Opportunity form modal */}
      {showOppForm && (
        <OpportunityModal editOpp={editOpp} oppForm={oppForm} setOppForm={setOppForm} setShowOppForm={setShowOppForm} saveOpp={saveOpp} clients={clients} entities={entities} staff={staff} />
      )}

      {/* Clients list */}
      {clients.length > 0 && (
        <ClientsList clients={clients} targetsOnly={targetsOnly} setTargetsOnly={setTargetsOnly} setEditingClient={setEditingClient} setEditClientForm={setEditClientForm} />
      )}

      {/* Edit client modal */}
      {editingClient && (
        <EditClientModal editClientForm={editClientForm} setEditClientForm={setEditClientForm} saveEditClient={saveEditClient} setEditingClient={setEditingClient} />
      )}

      {/* Client form modal */}
      {showClientForm && (
        <AddClientModal clientForm={clientForm} setClientForm={setClientForm} saveClient={saveClient} setShowClientForm={setShowClientForm} />
      )}
    </div>
  );
}
