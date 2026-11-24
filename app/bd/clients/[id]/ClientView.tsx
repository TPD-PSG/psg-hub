"use client";

// One client, everything in one place: target-account status and owner, contacts, deals,
// productions and (for finance users) sales invoices matched by the client's name.
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { confirmDialog, alertDialog } from "@/components/Dialogs";
import { fmtDate } from "@/lib/format";
import { STAGES, isOpen, weightedValue, stuckReason } from "@/lib/bdPipeline";
import type { Opportunity, UserOption } from "../../BDView";

type Contact = { id: number; name: string; role: string | null; email: string | null; phone: string | null; notes: string | null };
type Invoice = { id: number; reference: string | null; description: string; netAmount: number; vatAmount: number; issueDate: string | null; dueDate: string | null; status: string };
type Production = { id: number; name: string; status: string; startDate: string | null; endDate: string | null; archived: boolean; pmFee?: number | null; entity: { name: string } | null };
export type ClientDetail = {
  id: number; name: string; type: string; website: string | null; address: string | null; notes: string | null;
  billingName: string | null; billingAddress: string | null; billingEmail: string | null;
  targetAccount: boolean; targetOwnerId: number | null; targetOwner: { id: number; name: string } | null; targetSource: string | null;
  contacts: Contact[]; opportunities: Opportunity[]; productions: Production[]; invoices: Invoice[] | null;
};

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
const card = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
const gbp = (n: number | null | undefined) => (n ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n) : "—");
const BLANK_CONTACT = { name: "", role: "", email: "", phone: "" };

