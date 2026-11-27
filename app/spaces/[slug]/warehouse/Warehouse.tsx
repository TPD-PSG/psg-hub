"use client";

// The warehouse floor: pick a hire, then scan its kit out (prep) or back in. Works with a handheld
// scanner (it types the barcode and presses Enter into the box, which keeps focus), the phone's
// camera, or typing. A case scans everything packed in it. Coming back, anything damaged goes
// into repair (with a charge on the hire if you like) and anything not back can be marked missing.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { confirmDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import { card, h2, muted, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";
import { RentalsHeader, Chip, api, th, td } from "@/components/rentals/shared";
import { gbp, day, HIRE_TONE, HIRE_LABEL } from "@/components/rentals/format";

const CameraScanner = dynamic(() => import("@/components/rentals/CameraScanner"), { ssr: false });

type ListHire = { id: number; number: string; title: string; status: string; clientName: string | null; outDate: string; returnDate: string; toScan: number; scanned: number; outNow: number; wanted: number; subHiresWaiting: number };
export type WarehouseList = { space: SpaceTheme; hires: ListHire[] };
type HU = { id: number; outAt: string; backAt: string | null; condition: string | null; note: string | null; outBy: { name: string } | null; backBy: { name: string } | null;
  unit: { id: number; barcode: string; serial: string | null; location: string | null; containerId: number | null; product: { id: number; name: string; category: string | null; replacementCost: number | null } } };
type View = {
  hire: { id: number; number: string; title: string; status: string; clientName: string | null; outDate: string; returnDate: string; delivery: string | null; deliveryTo: string | null;
    subHires: { id: number; description: string; quantity: number; status: string; supplierName: string | null; product: { name: string } | null }[]; units: HU[] };
  progress: { rows: { productId: number; name: string; wanted: number; subHired: number; fromUs: number; scanned: number; toScan: number; back: number; shelves: string[] }[]; extra: { productId: number; name: string; scanned: number; back: number }[]; toScan: number; ready: boolean; outNow: number; allBack: boolean };
};
type Flash = { ok: boolean; text: string } | null;

