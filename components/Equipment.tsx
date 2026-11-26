"use client";

// Equipment & checks on a workshop's Safety page (26 Nov 2026): every item of kit with the checks it
// needs (PAT, service, LOLER thorough examination, inspections, COSHH reviews), when each is next
// due, and what's out of use. A failed check takes an item out of use until a later pass. The
// workshop's staff add kit and record results; everyone in the space can see it.
import { useEffect, useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { card, h2, muted, link, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";
import { CATEGORIES, CATEGORY_LABEL, CHECK_KINDS, KIND_LABEL, ITEM_LABEL, USUAL_CHECKS, type CheckStatus, type ItemStatus } from "@/lib/equipmentCore";

type Rec = { id: number; doneAt: string; passed: boolean; doneBy: string; notes: string | null; nextDue: string | null; fileName: string | null };
type Check = { id: number; kind: string; label: string | null; intervalMonths: number; firstDue: string | null; records: Rec[]; status: CheckStatus; due: string | null };
type Item = { id: number; name: string; category: string; assetTag: string | null; location: string | null; archived: boolean; needsInduction: boolean; outOfUseAt: string | null; outOfUseNote: string | null; checks: Check[]; status: ItemStatus };
type Data = { staff: boolean; items: Item[] };

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const today = () => new Date().toISOString().slice(0, 10);
const TONE: Record<ItemStatus | CheckStatus, React.CSSProperties> = {
  ok: { background: "#e2f1e7", color: "#1d6b3c" },
  due: { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)" },
  never: { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)" },
  overdue: { background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)" },
  failed: { background: "var(--tws-bad-ink)", color: "#fff" },
  out: { background: "var(--tws-bad-ink)", color: "#fff" },
};
const INK: Record<CheckStatus, string | undefined> = { ok: undefined, due: "var(--tws-warn-ink)", never: "var(--tws-warn-ink)", overdue: "var(--tws-bad-ink)", failed: "var(--tws-bad-ink)" };
const checkText = (c: Check) => c.status === "failed" ? "failed" : c.status === "never" ? "no record yet" : c.due ? `${c.status === "overdue" ? "overdue since" : "due"} ${day(c.due)}` : "done";
const cell: React.CSSProperties = { ...input, padding: "6px 8px", fontSize: 13 };
const pill = (s: ItemStatus | CheckStatus) => ({ ...TONE[s], fontSize: 12, fontWeight: 700, padding: "2px 8px", whiteSpace: "nowrap" as const });

async function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
}

export default function Equipment({ slug, myName }: { slug: string; myName: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState<null | { name: string; category: string; assetTag: string; location: string; needsInduction: boolean; checks: { kind: string; intervalMonths: number; on: boolean }[] }>(null);
  const [rec, setRec] = useState<null | { checkId: number; doneAt: string; passed: boolean | null; doneBy: string; notes: string; file: File | null }>(null);
  const [newCheck, setNewCheck] = useState({ kind: "pat", intervalMonths: "12", firstDue: "" });
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [busy, setBusy] = useState(false);
  const api = `/api/spaces/${slug}/equipment`;

  useEffect(() => { fetch(api).then(r => (r.ok ? r.json() : null)).then(x => x && setD(x)).catch(() => {}); }, [api]);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const x = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(x.error ?? "That didn't work"); return null; }
    if (x.items) setD(x);
    return x;
  }
  const patch = (it: Item, body: Record<string, unknown>) => call(`/api/machines/${it.id}?view=equipment`, "PATCH", body);
  const startAdd = (category = "machine") => setAdding({ name: "", category, assetTag: "", location: "", needsInduction: category === "machine", checks: USUAL_CHECKS[category].map(c => ({ ...c, on: true })) });

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!rec || rec.passed === null) return;
    const file = rec.file ? { name: rec.file.name, dataUrl: await fileToDataUrl(rec.file) } : undefined;
    if (await call(`/api/equipment-checks/${rec.checkId}/records`, "POST", { doneAt: rec.doneAt, passed: rec.passed, doneBy: rec.doneBy, notes: rec.notes, file })) setRec(null);
  }

  if (!d) return null;
  const live = d.items.filter(i => !i.archived);
  const shown = live.filter(i => filter === "all" || i.status !== "ok");
  const count = (s: ItemStatus) => live.filter(i => i.status === s).length;

  return (
    <section id="equipment" style={card} className="flex flex-col gap-4 min-w-0" aria-label="Equipment and checks">
      <div className="flex flex-wrap justify-between items-baseline gap-3">
        <div className="flex flex-col gap-1">
          <h2 style={h2}>Equipment &amp; checks</h2>
          <span className="text-sm" style={muted}>
            {live.length ? [count("out") && `${count("out")} out of use`, count("overdue") && `${count("overdue")} with a check overdue`, count("due") && `${count("due")} due soon`].filter(Boolean).join(" · ") || "Everything's in date." : "PAT tests, servicing, lifting gear, ladders, extinguishers and COSHH, with when each is next due."}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {live.length > 0 && (["all", "attention"] as const).map(f => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="text-xs px-2.5 py-1" style={filter === f ? { background: "var(--tws-char)", color: "#fff" } : { border: "1px solid var(--tws-line)", color: "var(--tws-muted)" }}>{f === "all" ? "All" : "Needs attention"}</button>)}
          {d.staff && !adding && <button type="button" onClick={() => startAdd()} style={{ ...btnSolid, padding: "8px 14px" }}>+ Add equipment</button>}
        </div>
      </div>

      {adding && (
        <form className="flex flex-col gap-3 p-3" style={{ background: "var(--tws-ground)", borderTop: "4px solid var(--tws-accent)" }}
          onSubmit={async e => { e.preventDefault(); if (await call(api, "POST", { ...adding, checks: adding.checks.filter(c => c.on).map(({ kind, intervalMonths }) => ({ kind, intervalMonths })) })) setAdding(null); }}>
          <strong className="text-sm">Add equipment</strong>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><label htmlFor="eq-name" style={lbl}>What is it?</label><input id="eq-name" required autoFocus style={input} value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} placeholder="e.g. 2-leg chain sling, 1t" /></div>
            <div><label htmlFor="eq-cat" style={lbl}>Kind of kit</label>
              <select id="eq-cat" style={input} value={adding.category} onChange={e => setAdding({ ...adding, category: e.target.value, needsInduction: e.target.value === "machine", checks: USUAL_CHECKS[e.target.value].map(c => ({ ...c, on: true })) })}>
                {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
            <div><label htmlFor="eq-tag" style={lbl}>Asset tag (optional)</label><input id="eq-tag" style={input} value={adding.assetTag} onChange={e => setAdding({ ...adding, assetTag: e.target.value })} placeholder="e.g. TWS-SL-04" /></div>
            <div><label htmlFor="eq-loc" style={lbl}>Where it lives (optional)</label><input id="eq-loc" style={input} value={adding.location} onChange={e => setAdding({ ...adding, location: e.target.value })} /></div>
          </div>
          <fieldset className="flex flex-col gap-1.5 m-0 p-0 border-0">
            <legend className="text-xs font-semibold mb-1" style={muted}>Checks it needs (you can add more after)</legend>
            {adding.checks.map((c, n) => (
              <label key={c.kind} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={c.on} onChange={e => setAdding({ ...adding, checks: adding.checks.map((x, i) => (i === n ? { ...x, on: e.target.checked } : x)) })} style={{ accentColor: "var(--tws-char)" }} />
                {KIND_LABEL[c.kind]} every
                <input aria-label={`${KIND_LABEL[c.kind]} interval in months`} type="number" min={0} max={120} style={{ ...cell, width: 64 }} value={c.intervalMonths} onChange={e => setAdding({ ...adding, checks: adding.checks.map((x, i) => (i === n ? { ...x, intervalMonths: Number(e.target.value) } : x)) })} /> months
              </label>
            ))}
            {adding.checks.length === 0 && <span className="text-xs" style={muted}>None by default for this kind.</span>}
          </fieldset>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={adding.needsInduction} onChange={e => setAdding({ ...adding, needsInduction: e.target.checked })} style={{ accentColor: "var(--tws-char)" }} />People need an induction to use it (shows in the inductions table)</label>
          <div className="flex gap-2"><button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Add</button><button type="button" onClick={() => setAdding(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button></div>
        </form>
      )}

      {live.length === 0 && !adding && <p className="text-sm m-0" style={muted}>No equipment yet.{d.staff ? " Machines added for inductions appear here too." : ""}</p>}
      {shown.length === 0 && live.length > 0 && <p className="text-sm m-0" style={muted}>Nothing needs attention.</p>}

      {CATEGORIES.filter(([k]) => shown.some(i => i.category === k)).map(([k, label]) => (
        <div key={k} className="flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider m-0 mb-1" style={muted}>{label}</h3>
          <ul className="m-0 p-0 list-none">
            {shown.filter(i => i.category === k).map(it => {
              const isOpen = open === it.id;
              return (
                <li key={it.id} style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                  <button type="button" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : it.id); setRec(null); }} className="w-full text-left py-2 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-black/[.03]">
                    <span className="font-semibold text-sm flex-1 min-w-[10rem]">{it.name}{it.assetTag && <span className="font-normal" style={muted}> · {it.assetTag}</span>}{it.location && <span className="font-normal" style={muted}> · {it.location}</span>}</span>
                    <span className="text-xs flex flex-wrap gap-x-3" style={muted}>{it.checks.map(c => <span key={c.id}>{KIND_LABEL[c.kind]}: <span style={{ color: INK[c.status] }}>{checkText(c)}</span></span>)}</span>
                    <span style={pill(it.status)}>{ITEM_LABEL[it.status]}</span>
                  </button>

                  {isOpen && (
                    <div className="flex flex-col gap-3 pb-3 pl-2">
                      {(it.outOfUseAt || it.checks.some(c => c.status === "failed")) && (
                        <p className="text-sm m-0 px-3 py-2" style={{ background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)" }}>
                          <strong>Don&apos;t use.</strong> {it.outOfUseAt ? `Taken out of use ${day(it.outOfUseAt)}: ${it.outOfUseNote}` : `It failed its ${it.checks.filter(c => c.status === "failed").map(c => KIND_LABEL[c.kind]).join(" and ")}. Record a pass when it's fixed.`}
                        </p>
                      )}
                      {it.checks.map(c => (
                        <div key={c.id} className="flex flex-col gap-1.5 p-2" style={{ background: "var(--tws-ground)" }}>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <strong>{KIND_LABEL[c.kind]}{c.label ? ` (${c.label})` : ""}</strong>
                            <span style={muted}>{c.intervalMonths ? `every ${c.intervalMonths} month${c.intervalMonths === 1 ? "" : "s"}` : "one-off"}</span>
                            <span style={pill(c.status)}>{checkText(c)}</span>
                            {d.staff && <span className="ml-auto flex gap-3 text-xs">
                              <button type="button" onClick={() => setRec({ checkId: c.id, doneAt: today(), passed: null, doneBy: myName, notes: "", file: null })} style={link}>Record a result</button>
                              <button type="button" disabled={busy} onClick={async () => { if (await confirmDialog(`Stop tracking ${KIND_LABEL[c.kind]} on ${it.name}? Its history goes too.`, { danger: true })) call(`/api/equipment-checks/${c.id}`, "DELETE"); }} style={muted}>Remove</button>
                            </span>}
                          </div>
                          {rec?.checkId === c.id && (
                            <form onSubmit={saveRecord} className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] items-end">
                              <div><label htmlFor={`rd-${c.id}`} style={lbl}>Date done</label><input id={`rd-${c.id}`} type="date" required max={today()} style={cell} value={rec.doneAt} onChange={e => setRec({ ...rec, doneAt: e.target.value })} /></div>
                              <div><label htmlFor={`rb-${c.id}`} style={lbl}>Done by (person or company)</label><input id={`rb-${c.id}`} required style={cell} value={rec.doneBy} onChange={e => setRec({ ...rec, doneBy: e.target.value })} /></div>
                              <fieldset className="flex gap-2 m-0 p-0 border-0" aria-label="Result">
                                {[true, false].map(v => <button key={String(v)} type="button" aria-pressed={rec.passed === v} onClick={() => setRec({ ...rec, passed: v })} className="flex-1 text-sm font-bold py-1.5" style={rec.passed === v ? pill(v ? "ok" : "failed") : { border: "1px solid var(--tws-line)" }}>{v ? "Pass" : "Fail"}</button>)}
                              </fieldset>
                              <div className="sm:col-span-2"><label htmlFor={`rn-${c.id}`} style={lbl}>Notes (optional)</label><input id={`rn-${c.id}`} style={cell} value={rec.notes} onChange={e => setRec({ ...rec, notes: e.target.value })} placeholder={rec.passed === false ? "What failed?" : ""} /></div>
                              <div><label htmlFor={`rf-${c.id}`} style={lbl}>Certificate (optional)</label><input id={`rf-${c.id}`} type="file" accept="application/pdf,image/*" className="text-xs" onChange={e => setRec({ ...rec, file: e.target.files?.[0] ?? null })} /></div>
                              <div className="sm:col-span-3 flex gap-2"><button type="submit" disabled={busy || rec.passed === null} style={{ ...btnSolid, padding: "6px 14px", fontSize: 13 }}>Save result</button><button type="button" onClick={() => setRec(null)} style={{ ...btnLine, padding: "6px 14px", fontSize: 13 }}>Cancel</button>
                                {rec.passed === false && <span className="text-xs self-center" style={{ color: "var(--tws-bad-ink)" }}>A fail takes {it.name} out of use until a pass is recorded.</span>}</div>
                            </form>
                          )}
                          {c.records.length > 0 && (
                            <ul className="m-0 p-0 list-none text-xs flex flex-col gap-0.5" aria-label={`${KIND_LABEL[c.kind]} history`}>
                              {c.records.map(r => (
                                <li key={r.id}><span style={{ color: r.passed ? "#1d6b3c" : "var(--tws-bad-ink)", fontWeight: 700 }}>{r.passed ? "Pass" : "Fail"}</span> {day(r.doneAt)} · {r.doneBy}{r.notes ? ` · ${r.notes}` : ""}
                                  {r.fileName && <> · <a href={`/api/equipment-check-records/${r.id}`} target="_blank" rel="noopener noreferrer" style={link}>{r.fileName}</a></>}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                      {it.checks.length === 0 && <p className="text-xs m-0" style={muted}>No checks set for this item.</p>}

                      {d.staff && (
                        <div className="flex flex-col gap-2 text-sm">
                          <form className="flex flex-wrap gap-2 items-center" aria-label="Add a check" onSubmit={async e => { e.preventDefault(); if (await call(`/api/machines/${it.id}/checks`, "POST", newCheck)) setNewCheck({ kind: "pat", intervalMonths: "12", firstDue: "" }); }}>
                            <span style={muted}>Add a check:</span>
                            <select aria-label="Kind of check" style={{ ...cell, width: "auto" }} value={newCheck.kind} onChange={e => setNewCheck({ ...newCheck, kind: e.target.value, intervalMonths: String(CHECK_KINDS.find(k => k[0] === e.target.value)?.[2] ?? 12) })}>{CHECK_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                            every <input aria-label="Interval in months" type="number" min={0} max={120} style={{ ...cell, width: 64 }} value={newCheck.intervalMonths} onChange={e => setNewCheck({ ...newCheck, intervalMonths: e.target.value })} /> months, first due
                            <input aria-label="First due" type="date" style={{ ...cell, width: "auto" }} value={newCheck.firstDue} onChange={e => setNewCheck({ ...newCheck, firstDue: e.target.value })} />
                            <button type="submit" disabled={busy} style={{ ...btnLine, padding: "5px 12px", fontSize: 13 }}>Add</button>
                          </form>
                          <div className="flex flex-wrap gap-x-4 gap-y-2 items-center text-xs">
                            {it.outOfUseAt
                              ? <button type="button" disabled={busy} onClick={() => patch(it, { outOfUse: false })} style={link}>Put back in use</button>
                              : <form className="flex gap-2 items-center" onSubmit={e => { e.preventDefault(); const why = (e.currentTarget.elements.namedItem("why") as HTMLInputElement).value; patch(it, { outOfUse: why }); }}>
                                  <input name="why" aria-label="Why take it out of use" required placeholder="Why (e.g. blade damaged)" style={{ ...cell, width: 200 }} />
                                  <button type="submit" disabled={busy} style={{ color: "var(--tws-bad-ink)", fontWeight: 700 }}>Take out of use</button>
                                </form>}
                            <label className="flex items-center gap-1.5" style={muted}><select aria-label="Kind of kit" style={{ ...cell, width: "auto", padding: "3px 6px" }} value={it.category} onChange={e => patch(it, { category: e.target.value })}>{CATEGORIES.map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}</select></label>
                            <label className="flex items-center gap-1.5" style={muted}><input type="checkbox" checked={it.needsInduction} onChange={e => patch(it, { needsInduction: e.target.checked })} style={{ accentColor: "var(--tws-char)" }} />Needs an induction</label>
                            <button type="button" disabled={busy} onClick={async () => { if (await confirmDialog(`Retire ${it.name}? It drops off the list and the inductions table; its history is kept.`)) patch(it, { archived: true }); }} style={muted}>Retire</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {d.items.some(i => i.archived) && d.staff && (
        <details className="text-xs" style={muted}><summary className="cursor-pointer">Retired ({d.items.filter(i => i.archived).length})</summary>
          <ul className="m-0 mt-1 pl-4">{d.items.filter(i => i.archived).map(i => <li key={i.id}>{i.name} · {CATEGORY_LABEL[i.category]} · <button type="button" onClick={() => patch(i, { archived: false })} style={link}>Restore</button></li>)}</ul>
        </details>
      )}
    </section>
  );
}