export default function ClientView({ initial, users }: { initial: ClientDetail; users: UserOption[] }) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const staff = !role || role === "admin" || role === "member";
  const [c, setC] = useState(initial);
  const [target, setTarget] = useState<{ targetAccount: boolean; targetOwnerId: string; targetSource: string } | null>(null);
  const [contactForm, setContactForm] = useState<typeof BLANK_CONTACT | null>(null);
  const people = users.filter(u => !u.role || u.role === "admin" || u.role === "member");

  async function reload() {
    const d = await fetch(`/api/clients/${c.id}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (d) setC(d);
  }
  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) await alertDialog((await res.json().catch(() => ({}))).error ?? "That didn't work");
    return res.ok;
  }
  async function saveTarget(e: React.FormEvent) {
    e.preventDefault();
    if (target && await call(`/api/clients/${c.id}`, "PUT", target)) { setTarget(null); reload(); }
  }
  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (contactForm && await call(`/api/clients/${c.id}/contacts`, "POST", contactForm)) { setContactForm(null); reload(); }
  }
  async function removeContact(ct: Contact) {
    if (!await confirmDialog(`Remove ${ct.name} from ${c.name}'s contacts?`)) return;
    if (await call(`/api/clients/${c.id}/contacts/${ct.id}`, "DELETE")) reload();
  }

  const open = c.opportunities.filter(o => isOpen(o.stage));
  const won = c.opportunities.filter(o => o.stage === "won");
  const outstanding = (c.invoices ?? []).filter(i => i.status !== "paid" && i.status !== "draft");

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link href="/bd" className="text-xs" style={{ color: "var(--psg-muted)" }}>← Business Development</Link>
          <h1 className="text-2xl font-bold text-white mt-1 break-words">{c.name}</h1>
          <p className="text-sm capitalize" style={{ color: "var(--psg-muted)" }}>
            {c.type}{c.website && <> · <a href={c.website} target="_blank" rel="noreferrer" className="text-blue-400 normal-case">{c.website.replace(/^https?:\/\//, "")}</a></>}
          </p>
        </div>
        <div className="rounded-lg border px-4 py-3 text-sm min-w-[240px]" style={{ ...card, borderColor: c.targetAccount ? "rgba(91,141,239,0.6)" : "var(--psg-card-border)" }}>
          {!target ? (
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-white">{c.targetAccount ? "★ Target account" : "Not a target account"}</div>
                {c.targetAccount && (
                  <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                    Owner: {c.targetOwner?.name ?? "nobody yet"}{c.targetSource ? ` · from ${c.targetSource}` : ""}
                  </div>
                )}
              </div>
              {staff && (
                <button type="button" onClick={() => setTarget({ targetAccount: c.targetAccount, targetOwnerId: c.targetOwnerId ? String(c.targetOwnerId) : "", targetSource: c.targetSource ?? "" })}
                  className="text-xs text-blue-400 shrink-0">{c.targetAccount ? "Edit" : "Make target"}</button>
              )}
            </div>
          ) : (
            <form onSubmit={saveTarget} className="space-y-2">
              <label className="flex items-center gap-2 text-white">
                <input type="checkbox" checked={target.targetAccount} onChange={e => setTarget({ ...target, targetAccount: e.target.checked })} />
                Target account
              </label>
              <select aria-label="Account owner" className={inp} style={inpStyle} value={target.targetOwnerId} onChange={e => setTarget({ ...target, targetOwnerId: e.target.value })}>
                <option value="">— No owner —</option>
                {people.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input aria-label="Where the target came from" className={inp} style={inpStyle} placeholder="Source, e.g. Ammonite" value={target.targetSource} onChange={e => setTarget({ ...target, targetSource: e.target.value })} />
              <div className="flex gap-2">
                <button type="submit" className="text-white px-3 py-1.5 rounded text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>Save</button>
                <button type="button" onClick={() => setTarget(null)} className="text-sm" style={{ color: "var(--psg-muted)" }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Headline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Open deals", `${open.length}`, `${gbp(open.reduce((s, o) => s + weightedValue(o), 0))} weighted`],
          ["Won", `${won.length}`, gbp(won.reduce((s, o) => s + (o.value ?? 0), 0))],
          ["Productions", `${c.productions.length}`, `${c.productions.filter(p => !p.archived && p.status !== "closed").length} active`],
          ...(c.invoices ? [["Outstanding", gbp(outstanding.reduce((s, i) => s + i.netAmount + i.vatAmount, 0)), `${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"}`]] : []),
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border p-4" style={card}>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>{label}</div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Deals */}
        <section className="rounded-lg border" style={card}>
          <h2 className="px-4 py-3 border-b text-sm font-semibold text-white" style={{ borderColor: "var(--psg-card-border)" }}>Deals ({c.opportunities.length})</h2>
          {c.opportunities.length === 0 && <p className="px-4 py-4 text-sm" style={{ color: "var(--psg-muted)" }}>No deals with this client yet.</p>}
          <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
            {c.opportunities.map(o => {
              const s = STAGES.find(x => x.key === o.stage);
              const stuck = stuckReason(o);
              return (
                <li key={o.id} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderColor: "var(--psg-card-border)" }}>
                  <div className="min-w-0">
                    <div className="text-sm text-white">{o.title}</div>
                    <div className="text-xs" style={{ color: stuck ? "#fbbf24" : "var(--psg-muted)" }}>
                      {[o.entity?.name, o.owner?.name, stuck ?? (o.followUpDate && isOpen(o.stage) ? `follow up ${fmtDate(o.followUpDate)}` : null)].filter(Boolean).join(" · ")}
                    </div>
                    {o.production && <Link href={`/productions/${o.production.id}`} className="text-xs text-blue-400">→ {o.production.name}</Link>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: (s?.color ?? "#888") + "22", color: s?.color }}>{s?.label ?? o.stage}</span>
                    <div className="text-sm text-white mt-1">{gbp(o.value)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Contacts */}
        <section className="rounded-lg border" style={card}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--psg-card-border)" }}>
            <h2 className="text-sm font-semibold text-white">Contacts ({c.contacts.length})</h2>
            {staff && !contactForm && <button type="button" onClick={() => setContactForm(BLANK_CONTACT)} className="text-xs text-blue-400">+ Add</button>}
          </div>
          {contactForm && (
            <form onSubmit={addContact} className="p-4 grid grid-cols-2 gap-2 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <input required aria-label="Name" placeholder="Name" className={inp} style={inpStyle} value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} />
              <input aria-label="Role" placeholder="Role" className={inp} style={inpStyle} value={contactForm.role} onChange={e => setContactForm({ ...contactForm, role: e.target.value })} />
              <input aria-label="Email" type="email" placeholder="Email" className={inp} style={inpStyle} value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
              <input aria-label="Phone" placeholder="Phone" className={inp} style={inpStyle} value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
              <div className="col-span-2 flex gap-2">
                <button type="submit" className="text-white px-3 py-1.5 rounded text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>Add contact</button>
                <button type="button" onClick={() => setContactForm(null)} className="text-sm" style={{ color: "var(--psg-muted)" }}>Cancel</button>
              </div>
            </form>
          )}
          {c.contacts.length === 0 && !contactForm && <p className="px-4 py-4 text-sm" style={{ color: "var(--psg-muted)" }}>No contacts yet.</p>}
          <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
            {c.contacts.map(ct => (
              <li key={ct.id} className="px-4 py-3 flex items-start justify-between gap-3 group" style={{ borderColor: "var(--psg-card-border)" }}>
                <div className="min-w-0 text-sm">
                  <div className="text-white">{ct.name}{ct.role && <span style={{ color: "var(--psg-muted)" }}> · {ct.role}</span>}</div>
                  <div className="text-xs break-words" style={{ color: "var(--psg-muted)" }}>
                    {ct.email && <a href={`mailto:${ct.email}`} className="text-blue-400">{ct.email}</a>}{ct.email && ct.phone ? " · " : ""}{ct.phone}
                  </div>
                </div>
                {staff && <button type="button" onClick={() => removeContact(ct)} aria-label={`Remove ${ct.name}`} className="text-xs text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100">Remove</button>}
              </li>
            ))}
          </ul>
        </section>

        {/* Productions */}
        <section className="rounded-lg border" style={card}>
          <h2 className="px-4 py-3 border-b text-sm font-semibold text-white" style={{ borderColor: "var(--psg-card-border)" }}>Productions ({c.productions.length})</h2>
          {c.productions.length === 0 && <p className="px-4 py-4 text-sm" style={{ color: "var(--psg-muted)" }}>No productions for this client yet.</p>}
          <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
            {c.productions.map(p => (
              <li key={p.id} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderColor: "var(--psg-card-border)" }}>
                <div className="min-w-0">
                  <Link href={`/productions/${p.id}`} className="text-sm text-white hover:underline">{p.name}</Link>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>
                    {[p.entity?.name, p.archived ? "archived" : p.status, p.startDate ? fmtDate(p.startDate) : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {p.pmFee != null && <div className="text-sm text-white shrink-0" title="PM fee">{gbp(p.pmFee)}</div>}
              </li>
            ))}
          </ul>
        </section>

        {/* Invoices (finance users only) */}
        {c.invoices && (
          <section className="rounded-lg border" style={card}>
            <h2 className="px-4 py-3 border-b text-sm font-semibold text-white" style={{ borderColor: "var(--psg-card-border)" }}>Sales invoices ({c.invoices.length})</h2>
            <p className="px-4 pt-3 text-xs" style={{ color: "var(--psg-muted)" }}>Matched where the invoice&apos;s party is &ldquo;{c.name}&rdquo;{c.billingName && c.billingName !== c.name ? ` or "${c.billingName}"` : ""}.</p>
            {c.invoices.length === 0 && <p className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>None found.</p>}
            <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
              {c.invoices.map(i => (
                <li key={i.id} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderColor: "var(--psg-card-border)" }}>
                  <div className="min-w-0 text-sm">
                    <div className="text-white">{i.reference ?? `INV-${String(i.id).padStart(4, "0")}`} <span style={{ color: "var(--psg-muted)" }}>· {i.description}</span></div>
                    <div className="text-xs" style={{ color: i.status === "overdue" ? "#f87171" : "var(--psg-muted)" }}>
                      {[i.status, i.dueDate ? `due ${fmtDate(i.dueDate)}` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="text-sm text-white shrink-0">{gbp(i.netAmount + i.vatAmount)}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {(c.notes || c.billingName || c.billingEmail || c.address) && (
        <section className="rounded-lg border p-4 text-sm grid md:grid-cols-2 gap-4" style={card}>
          {c.notes && <div><div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div><p className="whitespace-pre-wrap" style={{ color: "var(--psg-muted)" }}>{c.notes}</p></div>}
          {(c.billingName || c.billingEmail || c.billingAddress) && (
            <div>
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--psg-muted)" }}>Billing</div>
              <p className="whitespace-pre-wrap text-white">{[c.billingName, c.billingAddress, c.billingEmail].filter(Boolean).join("\n")}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