export default function Warehouse({ initial, hireId, mode: mode0 }: { initial: WarehouseList; hireId: number | null; mode: "out" | "in" }) {
  const [list, setList] = useState(initial);
  const { space } = list;
  const S = `/api/spaces/${space.slug}/rentals`;
  const [view, setView] = useState<View | null>(null);
  const [mode, setMode] = useState<"out" | "in">(mode0);
  const [code, setCode] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [damage, setDamage] = useState<{ hu: HU; condition: "damaged" | "missing"; note: string; charge: string } | null>(null);
  const [quick, setQuick] = useState("");
  const box = useRef<HTMLInputElement>(null);

  const reloadList = useCallback(async () => { const d = await api<WarehouseList>(`${S}/warehouse`); if (d) setList(d); }, [S]);
  const open = useCallback(async (id: number, m?: "out" | "in") => {
    const v = await api<View>(`/api/rentals/hires/${id}/warehouse`);
    if (!v) return;
    setView(v); setFlash(null); setCode("");
    setMode(m ?? (v.hire.status === "out" && v.progress.toScan === 0 ? "in" : "out"));
    window.history.replaceState(null, "", `/spaces/${space.slug}/warehouse?hire=${id}`);
    setTimeout(() => box.current?.focus(), 50);
  }, [space.slug]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- opens the hire named in the link, once
  useEffect(() => { if (hireId) open(hireId, mode0); }, [hireId, mode0, open]);

  const scan = useCallback(async (raw: string) => {
    const c = raw.trim();
    if (!c || !view || busy) return;
    setBusy(true);
    const r = await fetch(`/api/rentals/hires/${view.hire.id}/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barcode: c, mode }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setCode("");
    if (!r.ok) { setFlash({ ok: false, text: j.error ?? "That didn't scan" }); try { navigator.vibrate?.([80, 60, 80]); } catch { /* */ } }
    else { setFlash({ ok: true, text: j.message }); setView(j.view); }
    box.current?.focus();
  }, [view, mode, busy]);

  async function undo(hu: HU) {
    if (!view) return;
    const r = await api<{ view: View }>(`/api/rentals/hires/${view.hire.id}/scan`, "DELETE", { unitId: hu.unit.id });
    if (r) { setView(r.view); setFlash({ ok: true, text: `${hu.unit.product.name} ${hu.unit.barcode} taken off the hire` }); }
  }
  async function saveCondition(e: React.FormEvent) {
    e.preventDefault();
    if (!damage) return;
    setBusy(true);
    const r = await api<{ view: View }>(`/api/rentals/hire-units/${damage.hu.id}`, "PATCH", { condition: damage.condition, note: damage.note, charge: damage.charge });
    setBusy(false);
    if (r) { setView(r.view); setDamage(null); setFlash({ ok: true, text: `${damage.hu.unit.product.name} ${damage.hu.unit.barcode} marked ${damage.condition}${damage.condition === "damaged" ? " and put into repair" : " and lost"}${damage.charge ? `, ${gbp(Number(damage.charge))} charged on the hire` : ""}` }); }
  }
  async function backOk(hu: HU) {
    const r = await api<{ view: View }>(`/api/rentals/hire-units/${hu.id}`, "PATCH", { condition: "ok" });
    if (r) setView(r.view);
  }
  async function restMissing() {
    if (!view) return;
    const out = view.hire.units.filter(u => !u.backAt);
    if (!(await confirmDialog(`Mark the ${out.length} unit${out.length === 1 ? "" : "s"} still out as missing? They'll be marked lost on Kit. You can change one back if it turns up.`, { confirmLabel: "Mark missing" }))) return;
    let last: View | null = null;
    for (const u of out) { const r = await api<{ view: View }>(`/api/rentals/hire-units/${u.id}`, "PATCH", { condition: "missing", note: "Not back when the hire was closed" }); if (r) last = r.view; }
    if (last) setView(last);
  }
  async function quickIn(e: React.FormEvent) {
    e.preventDefault();
    if (!quick.trim()) return;
    const r = await fetch(`${S}/checkin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barcode: quick }) });
    const j = await r.json().catch(() => ({}));
    setQuick("");
    setFlash(r.ok ? { ok: true, text: j.message } : { ok: false, text: j.error ?? "That didn't check in" });
    if (r.ok) reloadList();
  }
  const back = () => { setView(null); setCamera(false); setFlash(null); reloadList(); window.history.replaceState(null, "", `/spaces/${space.slug}/warehouse`); };

  const toPrep = list.hires.filter(h => h.status === "confirmed" || (h.status === "out" && h.toScan > 0));
  const outNow = list.hires.filter(h => h.status === "out");
  const flashBox = flash && (
    <div role={flash.ok ? "status" : "alert"} className="px-4 py-3 text-base font-semibold" style={flash.ok ? { background: "var(--tws-accent-light)", color: "var(--tws-ink)", borderLeft: "6px solid var(--tws-accent)" } : { background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)", borderLeft: "6px solid var(--tws-bad-ink)" }}>{flash.text}</div>
  );

  if (!view) return (
    <>
      <RentalsHeader space={space} title="Warehouse" line="Prep hires by scanning their kit out, and check it back in" />
      <div className="px-4 sm:px-10 pt-6 pb-10 flex flex-col gap-6">
        <form onSubmit={quickIn} style={card} className="flex flex-col gap-2" aria-label="Quick check-in">
          <h2 style={h2}>Check something in</h2>
          <p className="text-sm" style={muted}>Scan any unit that&apos;s come back: it&apos;s checked in on whichever hire it went out on.</p>
          <div className="flex gap-2"><label htmlFor="quick" className="sr-only">Barcode</label>
            <input id="quick" style={input} value={quick} onChange={e => setQuick(e.target.value)} placeholder="Scan or type a barcode" autoComplete="off" />
            <button type="submit" style={btnSolid}>Check in</button></div>
          {flashBox}
        </form>
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <section style={card} className="flex flex-col gap-2 min-w-0" aria-label="To prep">
            <h2 style={h2}>To prep</h2>
            <p className="text-xs" style={muted}>Confirmed hires going out in the next two weeks.</p>
            {toPrep.length === 0 ? <p className="text-sm" style={muted}>Nothing to prep.</p> : toPrep.map(h => <HireRow key={h.id} h={h} onOpen={() => open(h.id, "out")} line={`Out ${day(h.outDate)} · ${h.toScan ? `${h.toScan} of ${h.wanted} still to scan` : "all scanned"}${h.subHiresWaiting ? ` · ${h.subHiresWaiting} sub-hire${h.subHiresWaiting === 1 ? "" : "s"} not in yet` : ""}`} />)}
          </section>
          <section style={card} className="flex flex-col gap-2 min-w-0" aria-label="Out now">
            <h2 style={h2}>Out now</h2>
            <p className="text-xs" style={muted}>Check kit back in against its hire.</p>
            {outNow.length === 0 ? <p className="text-sm" style={muted}>Nothing out.</p> : outNow.map(h => <HireRow key={h.id} h={h} onOpen={() => open(h.id, "in")} line={`Back ${day(h.returnDate)} · ${h.outNow} unit${h.outNow === 1 ? "" : "s"} still out`} />)}
          </section>
        </div>
      </div>
    </>
  );

  const { hire, progress } = view;
  const outUnits = hire.units.filter(u => !u.backAt), backUnits = hire.units.filter(u => u.backAt);
  const closed = ["returned", "cancelled", "quote"].includes(hire.status);
  return (
    <>
      <RentalsHeader space={space} title={`${hire.number} · ${hire.title}`} line={`${hire.clientName ?? "No client"} · out ${day(hire.outDate)}, back ${day(hire.returnDate)}${hire.delivery === "delivery" ? " · we deliver" : hire.delivery === "collection" ? " · client collects" : ""}`}>
        <button type="button" style={btnLine} onClick={back}>← All hires</button>
        <Link href={`/spaces/${space.slug}/hires?hire=${hire.id}`} style={btnLine}>Open the hire</Link>
      </RentalsHeader>
      <div className="px-4 sm:px-10 pt-6 pb-10 grid gap-6 xl:grid-cols-5 items-start">
        <section style={{ ...card, borderTop: "6px solid var(--tws-accent)" }} className="xl:col-span-2 flex flex-col gap-3 min-w-0" aria-label="Scan">
          <div className="flex gap-1.5 items-center flex-wrap">
            <Chip on={mode === "out"} onClick={() => { setMode("out"); setFlash(null); box.current?.focus(); }}>Prep: scan out</Chip>
            <Chip on={mode === "in"} onClick={() => { setMode("in"); setFlash(null); box.current?.focus(); }}>Check in</Chip>
            <span className="ml-auto text-[11px] font-bold px-2 py-0.5" style={HIRE_TONE[hire.status]}>{HIRE_LABEL[hire.status]}</span>
          </div>
          {closed && <p className="text-sm" style={muted}>{hire.status === "quote" ? "Confirm the hire before prepping it." : "This hire is closed."}</p>}
          <form onSubmit={e => { e.preventDefault(); scan(code); }} className="flex gap-2">
            <label htmlFor="scan-box" className="sr-only">Barcode</label>
            <input id="scan-box" ref={box} style={{ ...input, fontSize: 20, padding: "12px 12px", fontFamily: "ui-monospace, monospace" }} value={code} onChange={e => setCode(e.target.value)}
              placeholder={mode === "out" ? "Scan kit going out" : "Scan kit coming back"} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={closed && mode === "out"} />
            <button type="submit" disabled={busy} style={btnSolid}>{mode === "out" ? "Out" : "In"}</button>
          </form>
          {camera ? <CameraScanner onCode={c => scan(c)} onClose={() => setCamera(false)} />
            : <button type="button" style={btnLine} onClick={() => setCamera(true)}>Scan with the camera</button>}
          {flashBox}
          <p className="text-xs" style={muted}>A handheld scanner types into the box and presses Enter. Scanning a case scans everything packed in it.</p>
        </section>

        <div className="xl:col-span-3 flex flex-col gap-6 min-w-0">
          <section style={card} className="flex flex-col gap-3 min-w-0" aria-label="Pick list">
            <div className="flex justify-between gap-2 items-baseline flex-wrap">
              <h2 style={h2}>{mode === "out" ? "Pick list" : "What went out"}</h2>
              <span className="text-sm font-semibold" style={progress.ready ? { color: "var(--tws-accent-ink)" } : muted}>
                {mode === "out" ? (progress.ready ? "All scanned ✓" : `${progress.toScan} still to scan`) : `${progress.outNow} still out`}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Product</th><th style={{ ...th, textAlign: "right" }}>Wanted</th><th style={{ ...th, textAlign: "right" }}>{mode === "out" ? "Scanned" : "Back"}</th><th style={th}>{mode === "out" ? "Shelf" : ""}</th></tr></thead>
                <tbody>
                  {progress.rows.map(r => (
                    <tr key={r.productId} style={mode === "out" && r.toScan === 0 ? { background: "var(--tws-tint)" } : undefined}>
                      <td style={td}><span className="font-semibold">{r.name}</span>{r.subHired ? <span className="block text-xs" style={muted}>{r.subHired} sub-hired, {r.fromUs} from us</span> : null}</td>
                      <td style={{ ...td, textAlign: "right" }}>{r.fromUs}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{mode === "out" ? `${r.scanned}${r.toScan === 0 ? " ✓" : ""}` : `${r.back} / ${r.scanned}`}</td>
                      <td style={{ ...td, fontSize: 12 }}>{mode === "out" && r.toScan > 0 ? r.shelves.join(", ") || "—" : ""}</td>
                    </tr>
                  ))}
                  {progress.extra.map(x => <tr key={`x${x.productId}`}><td style={td}>{x.name} <span className="text-xs" style={muted}>(case or packed in one)</span></td><td style={td} /><td style={{ ...td, textAlign: "right" }}>{mode === "out" ? x.scanned : `${x.back} / ${x.scanned}`}</td><td style={td} /></tr>)}
                </tbody>
              </table>
            </div>
            {hire.subHires.length > 0 && (
              <div className="text-sm"><span className="font-semibold">Sub-hires: </span>{hire.subHires.map(s => `${s.quantity} × ${s.product?.name ?? s.description}${s.supplierName ? ` from ${s.supplierName}` : ""} (${s.status === "returned" ? "sent back" : s.status})`).join("; ")}</div>
            )}
          </section>

          <section style={card} className="flex flex-col gap-3 min-w-0" aria-label="Units">
            <div className="flex justify-between gap-2 items-baseline flex-wrap">
              <h2 style={h2}>{mode === "out" ? `Scanned out (${hire.units.length})` : `Still out (${outUnits.length})`}</h2>
              {mode === "in" && outUnits.length > 0 && <button type="button" className="text-sm font-semibold" style={{ color: "var(--tws-bad-ink)" }} onClick={restMissing}>Mark the rest missing</button>}
            </div>
            {(mode === "out" ? hire.units : outUnits).length === 0 ? <p className="text-sm" style={muted}>{mode === "out" ? "Nothing scanned yet." : progress.allBack ? "Everything's back." : "Nothing out."}</p> : (
              <ul className="flex flex-col">
                {(mode === "out" ? hire.units : outUnits).map(hu => (
                  <li key={hu.id} className="py-2 flex gap-3 items-center flex-wrap" style={{ borderBottom: "1px solid var(--tws-line)" }}>
                    <span className="font-mono font-bold">{hu.unit.barcode}</span>
                    <span className="flex-1 min-w-[120px]">{hu.unit.product.name}{hu.unit.containerId ? <span className="text-xs" style={muted}> · in a case</span> : null}</span>
                    {hu.backAt ? <span className="text-xs font-bold" style={hu.condition === "ok" ? muted : { color: "var(--tws-bad-ink)" }}>{hu.condition === "ok" ? "Back" : hu.condition === "damaged" ? "Damaged" : "Missing"}</span>
                      : mode === "out" ? <button type="button" className="text-xs font-semibold" style={{ color: "var(--tws-bad-ink)" }} onClick={() => undo(hu)}>Take off</button>
                      : <span className="flex gap-3">
                          <button type="button" className="text-xs font-semibold" style={{ color: "var(--tws-warn-ink)" }} onClick={() => setDamage({ hu, condition: "damaged", note: "", charge: "" })}>Damaged…</button>
                          <button type="button" className="text-xs font-semibold" style={{ color: "var(--tws-bad-ink)" }} onClick={() => setDamage({ hu, condition: "missing", note: "", charge: hu.unit.product.replacementCost != null ? String(hu.unit.product.replacementCost) : "" })}>Missing…</button></span>}
                  </li>
                ))}
              </ul>
            )}
            {mode === "in" && backUnits.length > 0 && (
              <details>
                <summary className="text-sm font-semibold cursor-pointer">Back in ({backUnits.length})</summary>
                <ul className="flex flex-col mt-2">{backUnits.map(hu => (
                  <li key={hu.id} className="py-1.5 flex gap-3 items-center flex-wrap text-sm" style={{ borderBottom: "1px solid var(--tws-line)" }}>
                    <span className="font-mono font-bold">{hu.unit.barcode}</span><span className="flex-1">{hu.unit.product.name}{hu.note ? <span style={muted}> · {hu.note}</span> : null}</span>
                    <span className="text-xs font-bold" style={hu.condition === "ok" ? muted : { color: "var(--tws-bad-ink)" }}>{hu.condition === "ok" ? "OK" : hu.condition === "damaged" ? "Damaged" : "Missing"}</span>
                    {hu.condition === "ok" ? <button type="button" className="text-xs font-semibold" style={{ color: "var(--tws-warn-ink)" }} onClick={() => setDamage({ hu, condition: "damaged", note: "", charge: "" })}>Found damage…</button>
                      : <button type="button" className="text-xs font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={() => backOk(hu)}>{hu.condition === "missing" ? "Turned up OK" : "Back in service"}</button>}
                  </li>))}</ul>
              </details>
            )}
          </section>

          {damage && (
            <form onSubmit={saveCondition} style={{ ...card, borderTop: "6px solid var(--tws-bad-ink)" }} className="flex flex-col gap-3" aria-label={damage.condition === "damaged" ? "Report damage" : "Mark missing"}>
              <h2 style={h2}>{damage.condition === "damaged" ? "Damaged" : "Missing"}: {damage.hu.unit.product.name} {damage.hu.unit.barcode}</h2>
              <p className="text-sm" style={muted}>{damage.condition === "damaged" ? "It goes into repair on Kit, so it can't go out again until it's fixed." : "It's marked lost on Kit. If it turns up, mark it back."}</p>
              <div><label style={lbl} htmlFor="dmg-note">{damage.condition === "damaged" ? "What's wrong" : "Note"}</label><input id="dmg-note" style={input} required={damage.condition === "damaged"} maxLength={500} value={damage.note} onChange={e => setDamage({ ...damage, note: e.target.value })} /></div>
              <div><label style={lbl} htmlFor="dmg-charge">Charge the client £ (optional; added to the hire)</label><input id="dmg-charge" style={{ ...input, maxWidth: 160 }} inputMode="decimal" value={damage.charge} onChange={e => setDamage({ ...damage, charge: e.target.value })} />
                {damage.hu.unit.product.replacementCost != null && <span className="text-xs" style={muted}> Replacement cost {gbp(damage.hu.unit.product.replacementCost)}</span>}</div>
              <div className="flex gap-2"><button type="submit" disabled={busy} style={btnSolid}>Save</button><button type="button" style={btnLine} onClick={() => setDamage(null)}>Cancel</button></div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function HireRow({ h, onOpen, line }: { h: ListHire; onOpen: () => void; line: string }) {
  return (
    <button type="button" onClick={onOpen} className="w-full text-left py-3 flex flex-col gap-1" style={{ borderBottom: "1px solid var(--tws-line)" }}>
      <span className="flex justify-between gap-2 items-center"><span className="font-semibold truncate">{h.number} · {h.title}</span>
        <span className="text-[11px] font-bold px-2 py-0.5 shrink-0" style={HIRE_TONE[h.status]}>{HIRE_LABEL[h.status]}</span></span>
      <span className="text-xs" style={{ color: "var(--tws-muted)" }}>{line}{h.clientName ? ` · ${h.clientName}` : ""}</span>
    </button>
  );
}
