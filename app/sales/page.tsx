"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type SalesTask = {
  id: number; title: string; notes: string | null; dueDate: string | null;
  completedAt: string | null; priority: string;
  brand: { id: number; name: string } | null;
};

type SalesBrand = {
  id: number; name: string; category: string; stage: string;
  website: string | null; rep: string | null; repEmail: string | null; repPhone: string | null;
  notes: string | null; priority: string; tasks: SalesTask[];
  createdAt: string; updatedAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES = [
  { key: "prospect",    label: "Prospect",    color: "#6b7280" },
  { key: "contacted",   label: "Contacted",   color: "#3b82f6" },
  { key: "samples",     label: "Samples",     color: "#8b5cf6" },
  { key: "negotiating", label: "Negotiating", color: "#f59e0b" },
  { key: "active",      label: "Active",      color: "#10b981" },
  { key: "paused",      label: "Paused",      color: "#64748b" },
  { key: "lost",        label: "Lost",        color: "#ef4444" },
];

const CATEGORIES = [
  "lighting", "sound", "cable", "staging", "rigging", "video", "consumables", "other",
];

const PRIORITIES = [
  { key: "high",   label: "High",   color: "#ef4444" },
  { key: "medium", label: "Medium", color: "#f59e0b" },
  { key: "low",    label: "Low",    color: "#6b7280" },
];

const BLANK_BRAND = { name: "", category: "lighting", stage: "prospect", priority: "medium", website: "", rep: "", repEmail: "", repPhone: "", notes: "" };
const BLANK_TASK  = { title: "", notes: "", dueDate: "", priority: "medium", brandId: "" };

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

function stageColor(key: string) { return STAGES.find(s => s.key === key)?.color ?? "#6b7280"; }
function priColor(key: string)   { return PRIORITIES.find(p => p.key === key)?.color ?? "#6b7280"; }
function fmtDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function isOverdue(s: string | null) {
  if (!s) return false;
  return new Date(s) < new Date();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SalesPage() {
  return <Suspense><SalesInner /></Suspense>;
}

function SalesInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") ?? "brands") as "brands" | "tasks";

  const [brands, setBrands]     = useState<SalesBrand[]>([]);
  const [tasks, setTasks]       = useState<SalesTask[]>([]);
  const [loading, setLoading]   = useState(true);

  // Brand form
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [editBrand, setEditBrand]         = useState<SalesBrand | null>(null);
  const [brandForm, setBrandForm]         = useState<typeof BLANK_BRAND>(BLANK_BRAND);

  // Brand detail panel
  const [selectedBrand, setSelectedBrand] = useState<SalesBrand | null>(null);

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask, setEditTask]         = useState<SalesTask | null>(null);
  const [taskForm, setTaskForm]         = useState<typeof BLANK_TASK>(BLANK_TASK);

  // Filters
  const [filterStage, setFilterStage] = useState("all");
  const [showDone, setShowDone]       = useState(false);

  useEffect(() => { reload(); }, []);

  async function reload() {
    setLoading(true);
    const [b, t] = await Promise.all([
      fetch("/api/sales/brands").then(r => r.json()),
      fetch("/api/sales/tasks").then(r => r.json()),
    ]);
    if (Array.isArray(b)) setBrands(b);
    if (Array.isArray(t)) setTasks(t);
    setLoading(false);
  }

  function setTab(t: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    router.replace(`/sales?${p.toString()}`);
  }

  // ── Brand handlers ───────────────────────────────────────────────────────

  function openNewBrand() {
    setEditBrand(null);
    setBrandForm(BLANK_BRAND);
    setShowBrandForm(true);
  }

  function openEditBrand(b: SalesBrand) {
    setEditBrand(b);
    setBrandForm({ name: b.name, category: b.category, stage: b.stage, priority: b.priority, website: b.website ?? "", rep: b.rep ?? "", repEmail: b.repEmail ?? "", repPhone: b.repPhone ?? "", notes: b.notes ?? "" });
    setShowBrandForm(true);
  }

  async function saveBrand() {
    if (!brandForm.name.trim()) return;
    const body = { ...brandForm };
    if (editBrand) {
      const r = await fetch(`/api/sales/brands/${editBrand.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const updated = await r.json();
      setBrands(bs => bs.map(b => b.id === editBrand.id ? updated : b));
      if (selectedBrand?.id === editBrand.id) setSelectedBrand(updated);
    } else {
      const r = await fetch("/api/sales/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const created = await r.json();
      setBrands(bs => [...bs, created].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setShowBrandForm(false);
  }

  async function deleteBrand(id: number) {
    if (!confirm("Delete this brand?")) return;
    await fetch(`/api/sales/brands/${id}`, { method: "DELETE" });
    setBrands(bs => bs.filter(b => b.id !== id));
    if (selectedBrand?.id === id) setSelectedBrand(null);
  }

  // ── Task handlers ────────────────────────────────────────────────────────

  function openNewTask(brandId?: number) {
    setEditTask(null);
    setTaskForm({ ...BLANK_TASK, brandId: brandId ? String(brandId) : "" });
    setShowTaskForm(true);
  }

  function openEditTask(t: SalesTask) {
    setEditTask(t);
    setTaskForm({ title: t.title, notes: t.notes ?? "", dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "", priority: t.priority, brandId: t.brand ? String(t.brand.id) : "" });
    setShowTaskForm(true);
  }

  async function saveTask() {
    if (!taskForm.title.trim()) return;
    const body = { ...taskForm, brandId: taskForm.brandId ? Number(taskForm.brandId) : null, dueDate: taskForm.dueDate || null };
    if (editTask) {
      const r = await fetch(`/api/sales/tasks/${editTask.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const updated = await r.json();
      setTasks(ts => ts.map(t => t.id === editTask.id ? updated : t));
    } else {
      const r = await fetch("/api/sales/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const created = await r.json();
      setTasks(ts => [created, ...ts]);
    }
    setShowTaskForm(false);
    // refresh brand tasks count
    const b = await fetch("/api/sales/brands").then(r => r.json());
    if (Array.isArray(b)) setBrands(b);
  }

  async function toggleTask(t: SalesTask) {
    const completedAt = t.completedAt ? null : new Date().toISOString();
    const r = await fetch(`/api/sales/tasks/${t.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...t, brandId: t.brand?.id ?? null, completedAt }) });
    const updated = await r.json();
    setTasks(ts => ts.map(x => x.id === t.id ? updated : x));
  }

  async function deleteTask(id: number) {
    await fetch(`/api/sales/tasks/${id}`, { method: "DELETE" });
    setTasks(ts => ts.filter(t => t.id !== id));
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const filteredBrands = brands.filter(b => filterStage === "all" || b.stage === filterStage);
  const pendingTasks   = tasks.filter(t => !t.completedAt);
  const doneTasks      = tasks.filter(t => !!t.completedAt);
  const displayTasks   = showDone ? tasks : pendingTasks;

  // Group brands by stage for pipeline view
  const byStage = STAGES.reduce<Record<string, SalesBrand[]>>((acc, s) => {
    acc[s.key] = brands.filter(b => b.stage === s.key);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Sales</h1>
        <div className="flex-1" />
        <button onClick={() => tab === "brands" ? openNewBrand() : openNewTask()}
          className="text-sm px-4 py-2 rounded-lg font-medium text-white transition-colors"
          style={{ backgroundColor: "var(--psg-blue)" }}>
          + {tab === "brands" ? "Add Brand" : "Add Task"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        {(["brands", "tasks"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? "border-blue-500 text-white" : "border-transparent hover:text-white"}`}
            style={{ color: tab === t ? "white" : "var(--psg-muted)" }}>
            {t === "brands" ? `Brands (${brands.length})` : `Tasks (${pendingTasks.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: "var(--psg-muted)" }}>Loading…</div>
      ) : tab === "brands" ? (
        <>
          {/* Stage filter pills */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterStage("all")}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterStage === "all" ? "text-white" : "hover:text-white"}`}
              style={{ borderColor: filterStage === "all" ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: filterStage === "all" ? "var(--psg-blue)22" : "transparent", color: filterStage === "all" ? "white" : "var(--psg-muted)" }}>
              All ({brands.length})
            </button>
            {STAGES.map(s => {
              const count = byStage[s.key].length;
              if (count === 0) return null;
              return (
                <button key={s.key} onClick={() => setFilterStage(filterStage === s.key ? "all" : s.key)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors`}
                  style={{ borderColor: filterStage === s.key ? s.color : "var(--psg-card-border)", backgroundColor: filterStage === s.key ? s.color + "22" : "transparent", color: filterStage === s.key ? s.color : "var(--psg-muted)" }}>
                  {s.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Brand list with inline expansion */}
          {filteredBrands.length === 0 ? (
            <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              No brands yet. Add one to get started.
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
              {filteredBrands.map((b, i) => (
                <div key={b.id}>
                  {/* Brand row */}
                  <div onClick={() => setSelectedBrand(selectedBrand?.id === b.id ? null : b)}
                    className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-white/5 ${i > 0 ? "border-t" : ""} ${selectedBrand?.id === b.id ? "bg-white/5" : ""}`}
                    style={{ borderColor: "var(--psg-card-border)", backgroundColor: selectedBrand?.id === b.id ? "rgba(255,255,255,0.03)" : undefined }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm">{b.name}</span>
                        <span className="text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{b.category}</span>
                      </div>
                      {b.rep && <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{b.rep}</div>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {b.tasks.length > 0 && (
                        <span className="text-xs flex items-center gap-1" style={{ color: "var(--psg-muted)" }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          {b.tasks.length}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: stageColor(b.stage) + "22", color: stageColor(b.stage) }}>
                        {STAGES.find(s => s.key === b.stage)?.label ?? b.stage}
                      </span>
                      <span className="text-xs" style={{ color: priColor(b.priority) }}>{b.priority}</span>
                      <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{selectedBrand?.id === b.id ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Inline detail panel */}
                  {selectedBrand?.id === b.id && (
                    <div className="border-t px-5 py-5" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-dark-bg)" }}>
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: stageColor(b.stage) + "22", color: stageColor(b.stage) }}>
                            {STAGES.find(s => s.key === b.stage)?.label}
                          </span>
                          <span className="text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{b.category}</span>
                          <span className="text-xs" style={{ color: priColor(b.priority) }}>{b.priority} priority</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={e => { e.stopPropagation(); openEditBrand(b); }} className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
                          <button onClick={e => { e.stopPropagation(); deleteBrand(b.id); }} className="text-xs px-3 py-1.5 rounded border hover:bg-red-500/10 hover:text-red-400 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Delete</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                        {/* Contact */}
                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--psg-muted)" }}>Contact</div>
                          {b.rep      && <div className="text-sm text-white">{b.rep}</div>}
                          {b.repEmail && <a href={`mailto:${b.repEmail}`} className="text-xs hover:text-blue-400 transition-colors block" style={{ color: "var(--psg-muted)" }}>{b.repEmail}</a>}
                          {b.repPhone && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{b.repPhone}</div>}
                          {b.website  && <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-xs hover:text-blue-400 transition-colors block" style={{ color: "var(--psg-muted)" }}>{b.website}</a>}
                          {!b.rep && !b.repEmail && !b.website && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>No contact info</div>}
                        </div>

                        {/* Notes */}
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--psg-muted)" }}>Notes</div>
                          {b.notes ? <p className="text-sm text-white whitespace-pre-wrap">{b.notes}</p> : <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No notes</p>}
                        </div>

                        {/* Tasks */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Tasks</div>
                            <button onClick={e => { e.stopPropagation(); openNewTask(b.id); }} className="text-xs hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>+ Add</button>
                          </div>
                          {b.tasks.length === 0 ? (
                            <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No open tasks</p>
                          ) : (
                            <div className="space-y-2">
                              {b.tasks.map(t => (
                                <div key={t.id} className="flex items-start gap-2">
                                  <button onClick={async e => { e.stopPropagation(); await toggleTask(t); const updated = await fetch("/api/sales/brands").then(r => r.json()); if (Array.isArray(updated)) { setBrands(updated); setSelectedBrand(updated.find((x: SalesBrand) => x.id === b.id) ?? null); } }} className="mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center hover:border-blue-500 transition-colors" style={{ borderColor: "var(--psg-card-border)" }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white">{t.title}</div>
                                    {t.dueDate && <div className={`text-xs ${isOverdue(t.dueDate) ? "text-red-400" : ""}`} style={!isOverdue(t.dueDate) ? { color: "var(--psg-muted)" } : {}}>{fmtDate(t.dueDate)}</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick stage change */}
                      <div className="flex gap-2 pt-3 border-t flex-wrap" style={{ borderColor: "var(--psg-card-border)" }}>
                        {STAGES.map(s => (
                          <button key={s.key} onClick={async e => {
                            e.stopPropagation();
                            const r = await fetch(`/api/sales/brands/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, stage: s.key }) });
                            const updated = await r.json();
                            setBrands(bs => bs.map(x => x.id === b.id ? updated : x));
                            setSelectedBrand(updated);
                          }}
                            className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                            style={{ borderColor: b.stage === s.key ? s.color : "var(--psg-card-border)", backgroundColor: b.stage === s.key ? s.color + "22" : "transparent", color: b.stage === s.key ? s.color : "var(--psg-muted)" }}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Tasks tab ── */
        <>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--psg-muted)" }}>
              <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="rounded" />
              Show completed
            </label>
          </div>

          {displayTasks.length === 0 ? (
            <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              {showDone ? "No tasks yet." : "No pending tasks."}
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              {displayTasks.map((t, i) => (
                <div key={t.id} className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? "border-t" : ""}`} style={{ borderColor: "var(--psg-card-border)", opacity: t.completedAt ? 0.5 : 1 }}>
                  <button onClick={() => toggleTask(t)}
                    className="w-5 h-5 rounded border shrink-0 flex items-center justify-center hover:border-blue-500 transition-colors"
                    style={{ borderColor: t.completedAt ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: t.completedAt ? "var(--psg-blue)" : "transparent" }}>
                    {t.completedAt && <span className="text-white text-xs">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.completedAt ? "line-through" : "text-white"}`} style={t.completedAt ? { color: "var(--psg-muted)" } : {}}>
                      {t.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {t.brand && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{t.brand.name}</span>}
                      {t.notes && <span className="text-xs truncate" style={{ color: "var(--psg-muted)" }}>{t.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priColor(t.priority) }} title={`${t.priority} priority`} />
                    {t.dueDate && (
                      <span className={`text-xs ${isOverdue(t.dueDate) && !t.completedAt ? "text-red-400" : ""}`} style={!isOverdue(t.dueDate) || t.completedAt ? { color: "var(--psg-muted)" } : {}}>
                        {fmtDate(t.dueDate)}
                      </span>
                    )}
                    <button onClick={() => openEditTask(t)} className="text-xs hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>Edit</button>
                    <button onClick={() => deleteTask(t.id)} className="text-xs hover:text-red-400 transition-colors" style={{ color: "var(--psg-muted)" }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Brand form modal ── */}
      {showBrandForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-lg rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <h2 className="text-lg font-semibold text-white">{editBrand ? "Edit Brand" : "Add Brand"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Brand name *</label>
                <input className={inp} style={inpStyle} value={brandForm.name} onChange={e => setBrandForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Robe Lighting" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Category</label>
                <select className={inp} style={inpStyle} value={brandForm.category} onChange={e => setBrandForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Stage</label>
                <select className={inp} style={inpStyle} value={brandForm.stage} onChange={e => setBrandForm(f => ({ ...f, stage: e.target.value }))}>
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Priority</label>
                <select className={inp} style={inpStyle} value={brandForm.priority} onChange={e => setBrandForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Website</label>
                <input className={inp} style={inpStyle} value={brandForm.website} onChange={e => setBrandForm(f => ({ ...f, website: e.target.value }))} placeholder="https://…" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Rep name</label>
                <input className={inp} style={inpStyle} value={brandForm.rep} onChange={e => setBrandForm(f => ({ ...f, rep: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Rep email</label>
                <input className={inp} style={inpStyle} type="email" value={brandForm.repEmail} onChange={e => setBrandForm(f => ({ ...f, repEmail: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Rep phone</label>
                <input className={inp} style={inpStyle} value={brandForm.repPhone} onChange={e => setBrandForm(f => ({ ...f, repPhone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Notes</label>
                <textarea className={inp} style={inpStyle} rows={3} value={brandForm.notes} onChange={e => setBrandForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowBrandForm(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
              <button onClick={saveBrand} className="px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors" style={{ backgroundColor: "var(--psg-blue)" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task form modal ── */}
      {showTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <h2 className="text-lg font-semibold text-white">{editTask ? "Edit Task" : "Add Task"}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Task *</label>
                <input className={inp} style={inpStyle} value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs doing?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Brand</label>
                  <select className={inp} style={inpStyle} value={taskForm.brandId} onChange={e => setTaskForm(f => ({ ...f, brandId: e.target.value }))}>
                    <option value="">None</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Priority</label>
                  <select className={inp} style={inpStyle} value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Due date</label>
                <input type="date" className={inp} style={inpStyle} value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Notes</label>
                <textarea className={inp} style={inpStyle} rows={2} value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowTaskForm(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
              <button onClick={saveTask} className="px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors" style={{ backgroundColor: "var(--psg-blue)" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
