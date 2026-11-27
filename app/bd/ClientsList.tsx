// Clients list under the pipeline, with the target-accounts filter.
import Link from "next/link";
import { isOpen } from "@/lib/bdPipeline";
import { BLANK_CLIENT, type Client } from "./bdTypes";

export default function ClientsList({ clients, targetsOnly, setTargetsOnly, setEditingClient, setEditClientForm }: {
  clients: Client[];
  targetsOnly: boolean;
  setTargetsOnly: (v: boolean) => void;
  setEditingClient: (c: Client | null) => void;
  setEditClientForm: (f: typeof BLANK_CLIENT) => void;
}) {
  return (
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
  );
}
