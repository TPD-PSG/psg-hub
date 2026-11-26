"use client";

// Accidents & incidents at the top of a production's H&S tab (26 Nov 2026): report one, the QR code
// for crew without a login, and the reports this person may see (all of them for the show's staff and
// the H&S leads; just their own for everyone else). ?incident=<id> opens one.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Modal } from "@/components/Modal";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import IncidentForm from "@/components/IncidentForm";
import IncidentDetail, { StatusPill, type Incident } from "@/components/IncidentDetail";
import { KIND_LABEL, incidentRef } from "@/lib/incidentsCore";

type Data = { incidents: Incident[]; lead: boolean; manage: boolean; qrToken: string | null; people: { id: number; name: string }[] };
const card = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
const muted = { color: "var(--psg-muted)" };

export default function IncidentsPanel({ productionId, productionName, venues }: { productionId: number; productionName: string; venues: string[] }) {
  const { data: session } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [d, setD] = useState<Data | null>(null);
  const [reporting, setReporting] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);
  const [showClosed, setShowClosed] = useState(false);
  const openId = Number(params.get("incident")) || null;

  const load = useCallback(async () => {
    const r = await fetch(`/api/productions/${productionId}/incidents`).then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (r) setD(r);
  }, [productionId]);
  useEffect(() => {
    let gone = false;
    fetch(`/api/productions/${productionId}/incidents`).then(x => (x.ok ? x.json() : null)).then(r => { if (!gone && r) setD(r); }).catch(() => {});
    return () => { gone = true; };
  }, [productionId]);

  const setOpen = (id: number | null) => {
    const q = new URLSearchParams(params.toString());
    if (id) q.set("incident", String(id)); else q.delete("incident");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const replace = (i: Incident) => setD(x => x && { ...x, incidents: x.incidents.map(y => (y.id === i.id ? i : y)) });

  async function qr(renew = false) {
    if (renew && !(await confirmDialog("Make a new QR code? Printed copies of the old one will stop working."))) return;
    const res = await fetch(`/api/productions/${productionId}/incident-qr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renew }) });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(r.error ?? "Couldn't make the QR code");
    setD(x => x && { ...x, qrToken: r.token });
    setQrVersion(v => v + 1);
    setQrOpen(true);
  }

  if (!d) return null;
  const list = d.incidents.filter(i => showClosed || i.status !== "closed");
  const closedCount = d.incidents.filter(i => i.status === "closed").length;
  const open = d.incidents.find(i => i.id === openId) ?? null;
  const formUrl = d.qrToken ? `${typeof window === "undefined" ? "" : window.location.origin}/report-incident/${d.qrToken}` : "";

  return (
    <section aria-label="Accidents and incidents">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-white mr-auto">Accidents &amp; incidents</h2>
        {d.manage && <button type="button" onClick={() => (d.qrToken ? setQrOpen(true) : qr())} className="text-xs border px-3 py-1.5 rounded hover:bg-white/5" style={{ ...muted, borderColor: "var(--psg-card-border)" }}>QR code for crew</button>}
        <button type="button" onClick={() => setReporting(true)} className="text-sm font-semibold px-3 py-1.5 rounded text-white" style={{ backgroundColor: "#b91c1c" }}>Report an incident</button>
      </div>

      <div className="rounded-lg border overflow-hidden" style={card}>
        {list.length === 0 ? (
          <p className="text-xs text-center py-6 m-0" style={muted}>
            {d.incidents.length ? "No open reports." : d.manage ? "Nothing reported on this show." : "You haven't reported anything on this show. Reports you file appear here."}
          </p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {list.map(i => (
              <li key={i.id} style={{ borderBottom: "1px solid var(--psg-card-border)" }}>
                <button type="button" onClick={() => setOpen(i.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/5 grid gap-x-3 gap-y-1 sm:grid-cols-[7rem_minmax(0,1fr)_auto] items-center">
                  <span className="text-xs" style={muted}>{new Date(i.occurredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · <span className="font-mono">{incidentRef(i)}</span></span>
                  <span className="min-w-0 text-sm text-white truncate"><strong className="font-semibold">{KIND_LABEL[i.kind] ?? i.kind}</strong>: {i.description}</span>
                  <StatusPill i={i} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {closedCount > 0 && <button type="button" onClick={() => setShowClosed(!showClosed)} className="w-full text-xs py-2 hover:bg-white/5" style={muted}>{showClosed ? "Hide closed" : `Show ${closedCount} closed`}</button>}
      </div>

      {reporting && (
        <Modal title={`Report an incident · ${productionName}`} onClose={() => setReporting(false)}>
          <IncidentForm look="hub" venues={venues} reporterName={session?.user?.name ?? ""} submitUrl={`/api/productions/${productionId}/incidents`}
            onDone={async r => { setReporting(false); await load(); setOpen((r as Incident).id); }} />
        </Modal>
      )}

      {open && (
        <Modal title={`${KIND_LABEL[open.kind] ?? "Incident"} · ${incidentRef(open)}`} onClose={() => setOpen(null)}>
          <IncidentDetail key={open.id} incident={open} manage={d.manage} lead={d.lead} people={d.people} onChange={replace}
            onDeleted={() => { setOpen(null); load(); }} />
        </Modal>
      )}

      {qrOpen && d.qrToken && (
        <Modal title="QR code for crew" onClose={() => setQrOpen(false)}>
          <div className="flex flex-col items-center gap-3 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/productions/${productionId}/incident-qr?v=${qrVersion}`} alt="QR code for the incident form" width={200} height={200} style={{ imageRendering: "pixelated", background: "#fff" }} />
            <p className="text-center m-0" style={muted}>Put this up by the prompt desk, the stage door and the first-aid kit. Anyone can report from their phone without logging in; only this show&apos;s managers and the H&amp;S leads see the reports.</p>
            <code className="text-xs break-all text-white">{formUrl}</code>
            <div className="flex gap-2 flex-wrap justify-center">
              <a href={`/api/productions/${productionId}/incident-qr?v=${qrVersion}`} download="incident-report-qr.png" className="text-xs border px-3 py-1.5 rounded" style={{ ...muted, borderColor: "var(--psg-card-border)" }}>Download</a>
              <a href={formUrl} target="_blank" rel="noopener noreferrer" className="text-xs border px-3 py-1.5 rounded" style={{ ...muted, borderColor: "var(--psg-card-border)" }}>Open form</a>
              <button type="button" onClick={() => qr(true)} className="text-xs border px-3 py-1.5 rounded" style={{ ...muted, borderColor: "var(--psg-card-border)" }}>Make a new code</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
